"""
Django signal receivers that automatically fire webhook events.
Import this module in AdminPanelConfig.ready() to activate signals.

Covered events:
  video.created / video.published / video.deleted
  user.registered / user.banned / user.role_changed
  payment.completed / payment.failed
  subscription.created / subscription.cancelled / subscription.expired
  creator.approved / creator.rejected
  comment.created
  live.started / live.ended
"""

from django.db.models.signals import post_save, pre_delete, post_delete
from django.dispatch import receiver, Signal
from . import webhook_service as wh

# ── Custom signals (fire these from views/tasks) ────────────────────────────
video_published    = Signal()
user_banned_signal = Signal()
creator_approved   = Signal()
creator_rejected   = Signal()
live_started       = Signal()
live_ended         = Signal()


# ── Video signals ─────────────────────────────────────────────────────────────
def _connect_video_signals():
    try:
        from apps.videos.models import Video

        @receiver(post_save, sender=Video, weak=False)
        def on_video_save(sender, instance, created, **kwargs):
            try:
                payload = {
                    'id':          instance.id,
                    'title':       instance.title,
                    'creator':     instance.creator.username if instance.creator_id else None,
                    'category':    instance.category.name if instance.category_id else None,
                    'is_premium':  instance.is_premium,
                    'type':        instance.type,
                    'is_published': instance.is_published,
                }
                if created:
                    wh.fire_event_async('video.created', payload)
                elif instance.is_published:
                    wh.fire_event_async('video.published', payload)
                else:
                    wh.fire_event_async('video.updated', payload)
            except Exception:
                pass

        @receiver(pre_delete, sender=Video, weak=False)
        def on_video_delete(sender, instance, **kwargs):
            try:
                wh.fire_event_async('video.deleted', {
                    'id':    instance.id,
                    'title': instance.title,
                    'creator': instance.creator.username if instance.creator_id else None,
                })
            except Exception:
                pass

    except Exception:
        pass


# ── User signals ──────────────────────────────────────────────────────────────
def _connect_user_signals():
    try:
        from django.contrib.auth import get_user_model
        User = get_user_model()

        @receiver(post_save, sender=User, weak=False)
        def on_user_save(sender, instance, created, **kwargs):
            try:
                if created:
                    wh.fire_event_async('user.registered', {
                        'id':           instance.id,
                        'username':     instance.username,
                        'email':        instance.email,
                        'display_name': instance.display_name,
                        'role':         instance.role,
                    })
            except Exception:
                pass

    except Exception:
        pass


# ── Payment signals ───────────────────────────────────────────────────────────
def _connect_payment_signals():
    try:
        from apps.subscriptions.models import Payment, UserSubscription

        @receiver(post_save, sender=Payment, weak=False)
        def on_payment_save(sender, instance, created, **kwargs):
            if not created:
                return
            try:
                event = 'payment.completed' if instance.status == 'completed' else 'payment.failed'
                wh.fire_event_async(event, {
                    'id':          instance.id,
                    'user':        instance.user.username,
                    'amount':      str(instance.amount),
                    'type':        instance.type,
                    'description': instance.description,
                })
            except Exception:
                pass

        @receiver(post_save, sender=UserSubscription, weak=False)
        def on_subscription_save(sender, instance, created, **kwargs):
            try:
                if created:
                    wh.fire_event_async('subscription.created', {
                        'id':       instance.id,
                        'user':     instance.user.username,
                        'plan':     instance.plan.name,
                        'price':    str(instance.plan.price),
                        'cycle':    instance.plan.billing_cycle,
                        'status':   instance.status,
                    })
                elif instance.status == 'cancelled':
                    wh.fire_event_async('subscription.cancelled', {
                        'id':   instance.id,
                        'user': instance.user.username,
                        'plan': instance.plan.name,
                    })
                elif instance.status == 'expired':
                    wh.fire_event_async('subscription.expired', {
                        'id':   instance.id,
                        'user': instance.user.username,
                        'plan': instance.plan.name,
                    })
            except Exception:
                pass

    except Exception:
        pass


# ── Comment signals ───────────────────────────────────────────────────────────
def _connect_comment_signals():
    try:
        from apps.videos.models import Comment

        @receiver(post_save, sender=Comment, weak=False)
        def on_comment_save(sender, instance, created, **kwargs):
            if not created:
                return
            try:
                wh.fire_event_async('comment.created', {
                    'id':      instance.id,
                    'user':    instance.user.username if instance.user_id else None,
                    'video':   instance.video.title if instance.video_id else None,
                    'content': (instance.content or '')[:100],
                })
            except Exception:
                pass

    except Exception:
        pass


# ── Custom signal receivers ────────────────────────────────────────────────────
@receiver(user_banned_signal)
def on_user_banned(sender, user, reason='', **kwargs):
    try:
        wh.fire_event_async('user.banned', {
            'id':       user.id,
            'username': user.username,
            'reason':   reason,
        })
    except Exception:
        pass


@receiver(creator_approved)
def on_creator_approved(sender, user, **kwargs):
    try:
        wh.fire_event_async('creator.approved', {
            'id':           user.id,
            'username':     user.username,
            'display_name': user.display_name,
        })
    except Exception:
        pass


@receiver(creator_rejected)
def on_creator_rejected(sender, user, reason='', **kwargs):
    try:
        wh.fire_event_async('creator.rejected', {
            'id':       user.id,
            'username': user.username,
            'reason':   reason,
        })
    except Exception:
        pass


@receiver(live_started)
def on_live_started(sender, stream, **kwargs):
    try:
        wh.fire_event_async('live.started', {
            'id':    getattr(stream, 'id', None),
            'title': getattr(stream, 'title', ''),
            'user':  getattr(stream, 'user', {}).get('username', '') if isinstance(getattr(stream, 'user', None), dict) else str(getattr(stream, 'user', '')),
        })
    except Exception:
        pass


@receiver(live_ended)
def on_live_ended(sender, stream, **kwargs):
    try:
        wh.fire_event_async('live.ended', {
            'id':    getattr(stream, 'id', None),
            'title': getattr(stream, 'title', ''),
        })
    except Exception:
        pass


# ── Bootstrap ─────────────────────────────────────────────────────────────────
def connect_all():
    """Call this once from AppConfig.ready()."""
    _connect_video_signals()
    _connect_user_signals()
    _connect_payment_signals()
    _connect_comment_signals()
