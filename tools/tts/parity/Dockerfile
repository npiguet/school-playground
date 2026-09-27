# Kokoro-82M parity proof (Kokoro plan, Task 1): the PyTorch package the user listened to in the
# bake-off (tools/tts/kokoro/Dockerfile) and the ONNX build (kokoro-onnx + onnxruntime), side by side.
FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends espeak-ng && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir torch==2.8.0 --index-url https://download.pytorch.org/whl/cpu \
 && pip install --no-cache-dir "kokoro==0.9.4" "misaki[en]==0.9.4" soundfile "kokoro-onnx==0.4.9" "onnxruntime==1.22.1"
WORKDIR /work
