FROM node:22-alpine AS checked
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY scripts/ scripts/
COPY tests/ tests/
COPY public/ public/
COPY Dockerfile ./
COPY docker/Caddyfile docker/Caddyfile
RUN npm test

FROM caddy:2
COPY --from=checked /app/public/ /srv/
COPY docker/Caddyfile /etc/caddy/Caddyfile
EXPOSE 8080
