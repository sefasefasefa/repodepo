import uuid
from django.db import migrations, models


def populate_uuids(apps, schema_editor):
    Video = apps.get_model('videos', 'Video')
    for video in Video.objects.filter(uuid__isnull=True):
        video.uuid = uuid.uuid4()
        video.save(update_fields=['uuid'])


class Migration(migrations.Migration):

    dependencies = [
        ('videos', '0005_add_moderation_status_to_videosubtitle'),
    ]

    operations = [
        migrations.AddField(
            model_name='video',
            name='uuid',
            field=models.UUIDField(null=True, editable=False),
        ),
        migrations.RunPython(populate_uuids, reverse_code=migrations.RunPython.noop),
        migrations.AlterField(
            model_name='video',
            name='uuid',
            field=models.UUIDField(default=uuid.uuid4, editable=False, unique=True, db_index=True),
        ),
    ]
