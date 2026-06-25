from django.utils import timezone
from django.db import transaction
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response

from apps.videos.models import Video, Category
from .models import AIModel, TrainingEvent, CategoryPrediction
from . import predictor


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _is_admin(u):
    return u.is_authenticated and getattr(u, 'role', '') in ('admin', 'moderator')


def _model(kind: str) -> AIModel:
    m, _ = AIModel.objects.get_or_create(kind=kind)
    return m


def _event_dict(e: TrainingEvent) -> dict:
    return {
        'id': e.id,
        'eventType': e.event_type,
        'status': e.status,
        'payload': e.payload,
        'createdAt': e.created_at.isoformat(),
        'reviewedAt': e.reviewed_at.isoformat() if e.reviewed_at else None,
        'video': {
            'id': e.video.id, 'title': e.video.title,
            'thumbnailUrl': e.video.thumbnail_url,
            'categoryId': e.video.category_id,
        } if e.video_id else None,
        'user': {
            'id': e.user.id, 'username': e.user.username,
        } if e.user_id else None,
    }


def _prediction_dict(p: CategoryPrediction) -> dict:
    return {
        'id': p.id,
        'confidence': p.confidence,
        'modelVersion': p.model_version,
        'createdAt': p.created_at.isoformat(),
        'applied': p.applied,
        'dismissed': p.dismissed,
        'video': {
            'id': p.video.id, 'title': p.video.title,
            'thumbnailUrl': p.video.thumbnail_url,
            'categoryId': p.video.category_id,
        },
        'suggestedCategory': {
            'id': p.suggested_category.id,
            'name': p.suggested_category.name,
        },
    }


# ---------------------------------------------------------------------------
# Public-ish: signal ingestion (used by the site as users interact)
# ---------------------------------------------------------------------------

@api_view(['POST'])
@permission_classes([AllowAny])
def ingest_event(request):
    """Accept a training event from the running site.
    Body: { eventType, videoId?, payload? }
    Auth optional; user is attached if logged in.
    """
    et = request.data.get('eventType') or request.data.get('event_type')
    if et not in dict(TrainingEvent.EVENT_TYPES):
        return Response({'error': 'invalid eventType'}, status=400)
    video_id = request.data.get('videoId') or request.data.get('video_id')
    video = None
    if video_id:
        video = Video.objects.filter(id=video_id).first()
    user = request.user if getattr(request.user, 'is_authenticated', False) else None
    e = TrainingEvent.objects.create(
        event_type=et,
        video=video,
        user=user,
        payload=request.data.get('payload') or {},
        status='pending',
    )
    return Response({'event': _event_dict(e)}, status=201)


# Convenience helper used elsewhere in the codebase to record events.
def record_event(event_type: str, video=None, user=None, payload: dict | None = None, status: str = 'pending') -> TrainingEvent:
    return TrainingEvent.objects.create(
        event_type=event_type, video=video, user=user,
        payload=payload or {}, status=status,
    )


# ---------------------------------------------------------------------------
# Admin: model registry, training, predictions
# ---------------------------------------------------------------------------

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_models(request):
    if not _is_admin(request.user):
        return Response({'error': 'Admin gerekli'}, status=403)
    out = []
    for kind, _label in AIModel.KIND_CHOICES:
        m = _model(kind)
        cats = (m.state.get('categories') or []) if kind == 'category' else []
        out.append({
            'kind': m.kind,
            'version': m.version,
            'sampleCount': m.sample_count,
            'lastTrainedAt': m.last_trained_at.isoformat() if m.last_trained_at else None,
            'isEnabled': m.is_enabled,
            'isEmpty': m.version == 0,
            'categoriesKnown': len(cats),
        })
    return Response({'models': out})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def admin_train(request, kind: str):
    if not _is_admin(request.user):
        return Response({'error': 'Admin gerekli'}, status=403)
    if kind == 'category':
        return _train_category_model()
    if kind == 'content':
        return _train_content_model()
    return Response({'error': 'unknown kind'}, status=400)


def _train_category_model():
    qs = Video.objects.select_related('category').filter(
        is_published=True, category__isnull=False, moderation_status='approved',
    )
    # Also include videos referenced by approved category_assigned events,
    # giving the admin a way to teach the model from approved signals.
    state = predictor.train_category_state(qs)
    sample_count = sum(c.get('docs', 0) for c in state.get('categories', []))
    m = _model('category')
    m.state = state
    m.sample_count = sample_count
    m.version += 1
    m.last_trained_at = timezone.now()
    m.save()
    # Regenerate predictions for uncategorised approved videos
    _regenerate_category_predictions(m)
    return Response({
        'message': 'Model eğitildi',
        'version': m.version, 'sampleCount': m.sample_count,
        'categoriesKnown': len(state.get('categories', [])),
    })


def _regenerate_category_predictions(m: AIModel):
    """Mark stale and predict fresh suggestions for videos without a category."""
    CategoryPrediction.objects.filter(applied=False, dismissed=False).delete()
    targets = Video.objects.filter(category__isnull=True).order_by('-created_at')[:200]
    state = m.state
    created = 0
    for v in targets:
        preds = predictor.predict(state, v)
        # take the top one if confidence reasonable
        for p in preds[:1]:
            if p['score'] <= 0:
                continue
            CategoryPrediction.objects.create(
                video=v, suggested_category_id=p['category_id'],
                confidence=p['score'], model_version=m.version,
            )
            created += 1
    return created


