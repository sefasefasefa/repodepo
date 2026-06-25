from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('videos', '0002_moderation_fields'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='AIModel',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                ('kind', models.CharField(
                    choices=[('category', 'Category Predictor'), ('content', 'Content Profiler')],
                    max_length=20, unique=True)),
                ('version', models.IntegerField(default=0)),
                ('sample_count', models.IntegerField(default=0)),
                ('last_trained_at', models.DateTimeField(blank=True, null=True)),
                ('state', models.JSONField(blank=True, default=dict)),
                ('is_enabled', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={'db_table': 'ai_models'},
        ),
        migrations.CreateModel(
            name='TrainingEvent',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                ('event_type', models.CharField(
                    choices=[
                        ('category_assigned', 'Category Assigned'),
                        ('video_view', 'Video View'),
                        ('watch_progress', 'Watch Progress'),
                        ('engagement', 'Engagement'),
                    ], max_length=30)),
                ('payload', models.JSONField(blank=True, default=dict)),
                ('status', models.CharField(
                    choices=[
                        ('pending', 'Pending Review'), ('approved', 'Approved (in training set)'),
                        ('rejected', 'Rejected'), ('auto', 'Auto-applied'),
                    ], default='pending', max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('reviewed_at', models.DateTimeField(blank=True, null=True)),
                ('video', models.ForeignKey(blank=True, null=True, on_delete=models.deletion.CASCADE,
                                            related_name='ai_events', to='videos.video')),
                ('user', models.ForeignKey(blank=True, null=True, on_delete=models.deletion.SET_NULL,
                                           related_name='ai_events', to=settings.AUTH_USER_MODEL)),
                ('reviewed_by', models.ForeignKey(blank=True, null=True, on_delete=models.deletion.SET_NULL,
                                                  related_name='reviewed_ai_events', to=settings.AUTH_USER_MODEL)),
            ],
            options={'db_table': 'ai_training_events', 'ordering': ['-created_at']},
        ),
        migrations.AddIndex(
            model_name='trainingevent',
            index=models.Index(fields=['status', '-created_at'], name='ai_te_status_created_idx'),
        ),
        migrations.AddIndex(
            model_name='trainingevent',
            index=models.Index(fields=['event_type'], name='ai_te_event_type_idx'),
        ),
        migrations.CreateModel(
            name='CategoryPrediction',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                ('confidence', models.FloatField(default=0.0)),
                ('model_version', models.IntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('applied', models.BooleanField(default=False)),
                ('dismissed', models.BooleanField(default=False)),
                ('video', models.ForeignKey(on_delete=models.deletion.CASCADE,
                                            related_name='category_predictions', to='videos.video')),
                ('suggested_category', models.ForeignKey(on_delete=models.deletion.CASCADE,
                                                          related_name='predictions', to='videos.category')),
            ],
            options={
                'db_table': 'ai_category_predictions',
                'ordering': ['-confidence', '-created_at'],
                'unique_together': {('video', 'suggested_category', 'model_version')},
            },
        ),
    ]
