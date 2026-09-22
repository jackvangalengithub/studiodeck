# Studiodeck

A working first version of an interior designer's workspace and interactive client presentation. Vanilla JavaScript, CSS, HTML and PHP 8.3; SQLite through PDO. No Composer packages, frontend framework, bundler, or JavaScript installation is needed for the PHP app.

The hosted version is an explicitly labelled, in-memory pitch demo. **It does not run the PHP backend.** The real application is `public/`, `app/` and `scripts/worker.php`. Never point a production PHP server at `dist/`: that folder is the static demo.

## Run locally

Install PHP 8.3+ with `pdo_sqlite`, `fileinfo`, `zip`, `simplexml`, `gd` (JPEG/WebP), and `curl`. Install Python 3 with PyMuPDF and Pillow (`python3-fitz`, `python3-pil` on Debian), Tesseract with English and Dutch language data, and LibreOffice Impress/Calc. The Docker image includes these dependencies. LibreOffice renders PPT/PPTX slides to PDF; PyMuPDF extracts pages and visible image regions; Tesseract reads scans. `OCR_LANGUAGES` defaults to `eng+nld`.

Copy `.env.example` to `.env`. In one terminal, from this folder:

```sh
php -d display_errors=0 -d log_errors=1 -d memory_limit=512M -d upload_max_filesize=100M -d post_max_size=128M -S localhost:8080 -t public public/router.php
```

In another terminal:

```sh
php -d memory_limit=512M scripts/worker.php
```

Open http://localhost:8080 and request a sign-in link. With the default `APP_ENV=local` and `MAIL_TRANSPORT=log`, the single-use sign-in link is written to `storage/mail.log`. It is intentionally never returned by the unauthenticated API. Open that link and click **Open my studio**. The session lasts 14 days.

Then: **Create project → add client emails → drop files → review → preview → send to clients**. Client email addresses are saved but receive no message until you choose to share. A newly created project contains no sample budget or fabricated prices.

## Docker option

```sh
cp .env.example .env   # set HOST_PORT and APP_URL to the same port
docker compose up -d --build
```

The local `docker-compose.override.yml` mounts `app/`, `public/`, and `scripts/` read-only from your workspace, so local edits appear without rebuilding and older images cannot hide newer code. To run only the files packaged in the image, use `docker compose -f docker-compose.yml up -d --build`.

This runs two app containers from one image: `web` (PHP server) and `worker` (background processing). Both share `./storage`, so the database is on your machine. The local override also starts MailCatcher and FakeStripe. Use `docker compose logs -f` to follow output and `docker compose down` to stop. The PHP built-in web server is for development and demonstrations; deploy `public/` with your usual PHP web server and HTTPS for client use.

