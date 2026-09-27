# ffmpeg for tools/audio/process.py, never on the host and never in the app image (UI5 Task 3).
# Final review I6: pinned, so a rebuild on another machine or in another month encodes the same
# bytes. process.py depends on this ffmpeg's specifics (the 7.1 filtergraph workaround, the native
# AAC encoder's 1024-sample priming, its overshoot headroom), and the e2e pins the loops' seams.
# - the base image by digest (python:3.12-slim, Debian 13 « trixie »);
# - Debian's packages from snapshot.debian.org at a fixed time, so every dependency is the same;
# - ffmpeg by its exact version, which process.py prints at each build and records in meta.gen.json.
# Changing a pin changes this file, hence run_docker.sh's image tag: the image is rebuilt.
FROM python:3.12-slim@sha256:2f17fc044b579bab302c2e8054d3a686e2cb9a83de48e70534b94cd8ebbe06a9
ARG SNAPSHOT=20260926T000000Z
ARG FFMPEG_VERSION=7:7.1.5-0+deb13u1
RUN printf '%s\n' \
      "Types: deb" \
      "URIs: http://snapshot.debian.org/archive/debian/${SNAPSHOT}" \
      "Suites: trixie trixie-updates" \
      "Components: main" \
      "Signed-By: /usr/share/keyrings/debian-archive-keyring.gpg" \
      "" \
      "Types: deb" \
      "URIs: http://snapshot.debian.org/archive/debian-security/${SNAPSHOT}" \
      "Suites: trixie-security" \
      "Components: main" \
      "Signed-By: /usr/share/keyrings/debian-archive-keyring.gpg" \
      > /etc/apt/sources.list.d/debian.sources \
 && apt-get -o Acquire::Check-Valid-Until=false update \
 && apt-get install -y --no-install-recommends "ffmpeg=${FFMPEG_VERSION}" \
 && rm -rf /var/lib/apt/lists/* \
 && ffmpeg -version | head -n 1
WORKDIR /work
