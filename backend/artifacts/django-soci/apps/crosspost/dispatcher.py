"""Cross-post dispatcher. Network calls run inline with a short timeout.

The adapter pattern is intentionally generic: most adult tube sites do not
expose a public upload API, so the user supplies the upload endpoint URL
and credentials manually. We support three adapters:

* generic_webhook  — POSTs JSON {title, description, videoUrl, thumbnailUrl,
                                 username, apiKey} to upload_endpoint.
* multipart_form   — POSTs multipart/form-data with the same fields plus
                     optional file streaming (only when uploaded locally).
* manual           — records a job in 'skipped' state so the user can post
                     by hand from the dashboard.
"""
from __future__ import annotations

import json
from datetime import datetime
from typing import Iterable

from django.utils import timezone

from .models import CrossPostJob, CrossPostSite


def _try_import_requests():
    try:
        import requests  # type: ignore
        return requests
    except Exception:
        return None


def dispatch_for_video(video, user, site_ids: Iterable[int] | None = None):
    """Create + execute CrossPostJob rows for the video."""
    qs = CrossPostSite.objects.filter(user=user, enabled=True)
    if site_ids is not None:
        site_ids = [int(s) for s in site_ids if str(s).isdigit()]
        qs = qs.filter(id__in=site_ids)
    else:
        qs = qs.filter(auto_post=True)

    jobs = []
    for site in qs:
        job = CrossPostJob.objects.create(user=user, site=site, video=video,
                                          status='pending')
        _run_job(job)
        jobs.append(job)
    return jobs


def _run_job(job: CrossPostJob):
    job.status = 'running'
    job.attempts = (job.attempts or 0) + 1
    job.save(update_fields=['status', 'attempts'])

    site = job.site
    video = job.video

    if site.adapter == 'manual':
        job.status = 'skipped'
        job.response_text = 'manual adapter — kullanici tarafindan yapilacak'
        job.finished_at = timezone.now()
        job.save()
        return

    requests = _try_import_requests()
    if requests is None:
        job.status = 'failed'
        job.response_text = 'requests kutuphanesi yok'
        job.finished_at = timezone.now()
        job.save()
        return

    if not site.upload_endpoint:
        job.status = 'failed'
        job.response_text = 'upload_endpoint tanimsiz'
        job.finished_at = timezone.now()
        job.save()
        return

    payload = {
        'title': video.title,
        'description': video.description or '',
        'videoUrl': video.video_url or video.hls_url or '',
        'thumbnailUrl': video.thumbnail_url or '',
        'tags': video.tags or [],
        'username': site.username,
        'apiKey': site.api_key,
        'password': site.password,
    }
    headers = {'User-Agent': 'PrnhubCrossPoster/1.0'}
    if isinstance(site.extra_headers, dict):
        headers.update({str(k): str(v) for k, v in site.extra_headers.items()})

    try:
        if site.adapter == 'multipart_form':
            resp = requests.post(site.upload_endpoint, data=payload,
                                 headers=headers, timeout=20)
        else:  # generic_webhook
            headers['Content-Type'] = 'application/json'
            resp = requests.post(site.upload_endpoint,
                                 data=json.dumps(payload), headers=headers,
                                 timeout=20)
        job.response_code = resp.status_code
        job.response_text = (resp.text or '')[:2000]
        if 200 <= resp.status_code < 300:
            job.status = 'success'
            try:
                rj = resp.json()
                if isinstance(rj, dict):
                    job.remote_url = str(rj.get('url') or rj.get('remoteUrl') or '')[:500]
            except Exception:
                pass
        else:
            job.status = 'failed'
    except Exception as exc:  # noqa: BLE001
        job.status = 'failed'
        job.response_text = f'{type(exc).__name__}: {exc}'[:2000]
    finally:
        job.finished_at = timezone.now()
        job.save()


def test_login(site: CrossPostSite) -> tuple[bool, str, int | None]:
    """Best-effort login probe. Returns (ok, message, status_code)."""
    if site.adapter == 'manual':
        return True, 'manual mod — login gerekmiyor', None
    requests = _try_import_requests()
    if requests is None:
        return False, 'requests kutuphanesi yok', None

    target = site.login_endpoint or site.base_url
    if not target:
        return False, 'login_endpoint veya base_url tanimsiz', None

    payload = {
        'username': site.username,
        'password': site.password,
        'apiKey': site.api_key,
    }
    headers = {'User-Agent': 'PrnhubCrossPoster/1.0'}
    if isinstance(site.extra_headers, dict):
        headers.update({str(k): str(v) for k, v in site.extra_headers.items()})

    try:
        if site.login_endpoint:
            resp = requests.post(site.login_endpoint, json=payload,
                                 headers=headers, timeout=15)
        else:
            resp = requests.get(target, headers=headers, timeout=15)
        ok = 200 <= resp.status_code < 400
        return ok, (resp.text or '')[:500], resp.status_code
    except Exception as exc:  # noqa: BLE001
        return False, f'{type(exc).__name__}: {exc}', None
