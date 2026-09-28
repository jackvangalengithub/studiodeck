# Platform data loading

The live application serves static HTML/CSS/JS through Caddy (`docker/Caddyfile`).
`/api.php` returns 410. Retired PHP entry points are archived under
`legacy/php-entrypoints/`; the older `app/` handlers remain as porting references.
The frontend image contains no PHP or worker runtime.

The old StudioDeck PostgreSQL/PgBouncer containers are retired; the named volume
`studiodeck_postgres-data` is retained for recovery. Platform database and worker
services remain required.

Caddy forwards platform routes to `PLATFORM_UPSTREAM` (default
`http://host.docker.internal:8101`). Cookies, including refreshed JWT `Set-Cookie`
headers, pass through and browser requests stay on the application origin. Existing
local `/assets/` files are served directly; other assets are forwarded for framework
login pages. `/platform-assets/` remains a compatibility alias.

Use a platform tenant URL, for example `/200/projects`. Legacy 32-character studio
URLs are not tenant IDs and are not silently mapped to another workspace.

## Imported studio mapping

`public/assets/platform/config.js` maps platform tenant IDs to domain `studios.id`
values. The client imports this non-secret static configuration. Tenant
200 selects `85c6b0cc-eb61-3adb-3b2c-8e0db4f63d25` (Jackvangalen’s studio), matching
the earlier StudioDeck workspace. Change this mapping when deploying against a
different database; it does not assign permissions or alter backend data.

A tenant with one studio record needs no mapping. Multiple records require an
explicit mapping, and a configured missing/inaccessible record is an error rather
than a reason to select another studio or create a replacement. Metadata and logos
are fetched in the initial batch with filters; project lists and details are scoped
to that studio, and newly created projects reference it. Imported studios that need
separate access boundaries still need separate tenants or backend row filters.

## Client layers

- `public/assets/platform/transport.js`: platform wire framing, correlation, queue,
  read deduplication, per-call failures and rejected-field/filter warnings.
- `public/assets/platform/client.js`: identity bootstrap, selected-field queries,
  dependency graphs, complete view reads, client-side joins and project view assembly.
- `public/assets/platform/operations.js`, `communication.js`, `packs.js`: UI commands
  mapped to existing table endpoints. Compound changes use transaction groups.
- `public/assets/platform/media.js`: file/preview metadata indexed from view rows; URL
  resolution never fetches records.
- `public/assets/platform/files.js`: existing userfiles upload/download routes and
  file UUID lookups; no legacy binary API calls.
- `public/assets/data-layer.js`: application/view cache and navigation race handling.
  Its internal resource names are local cache keys, never outgoing API endpoints.

Identity comes from `/whoami`; tenant creation uses the existing form POST to
`/administrations/create`. Platform login, MFA and logout retain their dedicated
routes. Sessions, authentication roles and membership are not read from legacy tables.
The startup batch calls `users:ensureIdentity` with an empty body. The repo derives
the identity from the authenticated actor; dependent preference reads reference
`{{identity.entities[0].id}}`. The project-create transaction repeats this idempotent
check before inserting foreign keys. No browser-supplied ID/email establishes identity.
See the identity alignment and role configuration prerequisites in
[the porting issues](platform-porting-issues.md).

## Batch wire format

```json
[[
  {"id":"project","requestingId":"project","method":"QUERY","relative_url":"200/projects","body":"{\"selectList\":[\"id\",\"name\"],\"filter\":[\"id\",\"=\",\"PROJECT_UUID\"],\"page\":1,\"nperpage\":100}"},
  {"id":"iterations","requestingId":"iterations","method":"QUERY","relative_url":"200/iterations","body":"{\"selectList\":[\"id\",\"project_id\",\"number\"],\"filter\":[\"project_id\",\"IN\",\"{{project.entities[].id}}\"],\"page\":1,\"nperpage\":100}"}
]]
```

