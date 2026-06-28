"""
Context-aware extractive summarizer.

Algorithm:
  1. Tokenise text into sentences.
  2. Build a TF-IDF term-weight table across all sentences.
  3. Score each sentence by the sum of its term weights.
  4. Boost sentence scores when they contain user-supplied context terms.
  5. Select the top-N highest-scored sentences (preserving original order).
  6. Extract prominent key terms for the "key points" list.
"""
from __future__ import annotations
import re
import math
from collections import Counter, defaultdict
from typing import NamedTuple

# ---------------------------------------------------------------------------
# Turkish + English stop-words (deliberately minimal)
# ---------------------------------------------------------------------------
_STOPWORDS = {
    # English
    'the','a','an','and','or','of','to','in','for','on','at','is','it',
    'this','that','are','was','were','be','been','being','have','has','had',
    'do','does','did','will','would','could','should','may','might','shall',
    'from','with','by','as','but','not','if','so','yet','both','nor',
    # Turkish
    've','ile','bir','bu','şu','ne','için','de','da','ki','mi','mı','mu',
    'mü','en','çok','az','ya','yok','var','olan','olur','olmak','şey',
    'siz','ben','sen','biz','o','onlar','bunu','bunun','şunu','bunlar',
    'şunlar','bize','size','onlara','ise','ama','fakat','lakin','ancak',
    'her','hiç','bazı','birçok','tüm','hepsi','gibi','kadar','daha',
    'çünkü','sonra','önce','ile','üzere','itibaren','göre','karşı',
}

_SENTENCE_RE = re.compile(r'(?<=[.!?])\s+(?=[A-ZÇĞİÖŞÜa-zçğışöşü])')
_TOKEN_RE    = re.compile(r"[\wÇĞİıÖŞÜçğıöşü]+", re.UNICODE)


def _tokenize(text: str) -> list[str]:
    return [
        t for t in (m.group(0).lower() for m in _TOKEN_RE.finditer(text))
        if len(t) >= 3 and t not in _STOPWORDS and not t.isdigit()
    ]


def _split_sentences(text: str) -> list[str]:
    raw = _SENTENCE_RE.split(text.strip())
    sentences: list[str] = []
    for s in raw:
        s = s.strip()
        if len(s) > 20:          # skip very short fragments
            sentences.append(s)
    return sentences


class SummaryResult(NamedTuple):
    summary: str
    key_points: list[str]
    top_terms: list[str]
    sentence_count: int
    word_count: int


def summarize(
    text: str,
    context: str = "",
    summary_ratio: float = 0.25,
    max_sentences: int = 8,
    min_sentences: int = 3,
    max_key_points: int = 6,
) -> SummaryResult:
    """
    Returns a SummaryResult for the given text.

    :param text:          Full extracted document text.
    :param context:       Optional free-text hint about what the user cares about.
    :param summary_ratio: Fraction of sentences to include in the summary.
    :param max_sentences: Hard cap on summary sentences.
    :param min_sentences: Minimum sentences even for very short docs.
    :param max_key_points: Number of key-point bullets.
    """
    sentences = _split_sentences(text)
    if not sentences:
        return SummaryResult("", [], [], 0, 0)

    # ── TF-IDF ────────────────────────────────────────────────────────────
    sent_tokens: list[list[str]] = [_tokenize(s) for s in sentences]
    N = len(sentences)

    # document frequency
    df: Counter = Counter()
    for tokens in sent_tokens:
        df.update(set(tokens))

    # IDF
    idf: dict[str, float] = {
        term: math.log((N + 1) / (freq + 1)) + 1
        for term, freq in df.items()
    }

    # TF per sentence
    tf_table: list[dict[str, float]] = []
    for tokens in sent_tokens:
        c = Counter(tokens)
        total = max(len(tokens), 1)
        tf_table.append({t: c[t] / total for t in c})

    # Sentence score = sum(tf * idf) for each term
    base_scores: list[float] = []
    for tf in tf_table:
        score = sum(tf[t] * idf.get(t, 1.0) for t in tf)
        base_scores.append(score)

    # ── Context boost ─────────────────────────────────────────────────────
    ctx_tokens = set(_tokenize(context)) if context else set()
    scores: list[float] = []
    for i, score in enumerate(base_scores):
        if ctx_tokens:
            overlap = len(ctx_tokens & set(sent_tokens[i]))
            boost = 1.0 + 0.5 * overlap          # +50 % per matching term
            scores.append(score * boost)
        else:
            scores.append(score)

    # ── Position bias (first & last sentences matter more) ────────────────
    for i in range(min(2, N)):
        scores[i] *= 1.3
    if N > 3:
        scores[-1] *= 1.1

    # ── Select top sentences (preserve original order) ────────────────────
    target_n = max(min_sentences, min(max_sentences, round(N * summary_ratio)))
    ranked   = sorted(range(N), key=lambda i: scores[i], reverse=True)
    selected = sorted(ranked[:target_n])
    summary  = " ".join(sentences[i] for i in selected)

    # ── Key terms for top-term list ───────────────────────────────────────
    global_tf: Counter = Counter()
    for tokens in sent_tokens:
        global_tf.update(tokens)

    term_scores = {
        t: global_tf[t] * idf.get(t, 1.0)
        for t in global_tf
        if len(t) >= 4
    }
    if ctx_tokens:
        for t in ctx_tokens:
            if t in term_scores:
                term_scores[t] *= 2.0

    top_terms = [t for t, _ in sorted(term_scores.items(), key=lambda x: x[1], reverse=True)[:15]]

    # ── Key points: one sentence per top term cluster ─────────────────────
    used: set[int] = set()
    key_points: list[str] = []
    for term in top_terms:
        if len(key_points) >= max_key_points:
            break
        for i, tokens in enumerate(sent_tokens):
            if i in used:
                continue
            if term in tokens and len(sentences[i]) > 40:
                key_points.append(sentences[i])
                used.add(i)
                break

    word_count = len(_tokenize(text))

    return SummaryResult(
        summary=summary,
        key_points=key_points,
        top_terms=top_terms[:10],
        sentence_count=N,
        word_count=word_count,
    )
