#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TIZEN_DIR="$(dirname "$SCRIPT_DIR")"
REPO_DIR="$(dirname "$TIZEN_DIR")"

# Load local env if available
if [ -f "$TIZEN_DIR/.env.local" ]; then
  # shellcheck source=/dev/null
  set -a && source "$TIZEN_DIR/.env.local" && set +a
fi

IMAGE="${TIZEN_IMAGE:-bitchord-tizen-cli:6.1}"

CMD="${1:-help}"
shift || true

log() { printf '\033[1;34m[tizen.sh]\033[0m %s\n' "$*"; }

# Check docker
if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required to run the Tizen CLI container." >&2
  exit 1
fi

mkdir -p "$TIZEN_DIR/certs" "$TIZEN_DIR/dist" "$TIZEN_DIR/.tizen-data"

log "Executing '$CMD' in Tizen CLI container ($IMAGE)..."

docker run --rm -it \
  --platform linux/amd64 \
  -v "$REPO_DIR:/repo" \
  -v "$TIZEN_DIR:/repo/tizen" \
  -e TV_IP="${TV_IP:-}" \
  -e CERT_PROFILE="${CERT_PROFILE:-BitChord}" \
  -e CERT_AUTHOR_PASSWORD="${CERT_AUTHOR_PASSWORD:-change-me}" \
  -p 9223:9223 \
  "$IMAGE" "$CMD" "$@"

