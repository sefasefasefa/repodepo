from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('videos', '0013_add_guest_like_count'),
    ]

    operations = [
        migrations.AddField(
            model_name='watchhistory',
            name='pause_count',
            field=models.IntegerField(default=0),
        ),
        migrations.AddField(
            model_name='watchhistory',
            name='seek_count',
            field=models.IntegerField(default=0),
        ),
        migrations.AddField(
            model_name='watchhistory',
            name='replay_count',
            field=models.IntegerField(default=0),
        ),
        migrations.AddField(
            model_name='watchhistory',
            name='quality_changes',
            field=models.IntegerField(default=0),
        ),
        migrations.AddField(
            model_name='watchhistory',
            name='last_position',
            field=models.IntegerField(default=0),
        ),
        migrations.AddField(
            model_name='watchhistory',
            name='session_count',
            field=models.IntegerField(default=1),
        ),
    ]
