# syntax=docker/dockerfile:1.7
# The dictation's voice (spec 2026-09-27-kokoro-voice-design §4.1): Kokoro-82M behind a small FastAPI
# app, internal to the compose network (no published port). Stages: `base` (the model and the
# dependencies), `test` (base + pytest, scripts/tts-pytest.sh mounts tts/ at /srv), `runtime` (the default
# target: base + the app).
FROM python:3.12-slim AS base
ENV PYTHONUNBUFFERED=1 PIP_DISABLE_PIP_VERSION_CHECK=1 \
    TTS_CACHE_DIR=/cache TTS_MODEL_DIR=/models TTS_RESPELL=/srv/respell.json
# Kokoro-82M v1.0 (Kokoro plan Task 3, verdict onnx-direct: app/kokoro.py): the ONNX export and the voices
# (kokoro-onnx release model-files-v1.0), and the model's config.json for its phoneme vocabulary, each
# checked against the sha256 the parity proof measured (tools/tts/parity.json). Before the pip layer, so
# a dependency change does not download the model again.
ADD --checksum=sha256:7d5df8ecf7d4b1878015a32686053fd0eebe2bc377234608764cc0ef3636a6c5 \
    https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx /models/kokoro-v1.0.onnx
ADD --checksum=sha256:bca610b8308e8d99f32e6fe4197e7ec01679264efed0cac9140fe9c29f1fbf7d \
    https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin /models/voices-v1.0.bin
ADD --checksum=sha256:5abb01e2403b072bf03d04fde160443e209d7a0dad49a423be15196b9b43c17f \
    https://huggingface.co/hexgrad/Kokoro-82M/resolve/main/config.json /models/config.json
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
