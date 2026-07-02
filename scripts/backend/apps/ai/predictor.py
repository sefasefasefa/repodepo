"""Pure-Python category predictor (no external ML deps).

Approach: per-category term frequency table + cosine-ish similarity.
Designed to be retrainable in well under a second on thousands of videos and
to stay readable. Replace with scikit-learn later if needed.
"""
from __future__ import annotations
import math
import re
from collections import Counter, defaultdict
from typing import Iterable

_STOPWORDS = {
    # Turkish + English short stopwords (deliberately small)
    'the','a','an','and','or','of','to','in','for','on','at','is','it','this','that',
    've','ile','bir','bu','şu','ne','için','de','da','ki','mi','mı','mu','mü','en',
    'çok','az','ya','yok','var','olan','olur','olmak','şey','siz','ben','sen','biz',
}
_TOKEN_RE = re.compile(r"[\wÇĞİıÖŞÜçğıöşü]+", re.UNICODE)


def tokenize(text: str | None) -> list[str]:
    if not text:
        return []
    return [
        t for t in (m.group(0).lower() for m in _TOKEN_RE.finditer(text))
        if len(t) >= 3 and t not in _STOPWORDS and not t.isdigit()
    ]


def video_tokens(v) -> list[str]:
    """Tokens that describe a video for category modelling."""
    parts = [v.title or '', v.description or '']
    if isinstance(getattr(v, 'tags', None), list):
        parts.append(' '.join(str(t) for t in v.tags))
    return tokenize(' '.join(parts))


def train_category_state(videos: Iterable) -> dict:
    """Build a serialisable category-model state from approved (categorised) videos."""
    cat_acc: dict[int, dict] = {}
    doc_freq: Counter = Counter()
    doc_total = 0
    for v in videos:
        if not v.category_id:
            continue
        tokens = video_tokens(v)
        if not tokens:
            continue
        doc_total += 1
        for t in set(tokens):
            doc_freq[t] += 1
        c = cat_acc.setdefault(v.category_id, {
            'id': v.category_id,
            'name': v.category.name if v.category_id and v.category else '',
            'term_freq': defaultdict(int),
            'total': 0,
            'docs': 0,
        })
        for t in tokens:
            c['term_freq'][t] += 1
            c['total'] += 1
        c['docs'] += 1

    return {
        'categories': [
            {
                'id': c['id'],
                'name': c['name'],
                'term_freq': dict(c['term_freq']),
                'total': c['total'],
                'docs': c['docs'],
            }
            for c in cat_acc.values()
        ],
        'doc_freq': dict(doc_freq),
        'doc_total': doc_total,
    }


def _idf(doc_freq: dict, doc_total: int, word: str) -> float:
    return math.log((1 + doc_total) / (1 + doc_freq.get(word, 0))) + 1.0


def predict(state: dict, video) -> list[dict]:
    """Return a sorted list of {category_id, name, score} predictions in [0..1]."""
    cats = state.get('categories') or []
    if not cats:
        return []
    tokens = video_tokens(video)
    if not tokens:
        return []
    doc_freq = state.get('doc_freq') or {}
    doc_total = state.get('doc_total') or len(cats)

    # TF-IDF for the video.
    q_tf = Counter(tokens)
    q_vec = {w: (q_tf[w] / len(tokens)) * _idf(doc_freq, doc_total, w) for w in q_tf}
    q_norm = math.sqrt(sum(v * v for v in q_vec.values())) or 1.0

    out = []
    for c in cats:
        tf = c.get('term_freq') or {}
        total = c.get('total') or 1
        # category vector: tf / total * idf
        common = set(q_vec) & set(tf)
        if not common:
            continue
        dot = 0.0
        c_norm_sq = 0.0
        for w, qv in q_vec.items():
            cv = (tf.get(w, 0) / total) * _idf(doc_freq, doc_total, w)
            if w in tf:
                dot += qv * cv
            c_norm_sq += cv * cv  # over q's words is fine (approximation)
        c_norm = math.sqrt(c_norm_sq) or 1.0
        score = dot / (q_norm * c_norm)
        out.append({'category_id': c['id'], 'name': c['name'], 'score': round(score, 4)})

    out.sort(key=lambda x: x['score'], reverse=True)
    return out
