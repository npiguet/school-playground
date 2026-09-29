# Stage 1: build the SPA
FROM node:22 AS web
WORKDIR /work
COPY content/*.json content/
# UI5 (Ruling E16): the dialogue content the web bundle imports (lib/dialogue/content.ts).
COPY content/dialogue content/dialogue
COPY web/package.json web/package-lock.json web/
RUN cd web && npm ci --ignore-scripts
COPY web web
RUN cd web && npm run build

# Stage 2: python runtime serving API + SPA
FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 PIP_DISABLE_PIP_VERSION_CHECK=1 \
    DISCORDE_DATA_DIR=/data DISCORDE_STATIC_DIR=/app/static \
    DISCORDE_CONTENT_DIR=/app/content SPACY_MODEL=fr_dep_news_trf
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-fra \
 && rm -rf /var/lib/apt/lists/*
COPY server/requirements.txt ./requirements.txt
# The parser is spaCy's French transformer model (CamemBERT): on the game's texts it finds the
# subject of far more verbs, and far fewer wrong ones, than fr_core_news_lg (the Fil d'Ariane and the
# verb spotlight live on it). CPU-only torch first, so spacy-transformers does not pull the CUDA build.
RUN pip install --no-cache-dir -r requirements.txt \
 && pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu "torch>=2.4,<3" \
 && pip install --no-cache-dir "spacy-transformers>=1.3,<1.4" \
 && python -m spacy download fr_dep_news_trf
COPY server/app app
COPY content content
COPY --from=web /work/web/dist static
# The build stamp (GET /api/health, the lyre's credits): scripts/lib.sh, compose*.yaml and the
# README's `docker build` pass the short commit and the build day; without them it says "unknown".
# Last, so a new commit rebuilds only this layer.
ARG GIT_COMMIT=unknown
ARG BUILD_DATE=unknown
ENV DISCORDE_BUILD_COMMIT=$GIT_COMMIT DISCORDE_BUILD_DATE=$BUILD_DATE
VOLUME ["/data"]
EXPOSE 8080
# start-period: the server answers only once startup has (re-)annotated every text, which after an
# ANNOTATION_VERSION bump takes the transformer a few minutes on a small CPU.
HEALTHCHECK --interval=10s --timeout=3s --start-period=300s --retries=5 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8080/api/health').status==200 else 1)"
# uvicorn's default --timeout-keep-alive is 5s. There is no reverse proxy in front of this
# process (compose.yaml exposes it to browsers directly), and any HTTP/1.1 client that pools
# keep-alive sockets (browsers, and Node's http.Agent that Playwright's `request` fixture reuses
# across tests) can race a request against the server closing an idle socket right at that
# boundary: the client picks the pooled socket to send on at (or a few ms after) the same instant
# the server's timer fires transport.close(), and the write lands on a socket that is already
# closing -> "socket hang up" / ECONNRESET on an otherwise healthy server (root-caused in
# .superpowers/sdd/2026-09-24-ui3a-places-title-library-delphi/socket-hangup-report.md). Raising
# the timeout well past any realistic idle gap between two requests from the same client (75s,
# nginx's own long-standing default) doesn't remove the race in principle, but moves the boundary
# far outside the range either real players or the e2e suite ever idle for, so it's never reached.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080", "--timeout-keep-alive", "75"]
