#!/bin/sh
set -eu
php -d memory_limit=256M /app/scripts/worker.php &
worker_pid=$!
php -d memory_limit=256M -d upload_max_filesize=30M -d post_max_size=128M -d max_file_uploads=20 -S 0.0.0.0:8080 -t /app/public /app/public/router.php &
web_pid=$!
trap 'kill "$worker_pid" "$web_pid" 2>/dev/null || true' INT TERM EXIT
wait "$web_pid"
