"""
Helper: Create superuser without interactive prompt.
Usage: python manage.py create_superuser_auto [--env=dev]

SECURITY: This command uses hardcoded credentials ONLY in --env=dev mode.
Default (prod) mode raises an error to prevent accidental insecure setup.
Use `python manage.py seed_data` for production-safe seeding.
"""
import os
from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth import get_user_model

User = get_user_model()


class Command(BaseCommand):
    help = 'Create superuser non-interactively (dev-only by default)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--env',
            default='prod',
            choices=['dev', 'prod'],
            help='Must be --env=dev to use predictable credentials (default: prod = error)',
        )

    def handle(self, *args, **options):
        if options['env'] != 'dev':
            raise CommandError(
                'create_superuser_auto uses hardcoded dev credentials and must '
                'only be run with --env=dev.\n'
                'For production admin setup, use: python manage.py seed_data\n'
                '(This produces a random admin password printed to stdout.)'
            )

        self.stdout.write(self.style.WARNING(
            '[DEV] create_superuser_auto: creating admin/admin123 — '
            'do NOT use in production.'
        ))

        if not User.objects.filter(username='admin').exists():
            admin = User(
                username='admin',
                email='admin@soci.local',
                display_name='Site Yöneticisi',
                role='admin',
                is_staff=True,
                is_superuser=True,
                is_verified=True,
            )
            admin.set_password('admin123')
            admin.generate_session_token()
            admin.save()
            self.stdout.write(self.style.SUCCESS('[DEV] Superuser created: admin / admin123'))
        else:
            self.stdout.write('Superuser already exists')
