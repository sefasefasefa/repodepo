"""Extra video endpoints: auto-categorize + video player CRUD (POST/PATCH/DELETE)."""
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .models import Video, VideoPlayer, AutoCategoryRule, Category
from .utils import resolve_video as _resolve_video


def _score_text(text, keywords):
    if not keywords:
        return 0
    lower = text.lower()
    return sum(1 for kw in keywords if kw and kw.lower().strip() in lower)


@api_view(['POST'])
@permission_classes([AllowAny])
def auto_categorize(request):
    """Suggest a category based on title/description/tag keyword matches.

    Schema note: AutoCategoryRule is one (keyword, category) row. We group all
    keywords per category and score the same way Express did.
    """
    title = request.data.get('title', '') or ''
    description = request.data.get('description', '') or ''
    tags = request.data.get('tags', []) or []

    rules = list(
        AutoCategoryRule.objects.filter(is_active=True).select_related('category')
    )
    if not rules:
        return Response({'suggestion': None})

    tag_text = ' '.join(tags) if isinstance(tags, list) else ''
    combined = ((title + ' ') * 3) + (description + ' ') + ((tag_text + ' ') * 2)

    cat_keywords = {}
    cat_info = {}
    for r in rules:
        cat_keywords.setdefault(r.category_id, []).append(r.keyword)
        cat_info[r.category_id] = r.category

    best = None
    for cat_id, kws in cat_keywords.items():
        score = _score_text(combined, kws)
        if score > 0 and (best is None or score > best['score']):
            cat = cat_info[cat_id]
            best = {
                'categoryId': cat.id, 'name': cat.name,
                'slug': cat.slug, 'score': score,
            }

    if not best:
        return Response({'suggestion': None})
    return Response({'suggestion': {
        'categoryId': best['categoryId'],
        'name': best['name'],
        'slug': best['slug'],
        'confidence': min(1.0, best['score'] / 3.0),
    }})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def auto_category_rules_list(request):
    if request.user.role != 'admin':
        return Response({'error': 'Admin gerekli'}, status=403)
    cats = Category.objects.all().order_by('name')
    rules_by_cat = {}
    for r in AutoCategoryRule.objects.all():
        rules_by_cat.setdefault(r.category_id, []).append(r)
    out = []
    for cat in cats:
        rule_list = rules_by_cat.get(cat.id, [])
        out.append({
            'categoryId': cat.id,
            'categoryName': cat.name,
            'categorySlug': cat.slug,
            'keywords': [r.keyword for r in rule_list],
            'isEnabled': all(r.is_active for r in rule_list) if rule_list else True,
            'ruleId': rule_list[0].id if rule_list else None,
        })
    return Response({'rules': out})


@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def auto_category_rules_save(request):
    """Replace the keyword set for each provided category."""
    if request.user.role != 'admin':
        return Response({'error': 'Admin gerekli'}, status=403)
    rules = request.data.get('rules')
    if not isinstance(rules, list):
        return Response({'error': 'rules dizisi gerekli'}, status=400)

    for r in rules:
        cat_id = r.get('categoryId')
        if not cat_id:
            continue
        keywords = [k.strip().lower() for k in (r.get('keywords') or []) if k and k.strip()]
        is_enabled = bool(r.get('isEnabled', True))
        AutoCategoryRule.objects.filter(category_id=cat_id).delete()
        AutoCategoryRule.objects.bulk_create([
            AutoCategoryRule(category_id=cat_id, keyword=kw, is_active=is_enabled)
            for kw in keywords
        ])
    return Response({'ok': True})


# ─── Video Players (CRUD by creator/admin) ────────────────────────────────────

def _fmt_player(p):
    is_direct = (p.player_type or '').lower() == 'direct'
    return {
        'id': p.id, 'videoId': p.video_id,
        'playerName': p.label, 'label': p.label,
        'embedCode': None if is_direct else p.embed_url,
        'embedUrl': None if is_direct else p.embed_url,
        'directUrl': p.embed_url if is_direct else None,
        'playerType': p.player_type,
        'quality': getattr(p, 'quality', None) or 'HD',
        'language': 'TR',
        'isDefault': p.is_default,
        'sortOrder': p.sort_order,
        'createdAt': p.created_at.isoformat() if p.created_at else None,
    }


def _can_edit_video(user, video):
    return video.creator_id == user.id or user.role in ('admin', 'moderator')


@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def video_players(request, video_id):
    video = _resolve_video(video_id)
    if not video:
        return Response({'error': 'Video bulunamadı'}, status=404)
    if request.method == 'GET':
        players = VideoPlayer.objects.filter(video=video).order_by('sort_order')
        return Response({'players': [_fmt_player(p) for p in players]})

    # POST → require auth + ownership
    if not request.user.is_authenticated:
        return Response({'error': 'Not authenticated'}, status=401)
    if not _can_edit_video(request.user, video):
        return Response({'error': 'Forbidden'}, status=403)

    d = request.data
    label = d.get('playerName') or d.get('label')
    embed = d.get('embedCode') or d.get('embedUrl') or d.get('directUrl')
    if not label or not embed:
        return Response({'error': 'playerName/label and embedCode/url required'}, status=400)

    is_default = bool(d.get('isDefault'))
    if is_default:
        VideoPlayer.objects.filter(video=video).update(is_default=False)

    p = VideoPlayer.objects.create(
        video=video, label=label, embed_url=embed,
        player_type=d.get('playerType') or 'iframe',
        is_default=is_default,
        sort_order=int(d.get('sortOrder') or 0),
    )
    return Response(_fmt_player(p), status=201)


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def video_player_detail(request, video_id, player_id):
    video = _resolve_video(video_id)
    if not video or not _can_edit_video(request.user, video):
        return Response({'error': 'Forbidden'}, status=403)
    p = VideoPlayer.objects.filter(id=player_id, video=video).first()
    if not p:
        return Response({'error': 'Player not found'}, status=404)
    if request.method == 'DELETE':
        p.delete()
        return Response({'message': 'Deleted'}, status=204)
    d = request.data
    if 'playerName' in d or 'label' in d:
        p.label = d.get('playerName') or d.get('label')
    if 'embedCode' in d or 'embedUrl' in d or 'directUrl' in d:
        p.embed_url = d.get('embedCode') or d.get('embedUrl') or d.get('directUrl')
    if 'playerType' in d:
        p.player_type = d['playerType']
    if 'sortOrder' in d:
        p.sort_order = int(d['sortOrder'])
    if 'isDefault' in d and d['isDefault']:
        VideoPlayer.objects.filter(video=video).exclude(id=p.id).update(is_default=False)
        p.is_default = True
    elif 'isDefault' in d:
        p.is_default = False
    p.save()
    return Response(_fmt_player(p))
