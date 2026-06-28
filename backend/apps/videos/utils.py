"""Shared helpers for the videos app."""
import uuid as _uuid_module


def resolve_video(video_id):
    """Return a Video instance given a UUID string or integer pk. Returns None if not found."""
    from .models import Video
    try:
        uid = _uuid_module.UUID(str(video_id))
        return Video.objects.filter(uuid=uid).first()
    except (ValueError, AttributeError):
        pass
    try:
        return Video.objects.filter(pk=int(video_id)).first()
    except (ValueError, TypeError):
        return None
