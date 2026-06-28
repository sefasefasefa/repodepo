"""Shared helpers for the videos app."""
import uuid as _uuid_module


def resolve_video(video_id):
    """Return a Video instance given a UUID string, slug, or integer pk. Returns None if not found."""
    from .models import Video
    vid_str = str(video_id).strip()
    try:
        _uuid_module.UUID(vid_str)
        return Video.objects.filter(uuid=vid_str).first()
    except (ValueError, AttributeError):
        pass
    try:
        return Video.objects.filter(pk=int(vid_str)).first()
    except (ValueError, TypeError):
        pass
    return Video.objects.filter(slug=vid_str).first()
