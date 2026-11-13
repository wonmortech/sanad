#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 Wonmor and Sanad contributors
# SPDX-License-Identifier: Apache-2.0
# Admin-side deploy tools. Day-to-day deploys run in GitHub Actions (.github/workflows/deploy.yml);
# this script is for the server owner, over an ordinary admin SSH login.
#
#   bash deploy/deploy.sh bootstrap [host]   install or update the server-managed files:
#                                            bin/receive, docker-compose.yml, the container
#   bash deploy/deploy.sh ship [host]        build clean origin/main locally and publish it
#                                            (the same path CI uses, for when Actions is down)
#   bash deploy/deploy.sh rollback [host]    switch back to the previous release
#   bash deploy/deploy.sh status [host]      print the live commit
set -euo pipefail

MODE="${1:-}"
HOST="${2:-dtwin}"
REMOTE_DIR="${REMOTE_DIR:-/opt/sanad-site}"
URL="${URL:-https://sanad.wonmor.io}"

fail() { echo "deploy: $*" >&2; exit 1; }
cd "$(dirname "$0")/.."

case "$MODE" in
  bootstrap)
    # docker-compose.yml and receive stay server-managed: CI can publish files, not change containers.
    tar -czf - deploy/receive.sh deploy/docker-compose.yml deploy/Caddyfile | ssh "$HOST" "set -euo pipefail
      mkdir -p '$REMOTE_DIR'; cd '$REMOTE_DIR'
      T=\$(mktemp -d); tar --no-same-owner -xzf - -C \"\$T\"
      install -d -m 755 bin conf releases
      install -m 755 -o root -g root \"\$T/deploy/receive.sh\" bin/receive
      [ -f conf/Caddyfile ] || install -m 644 \"\$T/deploy/Caddyfile\" conf/Caddyfile
      # One-time move from the old layout (site/ served directly) into releases/<sha>.
      if [ -d site ] && [ ! -e releases/current ]; then
        R=\$(cat site/version.txt 2>/dev/null || echo legacy); mv site \"releases/\$R\"; ln -sfn \"\$R\" releases/current
      fi
      rm -rf site.prev Caddyfile
      if ! cmp -s \"\$T/deploy/docker-compose.yml\" docker-compose.yml; then
        install -m 644 \"\$T/deploy/docker-compose.yml\" docker-compose.yml
        docker compose up -d --force-recreate --remove-orphans
      fi
      rm -rf \"\$T\"; echo \"bootstrap ok, live: \$(readlink releases/current)\""
    ;;
  ship)
    git fetch --quiet origin main
    [ -z "$(git status --porcelain)" ] || fail "uncommitted changes"
    SHA="$(git rev-parse HEAD)"
    [ "$SHA" = "$(git rev-parse origin/main)" ] || fail "only origin/main can be shipped (HEAD $(git rev-parse --short HEAD))"
    node tools/check-site.mjs
    printf '%s\n' "$SHA" > site/version.txt
    tar -czf - site -C deploy Caddyfile | ssh "$HOST" "$REMOTE_DIR/bin/receive deploy $SHA"
    for _ in $(seq 1 20); do
      if curl -fsS "$URL/version.txt" 2>/dev/null | grep -qx "$SHA"; then echo "live: $SHA -> $URL"; exit 0; fi
      sleep 3
    done
    fail "$URL/version.txt did not return $SHA (roll back: bash deploy/deploy.sh rollback $HOST)"
    ;;
  rollback|status)
    ssh "$HOST" "$REMOTE_DIR/bin/receive $MODE"
    ;;
  *)
    sed -n '2,11p' "$0"; exit 2
    ;;
esac
