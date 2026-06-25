"""A/B test endpoints — port of original Express /api/ab-tests."""
import random
from django.db.models import F
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from apps.core.models import AbTest as ABTest, AbTestVariant as ABTestVariant, AbTestAssignment as ABTestAssignment


def _admin(u):
    return u.is_authenticated and u.role in ('admin', 'moderator')


def _fmt_variant(v):
    return {
        'id': v.id, 'testId': v.test_id, 'name': v.name,
        'description': v.description, 'weight': v.weight,
        'viewCount': v.view_count, 'conversionCount': v.conversion_count,
    }


def _fmt_test(t, variants=None):
    return {
        'id': t.id, 'name': t.name, 'description': t.description,
        'status': t.status, 'createdAt': t.created_at.isoformat() if t.created_at else None,
        'variants': [_fmt_variant(v) for v in (variants or [])],
    }


@api_view(['POST'])
@permission_classes([AllowAny])
def assign(request, test_name):
    session_id = (request.data.get('sessionId') or '').strip()
    if not session_id:
        return Response({'error': 'sessionId gerekli'}, status=400)
    test = ABTest.objects.filter(name=test_name, status='active').first()
    if not test:
        return Response({'variantId': None, 'variantName': None})

    existing = ABTestAssignment.objects.filter(test=test, session_id=session_id).first()
    if existing:
        return Response({'variantId': existing.variant_id, 'variantName': existing.variant.name})

    variants = list(ABTestVariant.objects.filter(test=test))
    if not variants:
        return Response({'variantId': None, 'variantName': None})

    total = sum(v.weight for v in variants) or 1
    r = random.random() * total
    chosen = variants[-1]
    for v in variants:
        r -= v.weight
        if r <= 0:
            chosen = v
            break

    ABTestAssignment.objects.get_or_create(
        test=test, session_id=session_id, defaults={'variant': chosen}
    )
    ABTestVariant.objects.filter(id=chosen.id).update(view_count=F('view_count') + 1)
    return Response({'variantId': chosen.id, 'variantName': chosen.name})


@api_view(['POST'])
@permission_classes([AllowAny])
def convert(request, test_name):
    session_id = (request.data.get('sessionId') or '').strip()
    if not session_id:
        return Response({'error': 'sessionId gerekli'}, status=400)
    test = ABTest.objects.filter(name=test_name).first()
    if not test:
        return Response({'ok': True})
    a = ABTestAssignment.objects.filter(test=test, session_id=session_id).first()
    if a:
        ABTestVariant.objects.filter(id=a.variant_id).update(conversion_count=F('conversion_count') + 1)
    return Response({'ok': True})


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def admin_tests(request):
    if not _admin(request.user):
        return Response({'error': 'Admin gerekli'}, status=403)
    if request.method == 'GET':
        tests = list(ABTest.objects.all().order_by('created_at'))
        all_variants = ABTestVariant.objects.filter(test__in=tests)
        per_test = {}
        for v in all_variants:
            per_test.setdefault(v.test_id, []).append(v)
        return Response({'tests': [_fmt_test(t, per_test.get(t.id, [])) for t in tests]})

    name = (request.data.get('name') or '').strip()
    if not name:
        return Response({'error': 'name gerekli'}, status=400)
    test = ABTest.objects.create(name=name, description=request.data.get('description') or '')
    raw_variants = request.data.get('variants') or []
    created = []
    for v in raw_variants:
        created.append(ABTestVariant.objects.create(
            test=test, name=v.get('name') or 'A',
            description=v.get('description') or '',
            weight=int(v.get('weight') or 50),
        ))
    return Response({'test': _fmt_test(test, created)})


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def admin_test_detail(request, test_id):
    if not _admin(request.user):
        return Response({'error': 'Admin gerekli'}, status=403)
    test = ABTest.objects.filter(id=test_id).first()
    if not test:
        return Response({'error': 'Test bulunamadı'}, status=404)
    if request.method == 'DELETE':
        test.delete()
        return Response({'ok': True})
    for field in ('status', 'name', 'description'):
        if field in request.data:
            setattr(test, field, request.data[field])
    test.save()
    return Response({'test': _fmt_test(test, list(test.variants.all()))})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def admin_add_variant(request, test_id):
    if not _admin(request.user):
        return Response({'error': 'Admin gerekli'}, status=403)
    test = ABTest.objects.filter(id=test_id).first()
    if not test:
        return Response({'error': 'Test bulunamadı'}, status=404)
    v = ABTestVariant.objects.create(
        test=test, name=request.data.get('name') or 'A',
        description=request.data.get('description') or '',
        weight=int(request.data.get('weight') or 50),
    )
    return Response({'variant': _fmt_variant(v)})


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def admin_delete_variant(request, test_id, variant_id):
    if not _admin(request.user):
        return Response({'error': 'Admin gerekli'}, status=403)
    ABTestVariant.objects.filter(id=variant_id, test_id=test_id).delete()
    return Response({'ok': True})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def admin_reset(request, test_id):
    if not _admin(request.user):
        return Response({'error': 'Admin gerekli'}, status=403)
    ABTestVariant.objects.filter(test_id=test_id).update(view_count=0, conversion_count=0)
    ABTestAssignment.objects.filter(test_id=test_id).delete()
    return Response({'ok': True})
