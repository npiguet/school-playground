# ffmpeg for tools/audio/process.py, never on the host and never in the app image (UI5 Task 3).
FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /work
