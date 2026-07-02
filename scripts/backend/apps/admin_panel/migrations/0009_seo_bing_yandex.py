from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('admin_panel', '0008_emailcampaign'),
    ]

    operations = [
        migrations.AddField(
            model_name='seosettings',
            name='bing_verification',
            field=models.CharField(default='', max_length=200),
        ),
        migrations.AddField(
            model_name='seosettings',
            name='yandex_verification',
            field=models.CharField(default='', max_length=200),
        ),
    ]