**Local email inbox: [http://localhost:1081](http://localhost:1081).** Both app containers override `MAIL_TRANSPORT` to `mail` and use `docker/local-mail.ini` to send PHP mail through msmtp to `mailcatcher:1025`. Sign-in links, client invitations, conversation notifications and billing emails all arrive in this inbox, regardless of their recipient address. No SMTP port is published to the host, and the inbox is bound to loopback. Set `MAILCATCHER_PORT` in `.env` to change the inbox port. MailCatcher is a temporary inbox; messages reset when it restarts.

After changing the mail setup, run `docker compose up -d --build web worker mailcatcher`. The base-only command (`docker compose -f docker-compose.yml up -d --build`) excludes local mail capture and uses your configured `MAIL_TRANSPORT`. Running PHP directly on the host still uses `.env` and defaults to log-only mail.

A single container (`docker build -t studiodeck . && docker run --rm -p 8080:8080 --env-file .env -v studiodeck-data:/app/storage studiodeck`) also works; `scripts/start.sh` then starts both processes.

## Workspace URLs

Workspace paths include the studio ID: `/{studioId}/projects`, `/{studioId}/projects/{projectId}`, and `/{studioId}/slide/{slideId}`. Query parameters preserve the selected iteration, tab, and slide's project. Refreshing, copying a workspace URL, and browser Back/Forward restore that view; recipients still need studio and project access. Switching studios changes the URL prefix. Search and archive filters are also preserved. Existing login links remain supported. Old bearer presentation links now require signing in with the invited email address.

The included PHP router authenticates pages and assets and authorizes project routes. In production, route **all requests, including `/assets/` and existing files**, through `public/router.php`. See [security and deployment requirements](docs/security-review.md) and the [Nginx configuration](docs/nginx-security.conf); Apache rewrite rules are included in `public/.htaccess`.

## One-time studio setup

- Set `APP_ENV=production` and `APP_URL` to your exact HTTPS application origin. Links are created from this configured origin, never an incoming Host header.
- Set `MAIL_TRANSPORT=mail`, a verified `MAIL_FROM`, and configure PHP's `mail()` transport on your server. The Docker image includes msmtp; configure its SMTP settings and PHP `sendmail_path` for your provider, or use a PHP host with a configured mail service. Without mail delivery, authenticated designers can still create links and send them manually; a failed send is reported accurately. Production sign-in requires working mail.
- Optionally restrict designer signup with comma-separated, lowercase `DESIGNER_EMAILS`. Otherwise any email verified by a magic link creates its own isolated studio.
- Set `OPENAI_API_KEY` to enable semantic document/visual analysis, grounded free-form budget chat and image edits. Models are configurable using `OPENAI_TEXT_MODEL` and `OPENAI_IMAGE_MODEL`. Keys stay on the server. Without a key, filename/text rules, structured cost imports, manual editing, palette extraction and a factual budget helper still work.
- Keep the worker running under your normal process manager. `php scripts/worker.php --once` handles one queued job and exits, which also permits scheduled operation.
- Set the web root to `public/`. Keep `.env`, application source, the database and mail log outside that web root. With Nginx, explicitly deny dotfiles and execute only intended PHP entry points.

## What works

- Designer passwordless sign-in: a 15-minute, single-use token; a 14-day HttpOnly session; Secure cookies with an HTTPS `APP_URL`; CSRF tokens for designer writes; request throttling.
- Three-step project setup: a short introduction to the benefits, project details, then design files. Processing opens the project overview automatically when finished; upload retries reuse the created project. You can also add files later.
- Project contacts, drag-and-drop uploads, content/type checks, and a background processing queue. Up to 20 files per batch, 100 MB per file and 120 MB total per batch; configure a 128 MB request limit. Oversized files are explained before uploading, with matching server checks.
- Automatic file categorization using filename, type and extracted text; optional AI classification and visual style detection. Categories and the deck palette/font can be corrected by the designer.
- The presentation has an introduction, an individual slide for each extracted image, and changes, budget, contacts and downloads. Moodboard, photo, render and drawing slide types can repeat as often as needed. Each visual has its own source page/crop reference and feedback identifier. Collages and moodboards are retained as one composed visual instead of duplicated component slides. All original files remain downloadable.
- Included vendor subquotes and additional subquotes, expandable at multiple levels. Integer-cent money; unknown amounts remain `NULL`; quoted and estimated costs are distinguished. Each imported budget row points to its source file version. Cyclic subquotes are rejected.
- Budget questions based on the current iteration, with downloadable source references. Legal & scope documents also supply page-linked evidence for inclusion questions. Without AI, the helper provides factual totals and matching source excerpts.
- Click an image or use **Zoom in** in the Presentation editor to magnify it with a quick animation. This works for photos, renders, moodboards and document images. Left/right arrow keys navigate the presentation, keeping adjacent photo slides full-screen and returning to the normal layout for any other slide type. Escape or the close button returns to the current photo slide. Reduced-motion preferences are respected.
- The **Presentation** editor opens in list view with thumbnails, slide types, descriptions and source file/page references; **Grid** offers a larger preview layout. Drag the handle to reorder; a ghost marks the insertion position. Keyboard users can press Space, choose a position with arrow keys, then Enter. **Hide** skips a slide in client previews while keeping it editable; **Show** brings it back. **Delete** removes a slide from that iteration’s presentation and retains its source file. These controls also apply to introduction, budget and other project sections. Order, visibility and deletion are copied into new iterations; previously shared iterations remain unchanged.
- **Change with AI** is available on visual slides, including photos and crops from PDF or PowerPoint. Presets fill an editable prompt for photorealism, a different viewpoint, daily clutter or evening light; Custom starts empty. Every variation starts from the original upload or extracted crop and saves an immutable image version for that slide. **Compare original** switches between the generated result and the original crop. Earlier shared iterations retain their own selected image versions. Standalone file edits also use the image-edit API and create a new version of the same logical file. The previous bytes are retained. AI edits are designer actions in a draft; clients leave suggestions for the designer to review. Image API errors are surfaced, and potentially paid requests are not blindly retried.
- Each iteration is a snapshot of file-version references, budget rows and theme. Creating another iteration copies references, not file blobs. Only replacements create file versions. Original filenames that match a current file replace that asset; **Replace file** supports a renamed replacement. Exact duplicate content is not uploaded again to the same asset.
- Client grants are recipient-specific, revocable, valid for 90 days and restricted to one shared iteration. Every request requires a signed-in account matching the invited email. Private email sign-in links work once and expire in 15 minutes; copyable presentation URLs contain no account credential. Client invitations do not create studio privileges.
- Sharing keeps the iteration editable; existing client links show subsequent edits to that iteration. Studio admins on the project team can use the small **Lock iteration** button beside the iteration selector to freeze its content and budget choices, then **Unlock iteration** to allow edits again. Processing must finish before sharing or locking. Unlock the iteration or create a new iteration to make further changes; older links stay attached to their original iteration. Designers preview using their existing session.
- Project **Activity** shows 20 events per page with **Prev**/**Next** controls. **Manage links** sits beside the iteration selector.
- Activity records cover uploads, replacements, processing, iteration creation, previews/client opens, file downloads, feedback, sends, generated links and revocations. Preview/client-open events are requested by the browser, so this is a useful project history, not tamper-proof compliance logging.

## Open questions

The **Open questions** slide has its own **Open questions** entry in presentation navigation and in the Presentation editor. Its default position follows the budget. After the last uploaded document is processed, the worker prepares up to six project-specific suggestions from extracted text, page summaries, design captions, budget choices and recent conversations. Existing projects can use **Suggest questions** on the slide.

Suggestions are private drafts. Designers can review sources, edit the question, add an answer, and select **Include in the client presentation**. The three states are **Answer available**, **Needs clarification** and **Your preference**. AI answers require matching quotes from current source documents; missing or invalid citations leave the question unanswered. Without AI, the helper suggests questions about unknown or optional costs.

Clients can read answers, discuss individual questions and add their own. Replies appear in project activity. Designers can dismiss, restore, resolve or reopen questions. Refreshing suggestions preserves published questions, edits, dismissals and conversations. Unresolved questions and their replies are copied into new iterations; earlier iterations retain their own conversation history. A change to project evidence flags existing questions for review and hides their saved answer until reviewed. Locked iterations permit conversations but prevent designer edits and generation.

Run `python3 tests/test_open_questions.py -v` with PHP and SQLite available. Tests use isolated databases and mocked AI, covering publication, citations, access controls, replies, worker processing and iteration snapshots.

## Import behaviour and review

| Source | Without AI | With AI configured |
| --- | --- | --- |
| JPG, PNG, WebP | Original, preview, pixel-derived palette, filename category | Visual category, style, font/palette suggestions |
| PDF | Ordered page previews, text with bounding boxes, visible image crops, OCR, and palettes for each page | Visual analysis of every extracted page in batches, followed by a document style suggestion with page references |
| PPTX | Rendered slides in presentation order, slide text and cropped pictures; native text/picture fallback if rendering fails | The same page analysis as PDF, including materials and style evidence |
| XLSX | Native XML reader, shared/inline strings, saved formula values | Flexible quote extraction when standard columns are absent |
| CSV | Structured rows and European/English amount formats | Flexible extraction when standard columns are absent |
| PPT / XLS | LibreOffice renders PPT slides or converts XLS to XLSX, original retained | Same analysis after conversion |

After upload, a dismissible full-screen animation reports the actual worker stage and page number. **Continue working** closes it; the project banner keeps reporting progress and **View progress** reopens it. Completion and failures are shown explicitly.

In **Studio settings**, upload a PNG/JPEG/WebP logo (up to 2 MB) and edit the studio name. Workspace chrome is fixed to Warm grayscale, editorial style and serif titles. Personal colors apply to avatars and comments. **Project style** controls presentation colors, typography and light/dark backgrounds; these settings also appear on the project tile alongside its cover photo and palette swatches.

Use **Studio users** to view members. Studio admins can add, edit and remove studio memberships; this role does not bypass project access. A single account can belong to several studios, selected in the top-left menu. Existing accounts and projects migrate into their own studio automatically. Removing a member revokes that studio's access without deleting the account or its other studios; projects must retain a team member and studios must retain an admin.

**Project settings** controls visibility and team membership. Team-only projects are private to their assigned users. Public projects are viewable by everyone in the selected studio, with editing restricted to the project team. Client access still requires a separate presentation link. The project list supports search, personal pins, archiving, and processing indicators. Archived projects remain accessible through **Show archived**.

The main **Activity** and **Comments** pages cover accessible projects in the selected studio. Comments and replies default to newest first. Use **Sort** in any comment view to switch between newest and oldest first. Choose **Reply** on an original comment to add a reply in its one-level thread. Anyone with access to the presentation can toggle **Answered** on a top-level comment; answered threads are hidden by default, and **Show answered** includes them. These controls appear in the studio feed, project feed, and slide discussion. A slide's comment-count button opens its discussion. Project comments include earlier iterations, and loading more comments keeps each thread together.

Expand a source document in **Files** to browse its derived JPEG images, page previews and UTF-8 text files. Each entry has a stable filename and source-page reference; extracted images show their detected classification and can be relabelled. Preview or download each derived file independently. Originals and previously shared versions stay intact.

In **Files**, use the eye button to inspect each document page, its text, extracted pictures, palette, and any visual analysis. Each extracted picture also links directly to its presentation slide. In **Presentation**, **Edit labels** changes the title, image type and situation independently. Situations are Before (existing), Concept (proposed), After (documented completion), Reference, or Unknown. For PDF and PowerPoint, code first renders complete pages and inventories native image bounds, relative area and repeated edge graphics. Vision classifies each whole page before code renders any final crops. Collages and moodboards stay together; complete native photographs are protected from fragment crops. Logos and decorative graphics are excluded using page context and repeated-placement evidence. High-confidence mixed pages can yield independent images; a mixed page can contain both Before photos and Concept renders. Uncertain or unsupported labels remain marked for review. Without AI or with uncertain page analysis, compositions stay intact for review; explicit comparison labels and disjoint native pictures can support separate whole images. Only explicit source labels provide tentative classifications; an ordinary image filename is not automatically a render or a before photo. PDF and PowerPoint pages can also be browsed in the presentation. Existing uploads can use **Extract pages & images** or **Extract again** in this view. Re-extraction creates a new file version, preserving older shared presentations. It is available only in drafts.

Colors are sampled from the actual crops, with similar colors merged and paper white excluded. Moodboard pages receive more weight than ordinary presentation pages; financial and technical pages do not supply the design palette. AI analyzes up to four pages per request, including page previews and up to three detail crops per page, then proposes a style with source page references and an explanation. Without AI, explicit style wording can provide a tentative suggestion. An unsupported style stays unspecified. Manual theme changes are preserved during processing.

**Review before sharing.** Each import processes up to 120 pages, 160 native image placements per page, at most eight independently planned visuals per page, and 60 MB of extracted images. Limits and individual page failures are reported. Each page retains its own text; the combined AI financial analysis uses up to 100 KB of source text and reports truncation. Image regions follow their visible placement, including cropping and page rotation. Page-level visual plans are checked against image geometry before cropping. Whitespace inside a photo is never used as a splitting rule. Small fragments, overlapping regions and invalid plans fall back to an intact composition. Complex scans or uncertain logos still need review; page previews retain the complete source layout and show the extraction decision. Use **Extract again** in a draft to apply the new pipeline to an older upload. OCR can miss or misread text. LibreOffice font availability can affect slide rendering; unsupported embedded image formats are reported in the fallback. Saved spreadsheet formula caches can be stale. AI visual descriptions and style are suggestions, and source prices and tax treatment still require review.

For reliable structured imports, use `public/assets/example-budget.csv` as the column example:

```csv
key,label,vendor,amount,kind,parent,included,note
main,Main contractor,Builder,54000,quote,,false,Including VAT
electric,Electrical work,Electrician,9500,quote,main,true,Already in main quote
extra,Additional shelving,Joiner,1200,estimate,main,false,Additional to main quote
curtains,Window treatments,,,unknown,,false,Awaiting measurements
```

`included=true` means the amount is already in the parent's total. Other known rows contribute once to the known project total. Null rows contribute no amount. Category corrections do not invent/recalculate source values: use the budget editor to reconcile ambiguous imports.

## Storage and migration

`storage/studiodeck.sqlite` stores application data, original file BLOBs, preview BLOBs, and version-scoped document pages and image crops. The two extraction tables are created automatically for existing databases without changing stored sources. WAL mode may create `-wal` and `-shm` files while the app is running. Back up using SQLite's backup API or stop the web process and worker before copying; do not copy only the main file during writes. The local mail log is a development-only auxiliary file. Image/doc conversion uses private temporary directories that are cleaned afterwards.

The schema is in `app/schema.sql`. It uses text IDs, simple joins/inserts/updates, integer cents and ordinary foreign keys; hierarchy traversal and snapshot copying happen in PHP. SQLite-specific pragmas and `BEGIN IMMEDIATE` are centralized. For a move to PostgreSQL/MySQL, adapt the PDO connection, transaction locking and BLOB type, then apply the schema with your migration tool. Version records and iteration mappings can remain the same. Initialization creates missing tables in existing databases as well as new databases; there is no general column-migration runner.

For a small studio, keeping bytes in SQLite makes backups and deployment simple. For large libraries, move immutable blobs behind an object-store adapter while retaining the version IDs and access checks. An interrupted ingest job can be retried in the interface; interrupted image jobs require an explicit new edit. Define retention, storage quotas and production document isolation for your environment before broad rollout.

## Verification

```sh
PHP_BIN=php python3 tests/test_workflows.py
python3 tests/test_extraction.py
php tests/test_analysis.php
node tests/test_slides.mjs
node tests/test_themes.mjs
PHP_BIN=php python3 tests/test_studios.py
```

The integration suite uses an isolated temporary database and fake `.test` addresses. It checks token replay/expiry, 14-day sessions, CSRF, tenant isolation, upload validation, PDF/CSV/XLSX/PPTX ingestion, integer-cent totals, subquote cycles, shared snapshot immutability, replacement accounting, version download restrictions, feedback, revocation and link expiry. It also checks page/image access, progress stages, palette provenance, re-extraction snapshots and manual theme preservation. The extraction suite exercises multi-page PDF, rotated pages, scanned text, slide ordering, intact collages, white dividers inside photos, rejected repeated logos, malformed plans and model-directed scan crops with real document tools. The analysis test verifies whole-page planning before final crops, mismatched page rejection, one-slide collage preservation, multi-page vision requests, independent image classification across batches, mixed Before/Concept captions and partial API failure handling. Slide tests cover repeating types, stable identifiers and crop references. Workflow tests also simulate image edit results to check preservation of originals, stale-result rejection and immutable shared slide images. These tests send no real email and make no live AI calls.

Live mail and paid AI requests require your configuration and were not exercised in this environment. The Dockerfile is provided as a convenience; the verified runtime was PHP 8.3 with the listed extensions. The interface was also checked in a browser for project navigation, deck navigation, budget expansion, helper answers and source/version dialogs.

## Optional pitch demo

The demo contains fictional contacts, costs and drawings, and generated illustrative interiors. It is not a client deliverable or a construction plan. Demo edits exist in memory for the page session; its sample links do not share newly entered records across browsers. Its email, semantic document extraction and image generation are explicitly disconnected.

```sh
node scripts/preview.mjs
python3 scripts/build-demo.py
```

The first command previews the UI; the second creates static `dist/` for the hosted pitch demo. Neither is needed to run PHP. `package.json` only exposes the optional preview command and has no dependencies.

AI integration references: [OpenAI Chat API](https://developers.openai.com/api/reference/resources/chat) and [OpenAI Images API](https://developers.openai.com/api/reference/resources/images).

Extraction references: [PyMuPDF page API](https://pymupdf.readthedocs.io/en/latest/page.html) and [OpenAI vision inputs](https://developers.openai.com/api/docs/guides/images-vision).

When upgrading an existing installation, `php scripts/initialize-slides.php` initializes individual slides for draft projects from their stored extraction, without AI requests. Use **Extract again** to run the current visual classifier on an older document. Newly created iterations also initialize missing slide records from stored sources.

### Profiles, unread comments and communication

- Open **User profile** from the sidebar to set your display name, upload/remove an avatar, choose a personal workspace accent, and opt in or out of comment emails. The accent does not change project presentation colors. Clients have a **Your profile** button in their presentation with the same identity and email preference controls.
- Comments show a thumbnail of their source slide and an **Unread** marker. Opening a discussion marks its comments as read. Read status is stored in SQLite per person, including client recipients, and survives refreshes and other devices. Listing comments does not mark them read.
- New comments and replies queue emails for the other project team members and recipients of active links to that iteration. The author is excluded. Preferences, project membership and share validity are rechecked before delivery. Notification links remain tied to the original share, including its expiry and revocation.
- The existing worker drains `email_outbox`. Failed transport calls retry with a five-minute delay, up to four attempts; delivery can be inspected through `status` and `error`. An interrupted send may be retried, so the transport does not promise exactly-once delivery.
- **Send to clients** includes an editable message. Presentation and comment emails use the studio's selected palette, a plain-text alternative and **Presented by studiodeck** attribution. Profile preferences currently cover comment notifications; explicitly sent presentation invitations remain separate.
- `MAIL_TRANSPORT=log` does **not** deliver email. Rendered messages are written to `MAIL_LOG_PATH.messages.jsonl` (default `storage/mail.log.messages.jsonl`) for local review. Production delivery uses the existing `MAIL_TRANSPORT=mail` / `MAIL_FROM` configuration and requires a working PHP mail transport.

### Presentation logos and workspace refinements

The presentation uses the **project logo → studio logo → Studiodeck** fallback. Upload a project/client logo in **Project settings**, or a studio logo in **Studio settings**. Logos and avatars accept PNG, JPEG or WebP up to 2 MB and are decoded and normalized before storage. Removing an override restores the next logo in the fallback. Presentations always show **Presented by studiodeck**.

Project teams use searchable name/email results with removable selections, suited to large studios. The top bar displays the selected studio name, **Current project** opens **All projects** when no project is selected, and the viewport reserves scrollbar space. Profiles have refreshable `/{studioId}/profile` URLs.

Run the isolated integration checks with `PHP_BIN=php python3 tests/test_people.py`. They exercise profiles, client preferences, previews, unread isolation, logo inheritance and notification delivery rules without real email or AI calls.

### Presentation sections, floorplans and slide ordering

The presentation header, section index and footer stay visible. Only the slide content scrolls. The old navigation dots are replaced by an index for **The story**, **The current situation**, **The moodboards**, **The designs** and **The budget**; empty sections are omitted.

The editor suggests a section from each slide’s type and situation. Use its **Section** selector to change it, and **Arrange by section** to put related slides together. Existing custom order is retained until you rearrange it. Section assignments are copied into new iterations and shared iterations remain preserved.

Drag the dedicated slide handle to reorder in list or grid view. Touch dragging is supported. Keyboard users can focus the handle, press Space, use arrow keys/Home/End, then Enter to save or Escape to cancel. Up/down buttons have been removed.

**Floorplan** is a separate image type, detected from new source evidence or selected in **Edit labels** for an existing slide. It provides zoom, fit-to-view and drag-to-pan controls. With the plan focused, use +/− to zoom, arrow keys to pan, and 0 to fit.

### Project dashboard and workspace styling

Project tiles use the same selected cover image as the project overview and show team avatars/names. Pinned projects have their own section above a divider; the extra heading and divider disappear when no matching projects are pinned. **Project settings** includes a deadline and up to 20 custom labels. Project search includes labels.

Upload an avatar in **User profile**. Project members and their avatars also appear on the client-facing **Your project team** slide, together with additional non-client project contacts.

Studio admins can choose **Classic serif** (the original heading font) or **Modern sans** (DM Sans, matching the marketing website titles) in **Studio settings → Font style**. The choice is shared by studio members and leaves project presentation styling independent. The workspace palette is fixed. Checkboxes, navigation and upload controls use Warm grayscale. The project style picker retains its font, palette and background choices with a live preview.

`python3 tests/test_project_story.py` checks metadata validation, image access, shared section immutability, floorplan labels, team avatars and studio font persistence with isolated data.

### Editor controls, custom groups and legal documents

- **Project style** places a live sample on the left of a wide dialog, with font buttons, a light/dark toggle and five color choices for each mode. Light and dark selections are saved separately. Changes are saved only when applied.
- In the **Presentation** editor, **Add group** creates a reusable group for this iteration. Group labels filter the list; **All slides** resets the filter. Drag a handle onto a highlighted group label to assign it, or between slides to reorder. Groups carry forward into new iterations. Their handles support mouse/touch dragging with an insertion ghost, or Space, arrow keys and Enter for keyboard ordering. The saved order is used by the presentation index and Arrange by section. During slide dragging, group outlines fade in without changing layout. A cloned slide thumbnail follows the pointer, the source keeps its space, and an overlay marker identifies the drop position.
- The editor preview bar provides title, type and situation fields for extracted visual slides, plus show/hide and confirmed deletion. Clients never see these editing controls. Photorealistic processing uses sparkles and honors reduced-motion preferences.
- Admins can permanently delete projects they belong to from **Project settings**. Admin status alone does not grant project editing or deletion. Deletion requires a warning step, the exact project name, an explicit acknowledgment and a short-lived server confirmation. Active processing or email delivery must finish first. This deletes all iterations, files, image variants, comments and sharing links from the app; it does not erase separately retained backups.
- Use **Files → Add legal document**, or change a file’s category to **Legal & scope** to queue full text extraction. PDF/PowerPoint pages are retained individually, including OCR for scans; these documents do not create visual slides or change the project palette. Source text remains available in the expanded file explorer.
- **Budget & scope questions** searches the current iteration’s legal text and budget. Answers can cite individual pages, which open the extracted text and offer the original file. Larger documents use ranked, overlapping excerpts with paint/waste terminology in English and Dutch. Missing matches are not evidence of exclusion, and extraction warnings or incomplete evidence should be reviewed against originals. AI is required for free-form interpretation; without it, the helper shows matching excerpts.

Focused checks: `python3 tests/test_project_deletion.py`, `python3 tests/test_legal_documents.py`, and `node tests/test_slide_order.mjs`. Integration checks require the PHP/document dependencies in the Docker image and use temporary databases with no real email or AI calls.

### Fullscreen presentation

Use **Show fullscreen** in the presentation footer to enter browser fullscreen. The editor bar and editing actions are hidden, while slide navigation remains available. **Exit fullscreen** or Escape restores the editor at the current slide. Browsers without the Fullscreen API use an app-level presentation view with the same hidden editor controls.

### Interactive budget choices

Budget rows support fixed prices, a lower/upper price range, optional status, and unspecified amounts. The presentation has an option toggle and a Budget–Luxury slider for each applicable row. Options start unselected; ranges start at the lower amount. Choices are shared within an iteration, saved on the server, and recorded in project activity. Project team members and valid client links can change choices; studio viewers cannot. Source prices remain fixed after sharing. New iterations copy choices independently.

Spreadsheet imports accept `label`, `amount`, `min_amount`, `max_amount`, `optional`, `kind`, `parent`, `included`, and `note` columns. Dutch `Omschrijving` and `Bandbreedte laag` / `Bandbreedte hoog` headers are also supported. AI extraction preserves ranges and distinguishes optional rows from subquotes already included in a parent. VAT-exclusive/inclusive columns are not treated as price ranges.

For earlier extracted budgets whose ranges were stored only in notes, preview explicit recoverable values with `php scripts/repair-budget-properties.php --project=PROJECT_ID`. Add `--apply` to repair draft source rows after backing up the database. This does not modify shared iterations or invent missing prices.

### Automatic subquote matching

After each quote/budget file finishes processing, the worker checks relationships across the current draft's uploaded budget sources. It can attach a newly uploaded subcontractor quote to an existing main quote, or attach an existing subquote when its main quote arrives later. Non-budget uploads do not trigger extra matching calls. The Budget view also has **Check subquotes** to check existing files without reimporting them.

The matcher uses the configured text AI and supplies cost labels, vendor names, source notes and document excerpts. High-confidence matches require verifiable source excerpts and an explicit inclusion/additional-cost statement naming the vendor or a shared reference before they can change the hierarchy and included flag. Amount similarity alone is insufficient. If a parent document has several costs, automatic linking also requires evidence identifying the particular parent row. Conflicting or uncertain matches appear under **Possible subquotes**, with source evidence and actions to mark the cost included, additional or separate. Low-confidence or fabricated evidence is ignored. Prices and optional flags are not rewritten.

Automatic links are labelled and can be undone from the cost details. Manual edits, accepted suggestions and undone links are protected from future automatic matching. Dismissed suggestions are remembered. Revised imports preserve cost identities when source keys or unique labels match, preserving manual cross-file links and budget choices; removed parents release their child costs instead of leaving them excluded from totals. Automatic links affected by source replacement are rechecked. Shared iterations are immutable, and model results are discarded if the budget changed during the request.

Matching uses at most 2,000 cost rows per iteration and bounded document excerpts; partial or unavailable checks are surfaced in the Budget view. It does not infer certainty from omitted text. Matching failure does not discard imported costs, and **Check subquotes** can retry it separately. This is a text-AI operation and does not consume image-enhancement allowances.

Tests: `php tests/test_subquotes.php`, `python3 tests/test_subquotes_api.py` and `node tests/test_subquotes.cjs`. The PHP/Python checks use temporary databases and injected AI results. To run the browser check, export the Python fixture using `STUDIODECK_TEST_EXPORT=/tmp/subquotes.json`, serve the current `public/` assets, and pass the export path plus `STUDIODECK_TEST_URL`, `PLAYWRIGHT_MODULE` and `CHROMIUM_EXECUTABLE` to the browser test. No paid AI calls are made by these tests.

### Image-enhancement allowances and saved variations

Image alterations share one server-enforced allowance across a project's files, slides, users and iterations: **10 total for a Project Pass**, or **10 per calendar month (UTC) for monthly projects**. Queued/running edits reserve a slot, successful edits consume it, and failed edits release it. Monthly usage is attributed to the month an edit was requested; unused slots do not roll over. Viewing, comparing or selecting a saved version consumes no allowance. No credits, top-ups or upsells are implemented.

Original images and all successful slide variations remain stored. The **AI-enhanced version** dropdown lists short summaries of the requested changes, including legacy variants. Designers can choose **Use this version** to save an older image as the draft's default. Client links can browse the versions present when that iteration was shared; newer draft versions do not leak into shared snapshots.

New projects derive image allowances from verified billing coverage. The command below only controls the image policy of migration-exempt legacy projects; it does not grant paid access:

```sh
php scripts/set-project-enhancement-plan.php PROJECT_ID project_pass
php scripts/set-project-enhancement-plan.php PROJECT_ID monthly
```

Changing a policy does not erase usage or images. The Project Pass policy counts historical image-edit jobs across the project's lifetime. The 150-day access period is enforced separately by the billing entitlement checks. Focused tests: `python3 tests/test_enhancements.py`; run with the PHP extensions supplied in the Docker image. Tests use temporary data and simulated image results, without paid AI calls. For the browser check, export a fixture with `STUDIODECK_TEST_EXPORT=/tmp/enhancements.json python3 tests/test_enhancements.py`, serve `public/` locally, then run `tests/test_enhancements.cjs` with the same export path plus `STUDIODECK_TEST_URL`, `PLAYWRIGHT_MODULE` and `CHROMIUM_EXECUTABLE` as needed. The browser test mocks API responses; the Python test exercises the real API.

### Studio starting packs

Admins can open **Studio settings → Manage starting pack** to maintain reusable welcome, text, contact and image slides, plus client reference PDFs. New projects select the default items in the creation wizard and receive independent copies. Existing projects keep their copies unchanged. **Add slide → Add from studio template** offers only missing slides and preserves customised welcome and contact text. Shared iterations keep their exact copies. **Project documents** in the client presentation provides downloads and a document-question assistant with page citations.

See [the setup and usage guide](docs/starting-packs.md) for placeholders, optional items and updates. Tests: `python3 tests/test_starting_pack.py` uses a temporary database with no external email or AI. `tests/test_starting_pack.cjs` exercises the real UI on desktop and mobile; its header lists the required isolated fixture environment variables.

### Google Drive imports

**Upload files** now opens a dialog with **From my computer** (browse or drag/drop) and **From Google Drive** tabs. Users connect their own account within their studio, browse or paste a folder link, select individual files and import copies through the existing processing pipeline. Folders cannot be selected. Google Docs, Slides and Sheets export to PDF, PPTX and XLSX. The new-project wizard supports the same Drive selection.

Configure `GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET` and `GOOGLE_DRIVE_TOKEN_KEY` before enabling real connections. The custom browser uses Google's restricted read-only Drive scope; the [setup guide](docs/google-drive.md) covers OAuth configuration, verification requirements, limits and usage. Tests: `python3 tests/test_drive.py` and `node tests/test_drive.cjs`, with fake Google responses and no real external requests.

## Signup and Stripe billing

New studios receive a verified 7-day trial. Studio admins manage monthly packages, project-specific 150-day passes, €15 extensions and Stripe invoices in **Studio settings → Billing**. Existing studios retain explicit migration access. All project writes, client access and worker jobs enforce coverage server-side.

See [billing deployment and operations](docs/billing.md) for Stripe setup, test commands, migration, refunds, notifications and staged retention cleanup. Checkout requires server-side Stripe keys and price IDs; secrets are not included in the repository.

### First-project welcome

Studios with no projects, including archived projects, see a welcome page with a captioned one-minute tour, an isolated tour through the actual app and a path into project creation starting at **How it works**. The first project gets a dismissible checklist, and **Getting started** keeps both tours available later. See [onboarding behavior, video generation and checks](docs/onboarding.md).

### Studio websites

Studio admins can open **Website** to build a portfolio from curated project copies and approved testimonials. Ten one-page starting designs with full-screen previews, freely editable HTML/CSS/JavaScript, chat-driven source edits, sandboxed private previews, explicit static publication, optimized images, SEO metadata, ZIP export and version restore are implemented. Publishing is included with every active Solo, Studio and Practice subscription (or explicit local development mode). Project changes and deletion never alter published snapshots. See [website setup, limits and deployment](docs/website.md) for Stripe and custom-domain HTTPS configuration.

### Needs attention

Open **Needs attention** in the studio sidebar to see published open questions, pending confirmations, unread feedback and project deadlines in one place. It includes active projects where you are a team member. Deadlines cover overdue projects and the next 14 days (UTC); overdue projects and confirmations assigned to you appear first.

Category cards filter the queue and show totals. Filters survive refresh and browser navigation at `/{studioId}/attention?kind=feedback`. **Load more** pages through 50 items at a time, and **Refresh** checks for updates. Opening an item takes you to its question, conversation or project. Merely viewing this dashboard never marks comments as read.

Unanswered published questions use their latest copy to avoid listing copied questions twice; new questions on older shared iterations still appear. Pending confirmations and unread conversations retain their original iteration. Replies are grouped into one unread item per conversation; messages you wrote are excluded. Resolved/dismissed questions, completed/withdrawn confirmations and archived projects drop out on refresh.

Checks: `python3 -m unittest discover -s tests -p test_attention.py -v`, `node tests/test_routes.mjs`, and `tests/test_attention_browser.cjs` against the isolated Communication fixture. No real email or external API calls are needed.
