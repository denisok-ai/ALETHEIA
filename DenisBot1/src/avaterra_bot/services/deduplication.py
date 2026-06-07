"""
@file: deduplication.py
@description: Антидубли публикаций - нормализация, MinHash-сигнатура, Jaccard-сходство и ключевые слова
@dependencies: datasketch
@created: 2026-05-07
"""

from __future__ import annotations

import re
import unicodedata
from collections import Counter
from dataclasses import dataclass, field
from typing import Iterable

import numpy as np
from datasketch import MinHash

DEFAULT_NUM_PERM = 128
DEFAULT_SHINGLE_SIZE = 3
DEFAULT_KEYWORD_TOP_N = 25
MIN_TOKEN_LENGTH = 3

_TOKEN_RE = re.compile(r"[\w\-]+", re.UNICODE)
_URL_RE = re.compile(r"https?://\S+|t\.me/\S+", re.UNICODE)
_NON_LETTER_RE = re.compile(r"[^\w\s\-]", re.UNICODE)

# Минимальный набор русских стоп-слов; не претендует на полноту,
# но достаточен для устранения шума при сравнении постов.
RU_STOPWORDS: frozenset[str] = frozenset(
    {
        "и",
        "в",
        "во",
        "не",
        "что",
        "он",
        "на",
        "я",
        "с",
        "со",
        "как",
        "а",
        "то",
        "все",
        "она",
        "так",
        "его",
        "но",
        "да",
        "ты",
        "к",
        "у",
        "же",
        "вы",
        "за",
        "бы",
        "по",
        "только",
        "ее",
        "мне",
        "было",
        "вот",
        "от",
        "меня",
        "еще",
        "нет",
        "о",
        "из",
        "ему",
        "теперь",
        "когда",
        "даже",
        "ну",
        "вдруг",
        "ли",
        "если",
        "уже",
        "или",
        "ни",
        "быть",
        "был",
        "него",
        "до",
        "вас",
        "нибудь",
        "опять",
        "уж",
        "вам",
        "ведь",
        "там",
        "потом",
        "себя",
        "ничего",
        "ей",
        "может",
        "они",
        "тут",
        "где",
        "есть",
        "надо",
        "ней",
        "для",
        "мы",
        "тебя",
        "их",
        "чем",
        "была",
        "сам",
        "чтоб",
        "без",
        "будто",
        "чего",
        "раз",
        "тоже",
        "себе",
        "под",
        "будет",
        "ж",
        "тогда",
        "кто",
        "этот",
        "того",
        "потому",
        "этого",
        "какой",
        "совсем",
        "ним",
        "здесь",
        "этом",
        "один",
        "почти",
        "мой",
        "тем",
        "чтобы",
        "нее",
        "сейчас",
        "были",
        "куда",
        "зачем",
        "всех",
        "никогда",
        "можно",
        "при",
        "наконец",
        "два",
        "об",
        "другой",
        "хоть",
        "после",
        "над",
        "больше",
        "тот",
        "через",
        "эти",
        "нас",
        "про",
        "всего",
        "них",
        "какая",
        "много",
        "разве",
        "три",
        "эту",
        "моя",
        "впрочем",
        "хорошо",
        "свою",
        "этой",
        "перед",
        "иногда",
        "лучше",
        "чуть",
        "том",
        "нельзя",
        "такой",
        "им",
        "более",
        "всегда",
        "конечно",
        "всю",
        "между",
    }
)


