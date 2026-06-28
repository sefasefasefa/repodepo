from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('admin_panel', '0009_seo_bing_yandex'),
    ]

    operations = [
        migrations.CreateModel(
            name='HomeFilter',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('label', models.CharField(max_length=100)),
                ('icon', models.CharField(default='🎬', max_length=10)),
                ('type', models.CharField(choices=[('category', 'Kategori'), ('sort', 'Sıralama'), ('custom', 'Özel Kural')], default='sort', max_length=20)),
                ('category_id', models.IntegerField(blank=True, null=True)),
                ('sort_by', models.CharField(blank=True, choices=[('most_viewed', 'En Çok İzlenen'), ('most_liked', 'En Çok Beğenilen'), ('newest', 'En Yeni'), ('trending', 'Trend')], max_length=30, null=True)),
                ('rules', models.JSONField(blank=True, default=dict)),
                ('order', models.IntegerField(default=0)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'db_table': 'home_filters',
                'ordering': ['order', 'id'],
            },
        ),
    ]
