"""
WSGI config for Soci Django project.

For PythonAnywhere deployment:
1. Set path to your project: /home/yourusername/soci
2. Set virtualenv: /home/yourusername/.virtualenvs/soci-venv
3. Update WSGI file content on PythonAnywhere dashboard

PythonAnywhere WSGI file example:
    import sys
    import os
    path = '/home/yourusername/soci'
    if path not in sys.path:
        sys.path.insert(0, path)
    os.environ['DJANGO_SETTINGS_MODULE'] = 'config.settings'
    os.environ['DEBUG'] = 'False'
    os.environ['ALLOWED_HOSTS'] = 'yourusername.pythonanywhere.com'
    os.environ['SECRET_KEY'] = 'your-production-secret-key'
    from django.core.wsgi import get_wsgi_application
    application = get_wsgi_application()
"""
import os
from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

application = get_wsgi_application()