The outer request is `POST /api/1.0/{tenant}/batch`. Responses are matched by
`responseid`, not array position. A successful outer HTTP status does not imply
successful subrequests. Read entity envelopes retain `id`, `tablename`, and
`writablefields` metadata when normalized into UI rows.

Use recursive `AND`/`OR` filter triplets and selected fields as arrays. Ordering uses
table-qualified field names. Ordinary collection queries support `page`/`nperpage`;
the generic adapter follows `other.nextPage` when those are used outside view loading.

Project lists and project tabs use a single `QUERY` subrequest to
`200/projects:readView` inside the outer batch. Its body contains `project_id` (detail)
or `studio_id` (list), plus `queries` using the same IDs, collections, partial selects,
filters and dependency references as above. `client.js` supplies the graph;
`projects.php::publicapi_readView` completes each collection's pagination before
resolving dependencies and returns the original entity envelopes under
`other.results`. The client correlates these by response ID and joins them into UI data.

The repo action only reads permitted project-view collections. It adds project scopes
and keeps normal repository method, field and row checks enabled. Mutations, forward
references and unknown fields are refused; empty dependencies cannot become unscoped
reads. It accepts at most 64 queries and 50,000 total rows, failing explicitly rather
than truncating a view or starting more browser fetches. Framework pagination limits
are unchanged. The action is declared in the app's methods contract and OpenAPI.

Mutations use `POST`, `PATCH`, and `DELETE`. Client-generated UUIDs connect new
records in the same atomic group; create responses return a top-level `id`, not
an entity envelope usable by the read dependency grammar. No automatic mutation
retries. Independent writes stay separate. The client refuses atomic changes above
100 subrequests before sending them; this is a client safeguard, not a discovered
platform limit.

The OpenAPI table/field snapshot is checked with:

```sh
node scripts/platform-schema.mjs --check
# Refresh only this repository's snapshot after a backend contract change:
node scripts/platform-schema.mjs /home/jack/platform/apps/studiodeck/docs/api/openapi.json
```

## Loading behavior

Bootstrap loads identity, tenant-local studio metadata, the current profile,
preferences and logo metadata once per context. Project-list data is fetched only
on screens that use it. One project-tab click sends one JSON batch and one data fetch;
inactive tabs are not prefetched. Overview queries omit extraction text and use smaller
slide/file/budget projections, including the metadata required for cover images.
File ancestry and image variants are included in the initial view graph.

The current tab stays mounted and active until the new data and its preview images
are ready. Failed reads retain the old tab; superseded responses cannot replace a more
recent selection. The list similarly prepares its covers before rendering. Images are
fetched in parallel through rights-checked userfiles URLs and cached as decoded blobs.
These binary downloads are separate HTTP requests; rendering them causes no additional
JSON lookup batches. An unavailable preview stays unavailable without a fallback query
waterfall.

Caches are in-memory and isolated by user and tenant. Mutations invalidate affected
view snapshots. Context changes clear caches; obsolete responses cannot replace the
active view. Missing platform workflows fail explicitly with no legacy fallback.

## Checks

```sh
node --test tests/test_platform.mjs tests/test_api_batch.mjs tests/test_data_layer.mjs tests/test_routes.mjs tests/test_budget_math.mjs
PLAYWRIGHT_MODULE=/path/to/playwright CHROMIUM_PATH=/path/to/chrome \
  node --test tests/test_batch_browser.mjs
node scripts/platform-schema.mjs --check
```

Browser checks use controlled platform responses and the static Caddy frontend. They verify
actual browser requests, tab loading, pin writes and the project-creation wizard.
The old SQLite integration tests describe the retired backend and do not certify this
migration. Real database tests cover identity migration and project-upload guards. A live
authenticated batch smoke check covers identity linking, dependent preference reads
and maintenance-action denial. Full guest/client permission and concurrency coverage
still requires the profiles described in the issue report. No live payments, emails or
AI calls are made by these checks.
