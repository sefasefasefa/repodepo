from django.db import migrations, models
import re
import uuid


def tr_slugify(text):
    """Türkçe karakter dönüşümü ile slug oluştur."""
    TR_MAP = str.maketrans(
        'çğıöşüÇĞİÖŞÜ',
        'cgiosucgiosu'
    )
    text = text.translate(TR_MAP).lower()
    text = re.sub(r'[^a-z0-9\s-]', '', text)
    text = re.sub(r'[\s_]+', '-', text.strip())
    text = re.sub(r'-+', '-', text)
    return text[:200].strip('-') or 'video'


def generate_slugs(apps, schema_editor):
    Video = apps.get_model('videos', 'Video')
    used = set()
    for video in Video.objects.all().order_by('id'):
        base = tr_slugify(video.title or f'video-{video.id}')
        slug = base
        counter = 1
        while slug in used:
            slug = f'{base}-{counter}'
            counter += 1
        used.add(slug)
        video.slug = slug
        video.save(update_fields=['slug'])


class Migration(migrations.Migration):

    dependencies = [
        ('videos', '0006_video_uuid'),
    ]

    operations = [
        migrations.AddField(
            model_name='video',
            name='slug',
            field=models.SlugField(blank=True, db_index=True, max_length=255, null=True, unique=True),
        ),
        migrations.RunPython(generate_slugs, migrations.RunPython.noop),
    ]
