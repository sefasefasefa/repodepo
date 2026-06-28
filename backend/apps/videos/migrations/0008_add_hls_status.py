from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('videos', '0007_video_slug'),
    ]

    operations = [
        migrations.AddField(
            model_name='video',
            name='hls_status',
            field=models.CharField(
                max_length=20,
                default='none',
                choices=[
                    ('none',       'Dönüştürülmedi'),
                    ('pending',    'Bekliyor'),
                    ('processing', 'İşleniyor'),
                    ('ready',      'Hazır'),
                    ('failed',     'Başarısız'),
                ],
            ),
        ),
    ]
