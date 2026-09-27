# syntax=docker/dockerfile:1.7
# The dictation's voice (spec 2026-09-27-kokoro-voice-design §4.1): Kokoro-82M behind a small FastAPI
# app, internal to the compose network (no published port). Stages: `base` (dependencies and, from the
# Kokoro plan's Task 3, the model), `test` (base + pytest, scripts/tts-pytest.sh mounts tts/ at /srv),
# `runtime` (the default target: base + the app).
FROM python:3.12-slim AS base
ENV PYTHONUNBUFFERED=1 PIP_DISABLE_PIP_VERSION_CHECK=1 \
    TTS_CACHE_DIR=/cache TTS_MODEL_DIR=/models TTS_RESPELL=/srv/respell.json
WORKDIR /srv
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

FROM base AS test
COPY requirements-dev.txt ./
RUN pip install --no-cache-dir -r requirements-dev.txt

FROM base AS runtime
COPY app app
COPY respell.json ./
VOLUME ["/cache"]
EXPOSE 8000
HEALTHCHECK --interval=10s --timeout=3s --start-period=120s --retries=5 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health').status==200 else 1)"
# --timeout-keep-alive 75: the root Dockerfile's reason (a pooled keep-alive socket racing the server's
# close); here the pooled client is the game server's httpx.Client.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--timeout-keep-alive", "75"]
