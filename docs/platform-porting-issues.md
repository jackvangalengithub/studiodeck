# Platform port: issues and follow-up work

The live client sends platform table requests and repo actions in batches. Caddy
serves the static frontend and proxies the platform backend; `/api.php` returns 410.
Custom backend changes now live in `~/platform/apps/studiodeck/src/backend/php/custom/repos/`.
Full feature parity remains unfinished; unavailable operations have no SQLite fallback.
See [the operation inventory](platform-operation-coverage.md).

## Identity alignment completed (2026-09-28)

- All 10 imported tenant-200 `users` now have the same UUID as their auth `user`.
- The existing active account's old local UUID was replaced by its auth UUID.
  63 referencing rows were updated through the audited repository pipeline.
- Nine missing auth identities were created using their existing local UUIDs, with
  `active=false`. No credentials, authentication methods or tenant access were added.
  Existing tenant memberships/profiles were verified unchanged.
- The admin-only `users:alignIdentities` repo action defaults to a dry run. Applying
  requires `apply:true`; creating missing inactive identities additionally requires
  `create_missing:true`. Repeat application is a no-op after alignment.
- `users:ensureIdentity` takes no identity fields, derives the actor from platform
  authentication, and links that actor during the startup batch and project creation.
  Generic local-user creation/email updates reject mismatched auth identities.
- Membership/grant/profile record IDs identify those records; they are not person
  IDs. Existing historical audit records retain their original recorded identifiers.

Follow-ups: guest/client profiles, invitation redemption and deliberate activation
remain part of the access migration. Inactive identities cannot log in merely because
this migration created them. The self-link action is currently granted to `studioadmin`;
new guest/member profiles will need an explicit grant as their contracts are introduced.
Email-keyed legacy profiles/conversations also need reconciliation when an auth email
changes; UUID alignment alone does not rename those keys.

Operational findings: auth `avatar` must be an empty string rather than NULL; audit
source labels are limited to 20 characters. Auth writes and tenant writes use separate
transactions. If an alignment batch fails after creating an inactive auth identity,
that inactive account can remain; rerun the dry-run action before retrying. It receives
no credentials or tenant membership. Imported names/emails must also satisfy auth field
length constraints; do not truncate an email to make it fit.

## Concrete contract mismatches found

1. **Identity projection retained.** Domain foreign keys still reference local
   `users`. That table is now a projection of auth identities with matching IDs.
   Authentication and tenant access remain exclusively in the platform auth system.
2. **Tenant IDs and studio IDs are different types.** Tenant URLs are numeric IDs
   or platform slugs. `projects.studio_id` still points to a UUID `studios` row
   inside that tenant. The adapter keeps `studio.id` as the tenant URL ID and
   `studio.record_id` as the domain UUID. Setup creates the studio metadata row;
   when a tenant has multiple imported studio rows, `app/platform-studios.json`
   explicitly selects its domain UUID. Tenant 200 is mapped to Jackvangalen’s studio
   (`85c6b0cc-eb61-3adb-3b2c-8e0db4f63d25`), matching the previous studio URL.
   Bootstrap metadata/logos and project list/detail reads use that mapping; project
   creation writes that same studio ID. Missing configured records fail explicitly.
   Seven imported studio rows currently coexist in tenant 200. This configuration
   selects one for the UI; it does not migrate them into separate tenants or enforce
   backend row permissions. Old SQLite URLs are not platform tenant URLs.
3. **Membership/profile API exposure.** The current StudioDeck OpenAPI does not
   expose `tenant_user` CRUD or the master user directory. Framework membership
   services exist, but that does not make them callable through this app's contract.
   Studio-member management and the project-member picker are unavailable pending
   a scoped membership surface. The client does not grant itself a settings profile.
4. **`/whoami` profiles describe only the first tenant.** It returns all tenant
   identities, but only the first tenant's profiles. The UI conservatively displays
   other tenants as member workspaces. A per-tenant authoritative role response is
   needed to display administration controls correctly in every tenant.
5. **OpenAPI versus batch runtime.** Generated collection documentation describes
   `limit`/`offset` and string `selectList`; actual batch bodies use `page`/`nperpage`
   and array `selectList`. Updates dispatch with PATCH, although item OpenAPI also
   advertises PUT. The adapter follows the dispatcher and checks the schema snapshot.
