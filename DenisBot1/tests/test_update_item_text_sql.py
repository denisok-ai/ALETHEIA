"""
@file: test_update_item_text_sql.py
@description: Регрессия asyncpg AmbiguousParameterError на NULL last_error ($7)
@dependencies: db.repositories.content
@created: 2026-08-18
"""

from __future__ import annotations

import inspect

from avaterra_bot.db.repositories.content import update_item_text


def test_update_item_text_casts_nullable_last_error_params():
    """NULL $7 без ::text валит запись text_ready (неделя 24.08 0/7)."""
    source = inspect.getsource(update_item_text)
    assert "$7::text" in source
    assert "$8::boolean" in source
