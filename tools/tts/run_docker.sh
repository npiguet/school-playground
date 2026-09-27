#!/usr/bin/env bash
# TTS bake-off (tools/tts/README.md): each candidate engine runs in its own throwaway CPU-only container
# (image discorde-tts-<candidate>, built from tools/tts/<candidate>/Dockerfile); nothing is installed on
# the host. Model weights are kept in the discorde-tts-cache volume between runs.
#
#   tools/tts/run_docker.sh bake <piper|kokoro|chatterbox|xtts|f5> [voice ...]
#   tools/tts/run_docker.sh post        # ffmpeg atempo stretches, image sizes, index.html
#   tools/tts/run_docker.sh round2-bake # round 2, Kokoro only; then round2-post (kokoro/index.html)
#
# One heavy run at a time: it holds the machine-wide Playwright lock (scripts/lib.sh), like
# tools/audio. Timing approximates the 8-core server: 8 threads, pinned to one logical CPU of each of
# 8 physical cores (on SMT hosts where siblings are numbered 2k, 2k+1).
set -eu
HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO=$(cd "$HERE/../.." && (pwd -W 2>/dev/null || pwd))
# shellcheck source=../../scripts/lib.sh
source "$HERE/../../scripts/lib.sh"
CPUS=${TTS_CPUSET:-0,2,4,6,8,10,12,14}
CACHE_VOLUME=discorde-tts-cache

image_for() {
  local tag
  tag=discorde-tts-$1:$(sha256sum "$HERE/$1/Dockerfile" | cut -c1-12)
  docker image inspect "$tag" >/dev/null 2>&1 || docker build -t "$tag" "$REPO/tools/tts/$1" >&2
  echo "$tag"
}

case "${1:-}" in
  bake)
    cand=$2
    shift 2
    image=$(image_for "$cand")
    with_playwright_lock docker run --rm --cpuset-cpus "$CPUS" \
      -e TTS_THREADS=8 -e OMP_NUM_THREADS=8 -e MKL_NUM_THREADS=8 \
      -e HF_HOME=/cache/hf -e TTS_HOME=/cache/tts -e TTS_CACHE=/cache -e PYTHONUNBUFFERED=1 \
      -v "$CACHE_VOLUME:/cache" -v "$REPO:/work" -w /work "$image" python tools/tts/bake.py "$cand" "$@"
    ;;
  post)
    # Image sizes, for the index: unpacked on disk, as `docker images` shows it (image inspect's .Size
    # is the compressed content size under Docker Desktop's containerd store).
    sizes="{"
    for cand in piper kokoro chatterbox xtts f5; do
      tag=discorde-tts-$cand:$(sha256sum "$HERE/$cand/Dockerfile" | cut -c1-12)
      size=$(docker images --format '{{.Size}}' "$tag")
      sizes="$sizes\"$cand\": \"${size:-?}\", "
    done
    mkdir -p "$HERE/../../assets/tts-bakeoff/results"
    echo "${sizes%, }}" >"$HERE/../../assets/tts-bakeoff/results/images.json"
    # ffmpeg from tools/audio's pinned image.
    audio=discorde-audio-tools:$(sha256sum "$REPO/tools/audio/Dockerfile" | cut -c1-12)
    docker image inspect "$audio" >/dev/null 2>&1 || docker build -t "$audio" "$REPO/tools/audio"
    with_playwright_lock docker run --rm -v "$REPO:/work" -w /work "$audio" python tools/tts/post.py
    ;;
  round2-bake)
    # Round 2, Kokoro only (round2.py): punctuation phrasings, voice blends, slower paces.
    image=$(image_for kokoro)
    with_playwright_lock docker run --rm --cpuset-cpus "$CPUS" \
      -e TTS_THREADS=8 -e OMP_NUM_THREADS=8 -e MKL_NUM_THREADS=8 \
      -e HF_HOME=/cache/hf -e PYTHONUNBUFFERED=1 \
      -v "$CACHE_VOLUME:/cache" -v "$REPO:/work" -w /work "$image" python tools/tts/round2.py bake
    ;;
  round2-post)
    audio=discorde-audio-tools:$(sha256sum "$REPO/tools/audio/Dockerfile" | cut -c1-12)
    docker image inspect "$audio" >/dev/null 2>&1 || docker build -t "$audio" "$REPO/tools/audio"
    with_playwright_lock docker run --rm -v "$REPO:/work" -w /work "$audio" python tools/tts/round2.py post
    ;;
  *)
    sed -n '2,9p' "$0" >&2
    exit 2
    ;;
esac