6. **Dependency references are for read filters.** The supported grammar resolves
   `{{requestingId.entities[].field}}` from entity envelopes. Create responses have
   a top-level `id`, and arbitrary POST bodies are not substituted by that filter
   resolver. Compound creates use client-generated UUIDs and one transaction group.
7. **Warnings are significant.** Invalid/ungranted filter fields can be dropped;
   write fields can be stripped. The adapter reports warnings as errors. A write
   returning warnings may already have committed; it is not automatically retried.
8. **Tenant creation is a form route.** `/administrations` returns HTML and
   `/administrations/create` accepts form-encoded `companyname` and redirects.
   The client uses `/whoami.tenants` for JSON discovery and submits the existing
   creation form route. It does not invent an account batch endpoint.

9. **Boolean filter binding.** Error `925efd77bf5e` was traced to
   `projects.archived = false`: the platform repository binds non-integer parameters
   using `PDO::PARAM_STR`, converting PHP `false` to `''`, which PostgreSQL rejects
   for boolean columns. The client transport sends boolean filter literals as
   `"false"`/`"true"` (including nested filters and IN lists); mutation data retains
   JSON booleans. The backend follow-up is typed boolean binding. Failed parent
   reads also leave dependency tokens unresolved, producing secondary UUID errors
   in dependent requests; the original parent error is the cause in this case.

## Access configuration required before external-user rollout

The inspected `studioadmin` contract grants broad table/field access with `TRUE`
row filters. These are not the old application's project/client/guest rules.
The client cannot repair this contract. Client presentation and guest conversation
entry points currently report that their profiles/scopes need integration.

Use declarative tables/fields/operation-specific filters and supported `@fn` scope
functions. Retain all existing role behavior. Broad administrator grants must not
accidentally override a narrower row filter through OR-combined grants.

| Data | Project team | Presentation client | Conversation guest |
|---|---|---|---|
| `projects`, `project_details`, `iterations` | Studio-visible projects or project membership; writes require project membership | Active shared iteration context | Minimal granted conversation context |
| `project_members`, `project_team_contacts`, `contacts`, `project_client_members` | Scoped directory and authorized membership edits; preserve last member | Safe presentation directory fields | Existing conversation participants only |
| `assets`, `iteration_files`, `file_versions`, `document_pages`, `document_images` | Accessible iteration versions and ancestors | Versions available to the shared iteration | Exact attached versions |
| `presentation_slides`, `system_slides`, `slide_content`, `slide_layout`, `slide_sections`, `slide_groups`, `iteration_covers` | Read/edit project content, respecting locks | Visible shared presentation only | No general access |
| `slide_image_versions`, `slide_image_history`, `slide_media` | Accessible project media | Published media; exclude generation prompts | Granted attachments only |
| `budget_items`, `budget_choices`, `iteration_pack_items` | Scoped iteration budget/content | Shared budget; write only permitted choice fields | No general access |
| `budget_link_suggestions`, `budget_match_checks` | Project-team processing data | None | None |
| `comments`, `communication_threads`, `communication_audiences`, `communication_topics`, `communication_topic_history` | Authorized project conversations | Shared audience in accessible iterations | Exact granted roots and replies |
| `comment_attachments`, `comment_mentions`, `comment_reads` | Scope through comment; own read state | Same within client scope | Same within guest scope |
| `comment_confirmations`, `confirmation_budget_links` | Author/recipient decisions and protected derived amounts | Authorized recipient actions only | Only authorized conversation decisions |
| `open_questions`, `open_question_replies`, `checklist_threads` | Authorized iteration work | Published, non-dismissed questions | No unrelated questions |
| `shares`, `conversation_grants`, `conversation_grant_sources` | Authorized grant administration | Own effective access | Own effective access; no widening |
| `project_logos`, `project_testimonials`, `project_pins` | Project branding; own pins | Published branding/testimonials | Necessary conversation context only |
| `consistency_findings`, `consistency_runs`, `check_source_roles`, `check_image_text`, `check_page_previews`, `check_source_cache` | Project-team processing data | None | None |
| `person_profiles`, `studio_preferences`, `studio_logos`, `studio_pack_items`, `studio_pack_versions`, `studios` | Own preferences; authorized studio administration | Safe presentation branding/profile fields | Safe participant fields |
| Billing/coverage/access-plan records | Authorized summaries; no browser entitlement authority | Effective access only | Effective access only |
| `websites`, `website_assets`, `website_history`, `website_ai_usage` | Existing studio-admin restriction | None | None |
| `product_feedback`, `product_feedback_images` | Own submission; reviewer role separate from studio admin | Existing authenticated submission rules | Existing authenticated submission rules |

