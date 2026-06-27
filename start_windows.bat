@echo off
chcp 65001 >nul
echo Hotpulse sunucusu baslatiliyor (port 8000)...
cd backend
python -m waitress --port=8000 --threads=8 --connection-limit=1000 --channel-timeout=120 config.wsgi:application
