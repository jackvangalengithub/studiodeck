FROM caddy:2
COPY public/ /srv/
COPY docker/Caddyfile /etc/caddy/Caddyfile
EXPOSE 8080
