#!/usr/bin/env bash
#
# Runs a ForexRadar backfill (Mastercard + Visa) in Docker, copies db/ back,
# validates additions-only, commits and pushes, then cleans up.
#
# Usage: ./scripts/docker-backfill-mastercard.sh [--days=N] [--minutes=N]
# Defaults: --days=365  --minutes=30

set -euo pipefail

readonly IMAGE_NAME="forexradar-backfill"
readonly CONTAINER_NAME="forexradar-backfill-run"
readonly REPO_URL="https://github.com/avishj/ForexRadar"
readonly PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

DURATION_MINUTES=30
BACKFILL_DAYS=20

for arg in "$@"; do
  case "$arg" in
    --days=*)    BACKFILL_DAYS="${arg#*=}" ;;
    --minutes=*) DURATION_MINUTES="${arg#*=}" ;;
    *) echo "Unknown argument: $arg" >&2; exit 1 ;;
  esac
done

log()   { echo "[$(date '+%H:%M:%S')] $*"; }
warn()  { echo "[$(date '+%H:%M:%S')] WARN: $*" >&2; }
error() { echo "[$(date '+%H:%M:%S')] ERROR: $*" >&2; }

BUILD_CTX="$(mktemp -d)"

cleanup() {
  rm -rf "$BUILD_CTX"
  docker rm  -f "$CONTAINER_NAME" 2>/dev/null || true
  docker rmi -f "$IMAGE_NAME"     2>/dev/null || true
  log "Container and image removed."
}
trap cleanup EXIT

if ! command -v docker &>/dev/null; then
  error "Docker not found."; exit 1
fi
if ! docker info &>/dev/null 2>&1; then
  error "Docker daemon is not running."; exit 1
fi

docker rm -f "$CONTAINER_NAME" 2>/dev/null || true

log "Duration: ${DURATION_MINUTES}m | Days: ${BACKFILL_DAYS}"

# Single-quoted heredoc: ${VAR} expressions expand at runtime from -e env vars.
cat > "$BUILD_CTX/entrypoint.sh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

git clone --depth=1 --no-tags "${REPO_URL}" /app
cd /app
bun install --ignore-scripts

bunx playwright install firefox --with-deps

Xvfb :99 -screen 0 1512x984x24 -ac +extension GLX +render -noreset &
XVFB_PID=$!
sleep 2

echo "[DOCKER] Running backfill: all providers, days=${BACKFILL_DAYS}, timeout=${DURATION_MINUTES}m"

EXIT_CODE=0
timeout "${DURATION_MINUTES}m" \
  bash -c 'cd /app/backend && exec bun backfill --days='"${BACKFILL_DAYS}" \
  || EXIT_CODE=$?

if   [ "$EXIT_CODE" -eq 124 ]; then
  echo "[DOCKER] Stopped after ${DURATION_MINUTES}-minute timeout."
elif [ "$EXIT_CODE" -ne 0 ]; then
  echo "[DOCKER] Backfill exited with code ${EXIT_CODE}."
else
  echo "[DOCKER] Backfill completed."
fi

kill "$XVFB_PID" 2>/dev/null || true
EOF

chmod +x "$BUILD_CTX/entrypoint.sh"

cat > "$BUILD_CTX/Dockerfile" <<'EOF'
FROM debian:bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive
ENV DISPLAY=:99

RUN apt-get update && apt-get install -y \
      xvfb git curl gpg ca-certificates unzip \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Google Chrome (for Mastercard headed mode)
RUN curl -fsSL https://dl.google.com/linux/linux_signing_key.pub \
      | gpg --dearmor -o /usr/share/keyrings/google-chrome.gpg \
    && echo "deb [signed-by=/usr/share/keyrings/google-chrome.gpg] http://dl.google.com/linux/chrome/deb/ stable main" \
         > /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update && apt-get install -y google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:$PATH"

COPY entrypoint.sh /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
EOF

log "Building image (Chrome + Bun) ..."
docker build --no-cache --platform linux/amd64 -t "$IMAGE_NAME" "$BUILD_CTX"

log "Running container ..."
docker run \
  --name "$CONTAINER_NAME" \
  --platform linux/amd64 \
  --shm-size="2g" \
  -e REPO_URL="$REPO_URL" \
  -e DURATION_MINUTES="$DURATION_MINUTES" \
  -e BACKFILL_DAYS="$BACKFILL_DAYS" \
  "$IMAGE_NAME"

log "Copying db/ from container ..."
docker cp "$CONTAINER_NAME:/app/db/." "$PROJECT_ROOT/db/"

log "Validating changes ..."
git -C "$PROJECT_ROOT" add db/

NUMSTAT="$(git -C "$PROJECT_ROOT" diff --cached --numstat -- db/ 2>/dev/null || true)"

if [ -z "$NUMSTAT" ]; then
  warn "No changes — already up to date. Nothing to commit."
  git -C "$PROJECT_ROOT" reset HEAD -- db/ 2>/dev/null || true
  exit 0
fi

ADDED=$(  echo "$NUMSTAT" | awk '{sum += $1} END {print sum+0}')
DELETED=$(echo "$NUMSTAT" | awk '{sum += $2} END {print sum+0}')

log "Diff: +${ADDED} additions, -${DELETED} deletions"

if [ "$DELETED" -gt 0 ]; then
  error "Validation FAILED — ${DELETED} line(s) deleted. Aborting."
  git -C "$PROJECT_ROOT" reset HEAD -- db/ 2>/dev/null || true
  exit 1
fi

git -C "$PROJECT_ROOT" commit \
  -m "data: backfill contd $(date '+%Y-%m-%d') [+${ADDED} lines]" -s \
  && git -C "$PROJECT_ROOT" push

log "Done. +${ADDED} lines committed and pushed."
