# Chatterbox Multilingual (Resemble AI) on CPU. chatterbox-tts pins torch 2.6.0: its CPU wheels first,
# so pip does not pull the CUDA ones.
FROM python:3.11-slim
RUN apt-get update && apt-get install -y --no-install-recommends build-essential && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir torch==2.6.0 torchaudio==2.6.0 --index-url https://download.pytorch.org/whl/cpu \
 && pip install --no-cache-dir "chatterbox-tts==0.1.7" soundfile
WORKDIR /work
