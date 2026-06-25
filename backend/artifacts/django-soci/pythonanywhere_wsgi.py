"""
PythonAnywhere WSGI configuration template.

Setup steps on PythonAnywhere:
1) Open a Bash console:
     git clone https://github.com/sefasefasefa/Prnhub.git ~/Prnhub
     cd ~/Prnhub/artifacts/django-soci
     mkvirtualenv --python=python3.10 prnhub-venv
     pip install -r requirements.txt
     python manage.py migrate
     python manage.py collectstatic --noinput
     python manage.py createsuperuser   # opsiyonel

2) Web tab > Add a new web app > Manual configuration > Python 3.10.

3) Source code:        /home/YOURUSER/Prnhub/artifacts/django-soci
   Working directory:  /home/YOURUSER/Prnhub/artifacts/django-soci
   Virtualenv:         /home/YOURUSER/.virtualenvs/prnhub-venv

4) WSGI file: bu dosyanın icindekini kopyala, YOURUSER kismini kendi
   kullanici adin ile degistir, sonra Reload tusuna bas.

5) Static / Media mapping (Web sekmesi > Static files):
     URL: /static/   Path: /home/YOURUSER/Prnhub/artifacts/django-soci/staticfiles
     URL: /media/    Path: /home/YOURUSER/Prnhub/artifacts/django-soci/media
"""

import os
import sys

USER = 'YOURUSER'  # <-- BURAYI DEGISTIR
PROJECT = f'/home/{USER}/Prnhub/artifacts/django-soci'

if PROJECT not in sys.path:
    sys.path.insert(0, PROJECT)

os.environ['DJANGO_SETTINGS_MODULE'] = 'config.settings'
os.environ['DEBUG'] = 'False'
os.environ['ALLOWED_HOSTS'] = f'{USER}.pythonanywhere.com,.pythonanywhere.com'
os.environ['CSRF_TRUSTED_ORIGINS'] = f'https://{USER}.pythonanywhere.com,https://*.pythonanywhere.com'
os.environ['SECRET_KEY'] = 'CHANGE-ME-TO-A-LONG-RANDOM-STRING'

from django.core.wsgi import get_wsgi_application  # noqa: E402

application = get_wsgi_application()
