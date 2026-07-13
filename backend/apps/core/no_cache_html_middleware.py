"""
index.html ve tüm HTML yanıtları için tarayıcı cache'ini devre dışı bırakır.
JS/CSS gibi hash'li asset'lar bu middleware'den etkilenmez (content-type: text/html değil).
Böylece her deployment'tan sonra tüm ziyaretçiler güncel index.html'i alır.
"""


class NoCacheHtmlMiddleware:
    """HTML yanıtlarına no-cache header ekler — WhiteNoise dahil."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        ct = response.get("Content-Type", "")
        if "text/html" in ct:
            response["Cache-Control"] = "no-cache, no-store, must-revalidate"
            response["Pragma"] = "no-cache"
            response["Expires"] = "0"
        return response
