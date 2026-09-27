# Kokoro-82M on CPU. French G2P goes through misaki's espeak fallback: espeak-ng from Debian.
FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends espeak-ng && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir torch==2.8.0 --index-url https://download.pytorch.org/whl/cpu \
 && pip install --no-cache-dir "kokoro==0.9.4" "misaki[en]==0.9.4" soundfile
WORKDIR /work
