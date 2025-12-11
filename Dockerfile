FROM python:3.11-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        libjpeg62-turbo-dev \
        zlib1g-dev \
        libpng-dev \
        libopenjp2-7-dev \
        libwebp-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt pyproject.toml ./
RUN python -m pip install --upgrade pip \
    && pip wheel --wheel-dir /wheels -r requirements.txt

FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV U2NET_HOME=/tmp/iconforge/models

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libjpeg62-turbo \
        zlib1g \
        libpng16-16 \
        libopenjp2-7 \
        libwebp7 \
        libglib2.0-0 \
        libgl1 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /wheels /wheels
RUN python -m pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir /wheels/*

COPY app ./app
COPY pyproject.toml requirements.txt ./

RUN useradd -m -u 1000 appuser \
    && mkdir -p "${U2NET_HOME}" /tmp/iconforge/temp \
    && chown -R appuser:appuser "${U2NET_HOME}" /tmp/iconforge

USER appuser

RUN python - <<'PY'
from pathlib import Path
from rembg import new_session

cache_dir = Path("${U2NET_HOME}")
cache_dir.mkdir(parents=True, exist_ok=True)
new_session("u2net")
PY

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
