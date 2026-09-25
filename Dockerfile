# Stage 1: build the SPA
FROM node:22 AS web
WORKDIR /work
COPY content/*.json content/
COPY web/package.json web/package-lock.json web/
RUN cd web && npm ci --ignore-scripts
COPY web web
RUN cd web && npm run build

# Stage 2: python runtime serving API + SPA
FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 PIP_DISABLE_PIP_VERSION_CHECK=1 \
    DISCORDE_DATA_DIR=/data DISCORDE_STATIC_DIR=/app/static \
    DISCORDE_CONTENT_DIR=/app/content SPACY_MODEL=fr_core_news_lg
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-fra \
 && rm -rf /var/lib/apt/lists/*
COPY server/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt \
 && python -m spacy download fr_core_news_lg
COPY server/app app
COPY content content
COPY --from=web /work/web/dist static
VOLUME ["/data"]
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=90s --retries=5 \
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
