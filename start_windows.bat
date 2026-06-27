@echo off
chcp 65001 >nul
echo Hotpulse sunucusu baslatiliyor (port 8000)...

:: Scriptin bulunduğu klasörden backend'e geç (nerede olursa olsun çalışır)
cd /d "%~dp0backend"
python -m waitress --port=8000 --threads=32 --connection-limit=1000 --channel-timeout=120 config.wsgi:application
