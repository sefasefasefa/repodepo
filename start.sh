#!/bin/bash
cd backend
exec gunicorn config.wsgi:application --config gunicorn.conf.py
