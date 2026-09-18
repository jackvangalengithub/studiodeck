#!/bin/sh
set -eu
php webhook-worker.php &
worker=$!
php -S 0.0.0.0:8200 router.php &
server=$!
trap 'kill "$worker" "$server" 2>/dev/null || true; exit 0' TERM INT
while kill -0 "$worker" 2>/dev/null && kill -0 "$server" 2>/dev/null; do sleep 1 & wait $! || true; done
kill "$worker" "$server" 2>/dev/null || true
exit 1
