#!/usr/bin/env bash
# Server side of a deploy. Installed as /opt/sanad-site/bin/receive (root-owned) and bound to the
# CI deploy key with `restrict,command=...` in authorized_keys, so that key can do only this:
#   deploy <sha>   read a .tar.gz on stdin (site/ + Caddyfile), publish it as releases/<sha>, switch
#   rollback       point releases/current back to the previous release
#   status         print the live revision
# The switch is an atomic symlink swap; Caddy serves releases/current, so no request is dropped.
set -euo pipefail
umask 022

BASE="${SITE_BASE:-/opt/sanad-site}"
REL="$BASE/releases"
CONF="$BASE/conf"
CONTAINER="${SITE_CONTAINER:-sanad-site}"
KEEP=5
MAX_BYTES=$((300 * 1024 * 1024))

fail() { echo "receive: $*" >&2; exit 1; }

# Forced-command sessions pass the request in SSH_ORIGINAL_COMMAND; an admin shell passes arguments.
if [ "$#" -eq 0 ]; then read -r -a ARGS <<< "${SSH_ORIGINAL_COMMAND:-}"; set -- "${ARGS[@]+"${ARGS[@]}"}"; fi
CMD="${1:-}"; SHA="${2:-}"

mkdir -p "$REL" "$CONF"
exec 9> "$BASE/.lock"
flock -w 120 9 || fail "another deploy is running"

swap() {
  ln -sfn "$1" "$REL/.current.tmp"
  mv -Tf "$REL/.current.tmp" "$REL/current"
  printf '%s\n' "$1" > "$BASE/REVISION"
}

apply_conf() {
  docker exec "$CONTAINER" caddy validate --config /etc/caddy/Caddyfile.next --adapter caddyfile >/dev/null 2>&1 || return 1
  mv -f "$CONF/Caddyfile.next" "$CONF/Caddyfile"
  docker exec "$CONTAINER" caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1
}

case "$CMD" in
  deploy)
    [[ "$SHA" =~ ^[0-9a-f]{40}$ ]] || fail "usage: deploy <40-char commit sha>"
    IN="$(mktemp -d "$REL/.in.XXXXXX")"
    trap 'rm -rf "$IN" "$CONF/Caddyfile.next"' EXIT
    head -c "$MAX_BYTES" | tar --no-same-owner --no-same-permissions -xzf - -C "$IN"
    [ -f "$IN/site/index.html" ] || fail "archive has no site/index.html"
    [ -f "$IN/Caddyfile" ] || fail "archive has no Caddyfile"
    [ "$(cat "$IN/site/version.txt" 2>/dev/null)" = "$SHA" ] || fail "site/version.txt does not match $SHA"
    [ -z "$(find "$IN" ! -type f ! -type d -print -quit)" ] || fail "archive contains links or special files"
    chmod -R a+rX "$IN"

    NEW_CONF=0
    if ! cmp -s "$IN/Caddyfile" "$CONF/Caddyfile"; then
      cp "$IN/Caddyfile" "$CONF/Caddyfile.next"
      docker exec "$CONTAINER" caddy validate --config /etc/caddy/Caddyfile.next --adapter caddyfile >/dev/null 2>&1 \
        || fail "new Caddyfile is invalid, nothing changed"
      NEW_CONF=1
    fi

    PREV="$(readlink "$REL/current" 2>/dev/null || true)"
    rm -rf "${REL:?}/$SHA"
    mv "$IN/site" "$REL/$SHA"
    if [ -n "$PREV" ] && [ "$PREV" != "$SHA" ]; then printf '%s\n' "$PREV" > "$BASE/PREVIOUS"; fi
    swap "$SHA"
    if [ "$NEW_CONF" = 1 ] && ! apply_conf; then
      [ -n "$PREV" ] && swap "$PREV"
      fail "Caddy reload failed, rolled back to ${PREV:-nothing}"
    fi

    # Keep the newest releases plus whatever current and previous point to.
    KEEP_PREV="$(cat "$BASE/PREVIOUS" 2>/dev/null || true)"
    ls -1t "$REL" | grep -E '^[0-9a-f]{40}$' | tail -n +$((KEEP + 1)) | while read -r old; do
      if [ "$old" != "$SHA" ] && [ "$old" != "$KEEP_PREV" ]; then rm -rf "${REL:?}/$old"; fi
    done
    echo "live: $SHA"
    ;;
  rollback)
    PREV="$(cat "$BASE/PREVIOUS" 2>/dev/null || true)"
    { [ -n "$PREV" ] && [ -d "$REL/$PREV" ]; } || fail "no previous release to roll back to"
    CUR="$(readlink "$REL/current" 2>/dev/null || true)"
    swap "$PREV"
    if [ -n "$CUR" ]; then printf '%s\n' "$CUR" > "$BASE/PREVIOUS"; fi
    echo "rolled back to $PREV"
    ;;
  status)
    readlink "$REL/current" || fail "nothing is live"
    ;;
  *)
    fail "usage: deploy <sha> | rollback | status"
    ;;
esac
