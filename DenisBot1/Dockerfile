FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        curl \
        ca-certificates \
        tini \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY pyproject.toml README.md ./
COPY src ./src
COPY migrations ./migrations
COPY deploy ./deploy
COPY knowledge ./knowledge

RUN pip install --upgrade pip && pip install .

RUN useradd --create-home --uid 10001 botuser \
    && mkdir -p /app/logs /app/runtime \
    && chown -R botuser:botuser /app

USER botuser

ENV PYTHONPATH=/app/src \
    LOG_DIR=/app/logs

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["python", "-m", "avaterra_bot"]
