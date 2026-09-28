#!/bin/sh
set -eu
# Platform mode only serves the frontend and proxies API requests.
exec php -d display_errors=0 -d log_errors=1 -d memory_limit=512M -d upload_max_filesize=100M -d post_max_size=128M -d max_file_uploads=20 -S 0.0.0.0:8080 -t /app/public /app/public/router.php