def _train_content_model():
    """Aggregate engagement-style approved events into a per-video profile."""
    profile: dict[str, dict] = {}
    events = TrainingEvent.objects.filter(
        status__in=('approved', 'auto'),
        event_type__in=('video_view', 'watch_progress', 'engagement'),
        video__isnull=False,
    ).only('video_id', 'event_type', 'payload')
    for e in events.iterator():
        key = str(e.video_id)
        p = profile.setdefault(key, {'views': 0, 'watch_sec': 0, 'likes': 0, 'bookmarks': 0, 'comments': 0, 'shares': 0})
        if e.event_type == 'video_view':
            p['views'] += 1
        elif e.event_type == 'watch_progress':
            try:
                p['watch_sec'] += int((e.payload or {}).get('seconds', 0))
            except Exception:
                pass
        elif e.event_type == 'engagement':
            kind = (e.payload or {}).get('kind', '')
            if kind in p:
                p[kind] += 1
    m = _model('content')
    m.state = {'videos': profile}
    m.sample_count = events.count()
    m.version += 1
    m.last_trained_at = timezone.now()
    m.save()
    return Response({'message': 'İçerik profili güncellendi', 'version': m.version, 'sampleCount': m.sample_count})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def admin_reset(request, kind: str):
    if not _is_admin(request.user):
        return Response({'error': 'Admin gerekli'}, status=403)
    m = _model(kind)
    m.state = {}
    m.sample_count = 0
    m.version = 0
    m.last_trained_at = None
    m.save()
    if kind == 'category':
        CategoryPrediction.objects.all().delete()
    return Response({'message': 'Model sıfırlandı', 'kind': kind})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_events(request):
    if not _is_admin(request.user):
        return Response({'error': 'Admin gerekli'}, status=403)
    status = request.query_params.get('status')
    event_type = request.query_params.get('eventType')
    limit = min(int(request.query_params.get('limit', 30)), 200)
    since_id = int(request.query_params.get('sinceId', 0) or 0)

    qs = TrainingEvent.objects.select_related('video', 'user')
    if status:
        qs = qs.filter(status=status)
    if event_type:
        qs = qs.filter(event_type=event_type)
    if since_id:
        qs = qs.filter(id__gt=since_id).order_by('id')[:limit]
    else:
        qs = qs.order_by('-id')[:limit]

    items = [_event_dict(e) for e in qs]
    counts = {
        'pending': TrainingEvent.objects.filter(status='pending').count(),
        'approved': TrainingEvent.objects.filter(status='approved').count(),
        'rejected': TrainingEvent.objects.filter(status='rejected').count(),
        'auto': TrainingEvent.objects.filter(status='auto').count(),
    }
    return Response({'events': items, 'counts': counts})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def admin_event_review(request, event_id: int, action: str):
    if not _is_admin(request.user):
        return Response({'error': 'Admin gerekli'}, status=403)
    if action not in ('approve', 'reject'):
        return Response({'error': 'invalid action'}, status=400)
    try:
        e = TrainingEvent.objects.get(id=event_id)
    except TrainingEvent.DoesNotExist:
        return Response({'error': 'not found'}, status=404)
    e.status = 'approved' if action == 'approve' else 'rejected'
    e.reviewed_at = timezone.now()
    e.reviewed_by = request.user
    e.save()
    return Response({'event': _event_dict(e)})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def admin_events_bulk(request):
    """Bulk approve/reject a list of event ids."""
    if not _is_admin(request.user):
        return Response({'error': 'Admin gerekli'}, status=403)
    action = request.data.get('action')
    ids = request.data.get('ids') or []
    if action not in ('approve', 'reject') or not isinstance(ids, list):
        return Response({'error': 'invalid payload'}, status=400)
    new_status = 'approved' if action == 'approve' else 'rejected'
    n = TrainingEvent.objects.filter(id__in=ids).update(
        status=new_status, reviewed_at=timezone.now(), reviewed_by=request.user,
    )
    return Response({'updated': n})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_predictions(request):
    if not _is_admin(request.user):
        return Response({'error': 'Admin gerekli'}, status=403)
    qs = CategoryPrediction.objects.select_related('video', 'suggested_category').filter(
        applied=False, dismissed=False,
    )[:100]
    return Response({'predictions': [_prediction_dict(p) for p in qs]})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def admin_prediction_apply(request, prediction_id: int):
    if not _is_admin(request.user):
        return Response({'error': 'Admin gerekli'}, status=403)
    try:
        p = CategoryPrediction.objects.select_related('video').get(id=prediction_id)
    except CategoryPrediction.DoesNotExist:
        return Response({'error': 'not found'}, status=404)
    with transaction.atomic():
        p.video.category_id = p.suggested_category_id
        p.video.save(update_fields=['category_id'])
        p.applied = True
        p.save(update_fields=['applied'])
        record_event(
            'category_assigned', video=p.video, user=request.user,
            payload={'source': 'ai_prediction', 'confidence': p.confidence,
                     'categoryId': p.suggested_category_id},
            status='auto',
        )
    return Response({'prediction': _prediction_dict(p)})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def admin_prediction_dismiss(request, prediction_id: int):
    if not _is_admin(request.user):
        return Response({'error': 'Admin gerekli'}, status=403)
    CategoryPrediction.objects.filter(id=prediction_id).update(dismissed=True)
    return Response({'message': 'dismissed'})
