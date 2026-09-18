FROM php:8.3-cli-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends \
    libsqlite3-dev libzip-dev libpng-dev libjpeg62-turbo-dev libwebp-dev \
    libxml2-dev libcurl4-openssl-dev poppler-utils libreoffice-impress libreoffice-calc \
    python3 python3-fitz python3-pil tesseract-ocr tesseract-ocr-eng tesseract-ocr-nld fonts-dejavu \
    && docker-php-ext-configure gd --with-jpeg --with-webp \
    && docker-php-ext-install pdo_sqlite zip gd simplexml curl \
    && rm -rf /var/lib/apt/lists/*
RUN printf 'display_errors=Off\nlog_errors=On\nmemory_limit=512M\nupload_max_filesize=100M\npost_max_size=128M\nmax_file_uploads=20\n' > /usr/local/etc/php/conf.d/studiodeck.ini
WORKDIR /app
COPY app/ app/
COPY public/ public/
COPY scripts/worker.php scripts/worker.php
COPY scripts/initialize-slides.php scripts/initialize-slides.php
COPY scripts/repair-budget-properties.php scripts/repair-budget-properties.php
COPY scripts/extract_document.py scripts/extract_document.py
COPY scripts/start.sh scripts/start.sh
RUN mkdir -p /app/storage && chmod 700 /app/storage && chmod +x /app/scripts/start.sh
EXPOSE 8080
CMD ["/app/scripts/start.sh"]
