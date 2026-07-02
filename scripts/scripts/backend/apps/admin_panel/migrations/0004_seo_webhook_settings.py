from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('admin_panel', '0003_paymentgateway'),
    ]

    operations = [
        migrations.CreateModel(
            name='SeoSettings',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False)),
                ('site_title', models.CharField(default='Prnhbbbb', max_length=200)),
                ('site_description', models.TextField(default='Video streaming ve sosyal platform')),
                ('keywords', models.TextField(default='video, streaming, creator, sosyal')),
                ('robots', models.CharField(default='index,follow', max_length=100)),
                ('og_image', models.TextField(default='')),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={'db_table': 'seo_settings'},
        ),
        migrations.CreateModel(
            name='WebhookSettings',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False)),
                ('is_enabled', models.BooleanField(default=False)),
                ('endpoint_url', models.TextField(default='')),
                ('secret', models.TextField(default='')),
                ('events', models.JSONField(default=list)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={'db_table': 'webhook_settings'},
        ),
    ]
