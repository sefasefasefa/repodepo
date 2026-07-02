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
            name='Device',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                ('device_id', models.CharField(max_length=64, unique=True)),
                ('fingerprint', models.CharField(blank=True, db_index=True, default='', max_length=64)),
                ('user_agent', models.TextField(blank=True, default='')),
                ('screen', models.CharField(blank=True, default='', max_length=32)),
                ('timezone', models.CharField(blank=True, default='', max_length=64)),
                ('lang', models.CharField(blank=True, default='', max_length=16)),
                ('platform', models.CharField(blank=True, default='', max_length=64)),
                ('interaction_count', models.IntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('last_seen_at', models.DateTimeField(auto_now=True)),
                ('user', models.ForeignKey(blank=True, null=True, on_delete=models.deletion.SET_NULL,
                                           related_name='devices', to=settings.AUTH_USER_MODEL)),
            ],
            options={'db_table': 'devices'},
        ),
        migrations.CreateModel(
            name='DeviceInteraction',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                ('kind', models.CharField(
                    choices=[
                        ('view', 'View'), ('watch', 'Watch chunk'), ('complete', 'Completed'),
                        ('like', 'Liked'), ('bookmark', 'Bookmarked'), ('share', 'Shared'),
                    ], max_length=20)),
                ('weight', models.FloatField(default=1.0)),
                ('seconds', models.IntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('device', models.ForeignKey(on_delete=models.deletion.CASCADE,
                                             related_name='interactions', to='devices.device')),
                ('video', models.ForeignKey(on_delete=models.deletion.CASCADE,
                                            related_name='device_interactions', to='videos.video')),
            ],
            options={'db_table': 'device_interactions', 'ordering': ['-created_at']},
        ),
        migrations.AddIndex(
            model_name='deviceinteraction',
            index=models.Index(fields=['device', '-created_at'], name='dev_int_dev_created_idx'),
        ),
        migrations.AddIndex(
            model_name='deviceinteraction',
            index=models.Index(fields=['video'], name='dev_int_video_idx'),
        ),
    ]
