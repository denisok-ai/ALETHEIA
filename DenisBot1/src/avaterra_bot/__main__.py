"""
@file: __main__.py
@description: Точка входа CLI; настраивает логирование и запускает бота
@dependencies: avaterra_bot.bot.main, avaterra_bot.logging_setup
@created: 2026-05-07
"""

from __future__ import annotations

import logging

from avaterra_bot.bot.main import main_polling
from avaterra_bot.logging_setup import setup_logging

logger = logging.getLogger(__name__)


def main() -> None:
    setup_logging()
    logger.info("avaterra_bot_starting")
    main_polling()


if __name__ == "__main__":
    main()
