import io
import math
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .summarizer import summarize

try:
    import pdfplumber
    _PDF_AVAILABLE = True
except ImportError:
    _PDF_AVAILABLE = False


def _extract_text(file_obj) -> tuple[str, int]:
    """Return (full_text, page_count). Raises ValueError on bad PDF."""
    if not _PDF_AVAILABLE:
        raise ValueError("pdfplumber kütüphanesi yüklü değil.")

    file_obj.seek(0)
    raw = file_obj.read()
    pages_text: list[str] = []

    with pdfplumber.open(io.BytesIO(raw)) as pdf:
        page_count = len(pdf.pages)
        for page in pdf.pages:
            t = page.extract_text()
            if t:
                pages_text.append(t.strip())

    full_text = "\n\n".join(pages_text)
    if not full_text.strip():
        raise ValueError("PDF'ten metin çıkarılamadı (taranmış görsel PDF olabilir).")

    return full_text, page_count


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def analyze_pdf(request):
    pdf_file = request.FILES.get("file")
    if not pdf_file:
        return Response({"error": "PDF dosyası gönderilmedi."}, status=400)

    if not pdf_file.name.lower().endswith(".pdf"):
        return Response({"error": "Sadece .pdf uzantılı dosyalar kabul edilir."}, status=400)

    max_mb = 20
    if pdf_file.size > max_mb * 1024 * 1024:
        return Response({"error": f"Dosya boyutu {max_mb} MB'ı geçemez."}, status=400)

    context = (request.data.get("context") or "").strip()

    try:
        full_text, page_count = _extract_text(pdf_file)
    except ValueError as exc:
        return Response({"error": str(exc)}, status=422)
    except Exception:
        return Response({"error": "PDF okunamadı. Dosyanın bozuk olmadığından emin olun."}, status=422)

    result = summarize(full_text, context=context)

    avg_wpm = 200
    reading_minutes = math.ceil(result.word_count / avg_wpm) if result.word_count else 0

    return Response({
        "summary": result.summary,
        "keyPoints": result.key_points,
        "topTerms": result.top_terms,
        "stats": {
            "pageCount": page_count,
            "wordCount": result.word_count,
            "sentenceCount": result.sentence_count,
            "readingMinutes": reading_minutes,
            "charCount": len(full_text),
        },
        "contextUsed": bool(context),
    })
