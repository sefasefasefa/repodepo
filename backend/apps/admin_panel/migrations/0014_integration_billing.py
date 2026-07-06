from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('admin_panel', '0013_blockedip'),
    ]

    operations = [
        # Global billing settings singleton
        migrations.CreateModel(
            name='IntegrationBillingSettings',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('enabled', models.BooleanField(default=False)),
                ('default_charge_amount', models.IntegerField(default=0)),
                ('charge_on', models.CharField(
                    choices=[('upload', 'Her yükleme başına'), ('success', 'Yalnızca başarılı yükleme')],
                    default='success', max_length=20,
                )),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={'db_table': 'integration_billing_settings'},
        ),
        # Per-integration billing fields
        migrations.AddField(
            model_name='integrationconfig',
            name='charge_enabled',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='integrationconfig',
            name='charge_amount',
            field=models.IntegerField(default=0),
        ),
    ]
