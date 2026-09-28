# StudioDeck

StudioDeck serves static HTML, CSS and JavaScript through Caddy. Authentication,
files, data and application actions run in the separate `~/platform` backend.
Authenticated JSON operations use `/api/1.0/{tenant}/batch`.

## Run locally

Start the platform stack, then run:

```sh
docker compose up -d --build web
```

Open `http://localhost:8199/200/projects` with the current local `.env` settings.
`HOST_PORT` defaults to 8080; `PLATFORM_UPSTREAM` defaults to
`http://host.docker.internal:8101`. Sign in with a platform account.

The development override mounts `public/` and `docker/Caddyfile`, so frontend edits
are served immediately. The image contains Caddy and `public/`; it runs no PHP,
StudioDeck worker, PostgreSQL or PgBouncer. Platform database/worker services remain
required. The retired StudioDeck database volume is retained for recovery.

The optional MailCatcher/FakeStripe services are legacy integration fixtures; starting
them does not configure platform email or payments. The marketing service serves
`www/` separately.

## Architecture and migration

- [DOM rendering and XSS enforcement](docs/dom-rendering.md)
- [Data loading, batching and checks](docs/data-loading.md)
- [Identity alignment and remaining integration issues](docs/platform-porting-issues.md)
- [Operation coverage](docs/platform-operation-coverage.md)
- [Legacy feature reference](legacy/README-legacy.md)

`public/assets/platform/config.js` maps tenant IDs to imported studio records when a
tenant contains multiple studios. This display configuration does not grant access.

Custom backend behavior lives in the platform app's `custom/repos/` files and is
exposed through `repo:fn` actions. The framework supplies authentication, rights,
files and queue infrastructure. No legacy API fallback is used.

Migration is still in progress. Billing, guest invitations/access, AI pipelines,
Drive, website publishing and other workflows listed in the issue report still need
work. Legacy PHP in `app/` is retained as porting reference; retired entry points are
in `legacy/php-entrypoints/` and are not served. `/api.php` returns 410.

## Frontend checks

```sh
npm ci
npm test
node --test tests/test_platform.mjs tests/test_api_batch.mjs tests/test_data_layer.mjs
node scripts/platform-schema.mjs --check
PLAYWRIGHT_MODULE=/path/to/playwright CHROMIUM_PATH=/path/to/chrome \
  npm run test:browser:dom
```

The Docker build runs the DOM source guard and security regressions before packaging.
The browser suite uses controlled API responses against the served static frontend.
Platform database integration checks live in `~/platform/apps/studiodeck/tests/`.
