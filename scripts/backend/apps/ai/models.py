from django.conf import settings
from django.db import models
from apps.videos.models import Video, Category


class AIModel(models.Model):
    """Singleton-per-kind registry holding a model's serialized state.

    Two kinds initially:
      - 'category' : predicts a Category for a Video from title/description/tags.
      - 'content'  : aggregates per-video viewer-engagement signal so the
                     admin panel can surface "popular / on-trend" videos.
    """
    KIND_CHOICES = [
        ('category', 'Category Predictor'),
        ('content', 'Content Profiler'),
    ]
    kind = models.CharField(max_length=20, choices=KIND_CHOICES, unique=True)
    version = models.IntegerField(default=0)
    sample_count = models.IntegerField(default=0)
    last_trained_at = models.DateTimeField(null=True, blank=True)
    # state: kind-specific payload.
    #   category: { categories: [{id, name, term_freq:{w:int}, total:int}], doc_freq:{w:int}, doc_total:int }
    #   content : { videos: { "<id>": {views:int, watch_sec:int, likes:int, ...} } }
    state = models.JSONField(default=dict, blank=True)
    is_enabled = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'ai_models'

    def __str__(self):
        return f"{self.kind} v{self.version} ({self.sample_count} samples)"


class TrainingEvent(models.Model):
    """Stream of signals coming from the site (views, likes, manual category
    assignments…). The admin can review and approve/reject each one. Approved
    events feed into the next training run."""
    EVENT_TYPES = [
        ('category_assigned', 'Category Assigned'),
        ('video_view', 'Video View'),
        ('watch_progress', 'Watch Progress'),
        ('engagement', 'Engagement'),
    ]
    STATUS_CHOICES = [
        ('pending', 'Pending Review'),
        ('approved', 'Approved (in training set)'),
        ('rejected', 'Rejected'),
        ('auto', 'Auto-applied'),
    ]
    event_type = models.CharField(max_length=30, choices=EVENT_TYPES)
    video = models.ForeignKey(Video, on_delete=models.CASCADE, related_name='ai_events', null=True, blank=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='ai_events')
    payload = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='reviewed_ai_events')

    class Meta:
        db_table = 'ai_training_events'
        ordering = ['-created_at']
        indexes = [models.Index(fields=['status', '-created_at']), models.Index(fields=['event_type'])]

    def __str__(self):
        return f"{self.event_type}#{self.id} [{self.status}]"


class CategoryPrediction(models.Model):
    """A prediction surfaced by the trained category model for a video that
    hasn't been categorised yet. Admin can apply it (sets video.category) or
    dismiss it."""
    video = models.ForeignKey(Video, on_delete=models.CASCADE, related_name='category_predictions')
    suggested_category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name='predictions')
    confidence = models.FloatField(default=0.0)  # 0..1
    model_version = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    applied = models.BooleanField(default=False)
    dismissed = models.BooleanField(default=False)

    class Meta:
        db_table = 'ai_category_predictions'
        ordering = ['-confidence', '-created_at']
        unique_together = ('video', 'suggested_category', 'model_version')
