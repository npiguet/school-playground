# Coqui XTTS-v2 through the maintained coqui-tts fork (idiap), on CPU.
# transformers 5 dropped isin_mps_friendly, which coqui-tts 0.27.5 still imports: pinned below 5.
FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends build-essential && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir torch==2.8.0 torchaudio==2.8.0 --index-url https://download.pytorch.org/whl/cpu \
 && pip install --no-cache-dir "coqui-tts==0.27.5" "transformers==4.57.1" soundfile
# The CPML licence prompt, answered here (the model is only fetched for this personal bake-off).
ENV COQUI_TOS_AGREED=1
WORKDIR /work
