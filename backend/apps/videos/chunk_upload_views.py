import os
import json
import math
import uuid
import shutil

from django.conf import settings
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response

CHUNK_UPLOAD_DIR = os.path.join(settings.MEDIA_ROOT, '_chunks')
CHUNK_SIZE = 5 * 1024 * 1024  # 5 MB


def _session_dir(upload_id: str) -> str:
    return os.path.join(CHUNK_UPLOAD_DIR, upload_id)


def _meta_path(upload_id: str) -> str:
    return os.path.join(_session_dir(upload_id), '_meta.json')


def _read_meta(upload_id: str):
    path = _meta_path(upload_id)
    if not os.path.exists(path):
        return None
    with open(path) as f:
        return json.load(f)


def _write_meta(upload_id: str, meta: dict):
    with open(_meta_path(upload_id), 'w') as f:
        json.dump(meta, f)


ALLOWED_EXTS = {'.mp4', '.m4v', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.ts'}


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def chunk_init(request):
    user = request.user
    if user.role not in ('creator', 'admin', 'moderator'):
        return Response({'error': 'Creator hesabı gerekli'}, status=403)

    filename = request.data.get('filename', 'video.mp4')
    try:
        file_size = int(request.data.get('fileSize', 0))
    except (TypeError, ValueError):
        file_size = 0
    if file_size <= 0:
        return Response({'error': 'Geçersiz dosya boyutu'}, status=400)

    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_EXTS:
        return Response({'error': f'Desteklenmeyen format: {ext}'}, status=400)

    upload_id = uuid.uuid4().hex
    session_dir = _session_dir(upload_id)
    os.makedirs(session_dir, exist_ok=True)

    total_chunks = math.ceil(file_size / CHUNK_SIZE)
    meta = {
        'upload_id': upload_id,
        'user_id': user.id,
        'filename': filename,
        'ext': ext,
        'file_size': file_size,
        'chunk_size': CHUNK_SIZE,
        'total_chunks': total_chunks,
        'received_chunks': [],
        'status': 'uploading',
    }
    _write_meta(upload_id, meta)

    return Response({
        'uploadId': upload_id,
        'chunkSize': CHUNK_SIZE,
        'totalChunks': total_chunks,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser])
def chunk_part(request):
    upload_id = request.data.get('uploadId')
    chunk_index_raw = request.data.get('chunkIndex')
    chunk_file = request.FILES.get('chunk')

    if not upload_id or chunk_index_raw is None or not chunk_file:
        return Response({'error': 'uploadId, chunkIndex ve chunk zorunlu'}, status=400)

    try:
        chunk_index = int(chunk_index_raw)
    except (TypeError, ValueError):
        return Response({'error': 'Geçersiz chunkIndex'}, status=400)

    meta = _read_meta(upload_id)
    if not meta:
        return Response({'error': 'Upload session bulunamadı'}, status=404)
    if meta['user_id'] != request.user.id:
        return Response({'error': 'Yetkisiz'}, status=403)
    if meta['status'] != 'uploading':
        return Response({'error': f"Geçersiz session durumu: {meta['status']}"}, status=400)
    if chunk_index < 0 or chunk_index >= meta['total_chunks']:
        return Response({'error': 'Geçersiz chunk indeksi'}, status=400)

    chunk_path = os.path.join(_session_dir(upload_id), f'chunk_{chunk_index:06d}')
    with open(chunk_path, 'wb+') as f:
        for data in chunk_file.chunks():
            f.write(data)

    if chunk_index not in meta['received_chunks']:
        meta['received_chunks'].append(chunk_index)
    _write_meta(upload_id, meta)

    return Response({
        'chunkIndex': chunk_index,
        'received': len(meta['received_chunks']),
        'total': meta['total_chunks'],
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def chunk_complete(request):
    upload_id = request.data.get('uploadId')
    if not upload_id:
        return Response({'error': 'uploadId zorunlu'}, status=400)

    meta = _read_meta(upload_id)
    if not meta:
        return Response({'error': 'Upload session bulunamadı'}, status=404)
    if meta['user_id'] != request.user.id:
        return Response({'error': 'Yetkisiz'}, status=403)

    received = sorted(meta['received_chunks'])
    missing = [i for i in range(meta['total_chunks']) if i not in received]
    if missing:
        return Response({'error': f'Eksik parçalar: {missing[:5]}'}, status=400)

    meta['status'] = 'assembling'
    _write_meta(upload_id, meta)

    final_filename = f'{uuid.uuid4().hex}{meta["ext"]}'
    upload_dir = os.path.join(settings.MEDIA_ROOT, 'uploads')
    os.makedirs(upload_dir, exist_ok=True)
    final_path = os.path.join(upload_dir, final_filename)
    session_dir = _session_dir(upload_id)

    try:
        with open(final_path, 'wb') as out:
            for i in range(meta['total_chunks']):
                chunk_path = os.path.join(session_dir, f'chunk_{i:06d}')
                with open(chunk_path, 'rb') as chunk_f:
                    shutil.copyfileobj(chunk_f, out)
    except Exception as e:
        meta['status'] = 'failed'
        _write_meta(upload_id, meta)
        return Response({'error': f'Birleştirme hatası: {e}'}, status=500)

    from .models import Video
    from django.db.models import F
    from django.contrib.auth import get_user_model
    User = get_user_model()

    local_url = f'/media/uploads/{final_filename}'
    raw_title = request.data.get('title') or meta['filename']
    title = raw_title.rsplit('.', 1)[0] if '.' in raw_title and not request.data.get('title') else raw_title

    is_premium = str(request.data.get('isPremium', 'false')).lower() in ('true', '1', 'yes')
    video_type = request.data.get('type', 'video')
    category_id = request.data.get('categoryId') or None

    video = Video.objects.create(
        title=title,
        description=request.data.get('description') or '',
        video_url=local_url,
        creator=request.user,
        category_id=category_id,
        is_published=True,
        is_premium=is_premium,
        type=video_type,
    )
    User.objects.filter(id=request.user.id).update(video_count=F('video_count') + 1)

    try:
        shutil.rmtree(session_dir)
    except Exception:
        pass

    return Response({'videoId': video.id, 'url': local_url}, status=201)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def chunk_status(request, upload_id):
    meta = _read_meta(upload_id)
    if not meta:
        return Response({'error': 'Session bulunamadı'}, status=404)
    if meta['user_id'] != request.user.id:
        return Response({'error': 'Yetkisiz'}, status=403)

    return Response({
        'uploadId': upload_id,
        'status': meta['status'],
        'received': len(meta['received_chunks']),
        'total': meta['total_chunks'],
        'filename': meta['filename'],
        'fileSize': meta['file_size'],
    })


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def chunk_cancel(request, upload_id):
    meta = _read_meta(upload_id)
    if not meta:
        return Response({'error': 'Session bulunamadı'}, status=404)
    if meta['user_id'] != request.user.id:
        return Response({'error': 'Yetkisiz'}, status=403)

    try:
        shutil.rmtree(_session_dir(upload_id))
    except Exception:
        pass

    return Response({'message': 'İptal edildi'})
