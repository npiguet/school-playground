# F5-TTS on CPU with a French fine-tune (RASPIAUDIO/F5-French-MixedSpeakers-reduced).
FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir torch==2.8.0 torchaudio==2.8.0 --index-url https://download.pytorch.org/whl/cpu \
 && pip install --no-cache-dir "f5-tts==1.1.22" soundfile
WORKDIR /work