Do not expose legacy sessions, login tokens, invite/token hashes, encrypted credentials,
Stripe events, delivery queues, migration records, or arbitrary worker execution.
Retain framework retention and access-review policy tables.

Also enforce locked-iteration writes, coverage/archival rules, author attribution,
recipient-only confirmation, grant expiry/revocation/ancestry, protected budget
adjustments and server-owned entitlement fields. Client convenience checks are not
an authorization boundary. These rules must also hold for hand-written API calls.

## Existing framework mechanisms needing StudioDeck wiring

- **Files:** upload and download work. Uploads currently get `@user:<uploader>` gates
  (or the framework's `thread` gate), and the HTTP request cannot assign arbitrary
  gates. `UserFileService::setRequiredRights()` exists server-side and the custom `assets:attachUpload` action now validates ownership, derives
  metadata server-side, checks project membership/iteration locks, links versions and
  re-gates files. Nine real database assertions pass. The frontend upload path still
  needs to call this action; current frontend uploads are
  therefore readable by the uploader, not automatically by colleagues/clients.
  Add a linking action/workflow that validates ownership and sets gates on the
  narrowest appropriate entity (`file_versions`/attachment scope where needed).
  Do not grant all project files merely because a guest can read its project name.
- **Upload size:** the guide's 25 MiB per-file limit conflicts with this app's
  32 MiB JSON body limit after base64 encoding. The client currently permits
  23 MiB total per upload, up to 25 files, to leave framing headroom. Increase the
  body limit or provide streaming multipart uploads to reach the nominal limit.
- **Processing:** workflow, OCR/conversion, LLM, quota and queue infrastructure exist.
  StudioDeck extraction-to-slides/budget, reprocessing, consistency, question
  generation, matching, image edits and generated motion are not configured as
  callable pipelines. The UI reports them unavailable; it does not write fake jobs.
  Iteration copying does not enqueue consistency processing.
- **Notifications:** dispatcher, queued email and preferences exist. StudioDeck
  event types, defaults, templates and delivery-time revocation checks still need
  wiring. Posting a message saves it and explicitly reports that email is not sent.
- **Confirmations:** ordinary table writes exist, but the recipient decision plus
  exactly-once protected budget adjustment needs an atomic server operation with
  concurrency/idempotency checks. Decision actions remain unavailable.
- **Retention/permanent deletion:** schedules and pruners exist. StudioDeck expiry,
  notices, dependent cleanup and stored-file deletion need integration. Permanent
  project deletion remains unavailable rather than deleting only the project row.
- **Invitations/revocation:** invitation send/redeem is missing. Share and inherited
  guest access changes need scoped server behavior and notification reconciliation.
- **Branding/uploads in complex forms:** avatar and logo uploads use userfiles;
  file-bearing slide/template/testimonial forms still need attachment integration.
  File-backed starting-pack copies are explicitly refused before record writes.

## Missing integrations identified by the platform capability guide

- Stripe checkout/portal/subscription changes, Stripe-format signature verification,
  reconciliation and authoritative entitlements. Basic project creation itself is
  supported and does not create a pretend paid entitlement.
- Drive-specific connector/manifest, list/import/disconnect; reuse existing OAuth,
  token refresh and encrypted credentials. Google sign-in is not Drive consent.
- Website rendering/preview, publication artifacts/releases, restore/export and
  per-tenant domains/TLS. Website draft tables already support CRUD; the current
  editor is unavailable because its rendering/publishing contract is not ported.
- Invitations and legacy magic-link/password-reset behavior. Use existing platform
  login methods; passkey registration routes are present in the OpenAPI.
- Project ZIP/PDF rendering, thumbnails/page previews and stored-file deletion.

## Client follow-ups and practical limits

These are adapter/UI gaps, not claims that table CRUD is missing:

- Client/guest destination discovery and the external views must be connected once
  the platform profiles and exact iteration/thread scopes are supplied.
- Communication presently assembles the selected iteration. Cross-iteration
  conversation history, rich attention summaries, slide thumbnails and the full
  linked-thread/grant behavior still need completion against the scoped contract.
- Preview comparison (`changes`/previous budget totals) is not yet reconstructed;
  current presentation records are loaded, but historical comparison is empty.
- AI job progress/cancellation, dismissal and retry must be mapped to app run records
  and configured platform workflows rather than reviving the old `jobs` table.
- Complex concurrent edits (membership last-member checks, budget hierarchy changes,
  template revisions, locked state) need authoritative server invariants. Client
  preflight reads cannot make compare-and-write checks atomic.
- Atomic client changes are capped at 100 subrequests before sending, including
  iteration copies. Larger copies need a platform workflow or a deliberate larger
  transaction limit; they are not split into partially committed batches.
- No old SQLite data or files were imported. Full role-matrix testing remains to be run with provisioned guest/client accounts.

## Verification performed

Node tests exercise protocol framing, coalescing, partial failures, warning handling,
no write retries, identity bootstrapping, schema-valid view projections, clamped
pagination/dependencies, project transactions and identity FK bridging, budget ranges,
slide visibility, text starting packs and cache/navigation isolation.

Playwright exercises the actual served UI with controlled platform HTTP responses:
project tabs, no inactive-tab reads, pin creation and the project-creation wizard.
Unauthenticated live smoke checks cover `/whoami`, platform login/assets, the retired
API and shell routes. These do not establish authenticated server authorization,
actual transaction rollback, OAuth callback behavior or payment/AI integrations.


Additional migration verification: 27 database identity assertions cover imported-ID
migration, inactive creation, first-login projection, spoofed actor rejection,
canonical CRUD guards, repeat application and unchanged credentials/memberships.
A real HTTP batch through the frontend proxy verifies `users:ensureIdentity`, the
identity-dependent preferences filter and non-admin maintenance denial. The full
platform raw-SQL and rights-override guards pass. Browser regression checks still
use controlled API responses; they do not certify all external-user access rules.


## Project view loading and covers (2026-09-28)

The project-list adapter previously hard-coded `has_cover:false` and omitted the cover
key. Rendering also looked up each image again, and file ancestry was loaded one parent
generation at a time. These are fixed: cover metadata, page/crop previews, generated
variants and history arrive in the initial graph. A scoped, rights-checked
`projects:readView` custom repo action completes pagination server-side so the browser
uses one JSON batch for each project list/tab load. See [the loading contract](data-loading.md).
The current tab stays visible until the next view and its images are prepared.

Verified against real tenant data: all four active-project covers resolve; each of the
seven project views uses one batch on a project with 35 slides and 40 files. The tested
cover returns HTTP 200. A live browser run confirms four loaded covers, all 30
presentation images decoded, no unresolved placeholders, and exactly one tab batch.
Regression tests also cover selected variants/page crops,
server-side pagination, scope/rights, delayed images, failed reads and rapid tab changes.

## Filtering follow-up (2026-09-28)

- Grid search, category/archive selection, member lookup and communication list
  filtering now run server-side. Slide type filtering is deliberately local.
- Communication status is a tenant PostgreSQL function exposed through the normal
  filter DSL. Thread search, actor-specific attention and root pagination currently
  run in the custom repo over rights-scoped rows; large inboxes would benefit from
  SQL aggregation/pagination before loading thread dependencies. The existing
  50,000-row view limit still applies and fails explicitly.
- Imported `communication_topics.question_id` is a string and can refer to either
  the question UUID or legacy `question_key`. Status calculation handles both,
  scoped to the root's iteration; the underlying schema remains unchanged.
- **Platform migration runner bug:** `AbstractMigration.php` catches SQL
  errors and only prints them. A failed migration can be recorded as applied and
  the command can exit successfully. The first status-function migration exposed
  this through a UUID/varchar join mismatch. The corrected function was installed
  with a subsequent migration and verified through real repository queries. The
  shared runner was not changed; it should throw/rollback on statement failure.
- Studio Users now reads domain `studio_members`; adding/removing platform login
  access still needs the auth membership integration already tracked above.