def _normalize(text: str) -> str:
    text = unicodedata.normalize("NFKC", text or "")
    text = text.lower()
    text = _URL_RE.sub(" ", text)
    text = _NON_LETTER_RE.sub(" ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _tokens(text: str) -> list[str]:
    raw = _TOKEN_RE.findall(_normalize(text))
    return [
        t for t in raw
        if len(t) >= MIN_TOKEN_LENGTH and t not in RU_STOPWORDS and not t.isdigit()
    ]


def _shingles(tokens: list[str], size: int) -> list[str]:
    if len(tokens) < size:
        return [" ".join(tokens)] if tokens else []
    return [" ".join(tokens[i : i + size]) for i in range(len(tokens) - size + 1)]


def extract_keywords(text: str, top_n: int = DEFAULT_KEYWORD_TOP_N) -> list[str]:
    """Простая частотная экстракция ключевых слов, без внешних API."""
    tokens = _tokens(text)
    if not tokens:
        return []
    counter = Counter(tokens)
    return [token for token, _ in counter.most_common(top_n)]


def build_minhash(
    text: str,
    num_perm: int = DEFAULT_NUM_PERM,
    shingle_size: int = DEFAULT_SHINGLE_SIZE,
) -> MinHash:
    """Сгенерировать MinHash-сигнатуру по шинглам нормализованного текста."""
    tokens = _tokens(text)
    shingles = _shingles(tokens, shingle_size)
    mh = MinHash(num_perm=num_perm)
    for shingle in shingles:
        mh.update(shingle.encode("utf-8"))
    return mh


def serialize_minhash(mh: MinHash) -> bytes:
    """Сериализация для хранения в БД (bytea)."""
    return bytes(mh.hashvalues.tobytes())


def deserialize_minhash(payload: bytes, num_perm: int = DEFAULT_NUM_PERM) -> MinHash:
    """Восстановить MinHash из сериализованного буфера."""
    mh = MinHash(num_perm=num_perm)
    if not payload:
        return mh
    dtype = mh.hashvalues.dtype
    expected_size = num_perm * dtype.itemsize
    if len(payload) != expected_size:
        raise ValueError(
            f"unexpected minhash payload size: got {len(payload)}, expected {expected_size}"
        )
    mh.hashvalues = np.frombuffer(payload, dtype=dtype).copy()
    return mh


def keyword_overlap(a: Iterable[str], b: Iterable[str]) -> float:
    """Жаккард по множествам ключевых слов."""
    set_a = set(a)
    set_b = set(b)
    if not set_a and not set_b:
        return 0.0
    union = set_a | set_b
    if not union:
        return 0.0
    return len(set_a & set_b) / len(union)


@dataclass(frozen=True)
class PostFingerprint:
    """Слепок поста для антидубль-проверок."""

    minhash: MinHash
    keywords: tuple[str, ...]
    normalized_length: int


def fingerprint(text: str) -> PostFingerprint:
    tokens = _tokens(text)
    return PostFingerprint(
        minhash=build_minhash(text),
        keywords=tuple(extract_keywords(text)),
        normalized_length=len(tokens),
    )


@dataclass
class DuplicateMatch:
    """Информация о найденном близком дубле."""

    reference_id: str
    minhash_similarity: float
    keyword_overlap: float


@dataclass
class DuplicateCheckResult:
    """Итог сравнения поста с историей публикаций."""

    is_duplicate: bool
    matches: list[DuplicateMatch] = field(default_factory=list)
    reason: str | None = None

    @property
    def best_match(self) -> DuplicateMatch | None:
        if not self.matches:
            return None
        return max(self.matches, key=lambda m: m.minhash_similarity)


@dataclass
class HistoricalFingerprint:
    """Запись из истории публикаций для проверки на дубли."""

    reference_id: str
    minhash: MinHash
    keywords: tuple[str, ...]


class DuplicateChecker:
    """Проверка нового поста против последних опубликованных постов.

    Алгоритм многоуровневый:
    1. MinHash + Jaccard по шинглам - быстрая лексическая проверка.
    2. Жаккард по множеству ключевых слов - грубая семантическая проверка.
    3. Если порог по любому уровню превышен - пост признается дублем.
    """

    def __init__(
        self,
        jaccard_threshold: float = 0.55,
        keyword_threshold: float = 0.7,
    ) -> None:
        if not 0 < jaccard_threshold <= 1:
            raise ValueError("jaccard_threshold must be in (0, 1]")
        if not 0 < keyword_threshold <= 1:
            raise ValueError("keyword_threshold must be in (0, 1]")
        self.jaccard_threshold = jaccard_threshold
        self.keyword_threshold = keyword_threshold

    def check(
        self,
        candidate: PostFingerprint,
        history: Iterable[HistoricalFingerprint],
    ) -> DuplicateCheckResult:
        matches: list[DuplicateMatch] = []
        is_duplicate = False
        reason: str | None = None
        candidate_keywords = set(candidate.keywords)
        for item in history:
            similarity = candidate.minhash.jaccard(item.minhash)
            overlap = keyword_overlap(candidate_keywords, item.keywords)
            if similarity > 0 or overlap > 0:
                matches.append(
                    DuplicateMatch(
                        reference_id=item.reference_id,
                        minhash_similarity=similarity,
                        keyword_overlap=overlap,
                    )
                )
            if similarity >= self.jaccard_threshold:
                is_duplicate = True
                reason = "minhash_similarity"
                break
            if overlap >= self.keyword_threshold:
                is_duplicate = True
                reason = "keyword_overlap"
                break
        return DuplicateCheckResult(
            is_duplicate=is_duplicate,
            matches=sorted(
                matches,
                key=lambda m: m.minhash_similarity,
                reverse=True,
            ),
            reason=reason,
        )
