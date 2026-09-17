# Studiodeck

A working first version of an interior designer's workspace and interactive client presentation. Vanilla JavaScript, CSS, HTML and PHP 8.3; SQLite through PDO. No Composer packages, frontend framework, bundler, or JavaScript installation is needed for the PHP app.

The hosted version is an explicitly labelled, in-memory pitch demo. **It does not run the PHP backend.** The real application is `public/`, `app/` and `scripts/worker.php`. Never point a production PHP server at `dist/`: that folder is the static demo.

## Run locally

Install PHP 8.3+ with `pdo_sqlite`, `fileinfo`, `zip`, `simplexml`, `gd` (JPEG/WebP), and `curl`. Install Python 3 with PyMuPDF and Pillow (`python3-fitz`, `python3-pil` on Debian), Tesseract with English and Dutch language data, and LibreOffice Impress/Calc. The Docker image includes these dependencies. LibreOffice renders PPT/PPTX slides to PDF; PyMuPDF extracts pages and visible image regions; Tesseract reads scans. `OCR_LANGUAGES` defaults to `eng+nld`.

Copy `.env.example` to `.env`. In one terminal, from this folder:

```sh
php -d memory_limit=256M -d upload_max_filesize=30M -d post_max_size=128M -S localhost:8080 -t public public/router.php
```

In another terminal:

```sh
php -d memory_limit=256M scripts/worker.php
```

Open http://localhost:8080 and request a sign-in link. With the default `APP_ENV=local` and `MAIL_TRANSPORT=log`, the single-use sign-in link is written to `storage/mail.log`. It is intentionally never returned by the unauthenticated API. Open that link and click **Open my studio**. The session lasts 14 days.

Then: **Create project → add client emails → drop files → review → preview → send to clients**. Client email addresses are saved but receive no message until you choose to share. A newly created project contains no sample budget or fabricated prices.

## Docker option

```sh
cp .env.example .env   # set HOST_PORT and APP_URL to the same port
docker compose up -d --build
```

This runs two containers from one image: `web` (PHP server) and `worker` (background processing). Both share `./storage`, so the database and `storage/mail.log` are on your machine. Use `docker compose logs -f` to follow output and `docker compose down` to stop. The PHP built-in web server is for development and demonstrations; deploy `public/` with your usual PHP web server and HTTPS for client use.

A single container (`docker build -t studiodeck . && docker run --rm -p 8080:8080 --env-file .env -v studiodeck-data:/app/storage studiodeck`) also works; `scripts/start.sh` then starts both processes.

## One-time studio setup

- Set `APP_ENV=production` and `APP_URL` to your exact HTTPS application origin. Links are created from this configured origin, never an incoming Host header.
- Set `MAIL_TRANSPORT=mail`, a verified `MAIL_FROM`, and configure PHP's `mail()` transport on your server. In the Docker image, install/configure your preferred sendmail-compatible relay, or use a PHP host with a configured mail service. Without mail delivery, authenticated designers can still create links and send them manually; a failed send is reported accurately. Production sign-in requires working mail.
- Optionally restrict designer signup with comma-separated, lowercase `DESIGNER_EMAILS`. Otherwise any email verified by a magic link creates its own isolated studio.
- Set `OPENAI_API_KEY` to enable semantic document/visual analysis, grounded free-form budget chat and image edits. Models are configurable using `OPENAI_TEXT_MODEL` and `OPENAI_IMAGE_MODEL`. Keys stay on the server. Without a key, filename/text rules, structured cost imports, manual editing, palette extraction and a factual budget helper still work.
- Keep the worker running under your normal process manager. `php scripts/worker.php --once` handles one queued job and exits, which also permits scheduled operation.
- Set the web root to `public/`. Keep `.env`, application source, the database and mail log outside that web root. With Nginx, explicitly deny dotfiles and execute only intended PHP entry points.

## What works

- Designer passwordless sign-in: a 15-minute, single-use token; a 14-day HttpOnly session; Secure cookies with an HTTPS `APP_URL`; CSRF tokens for designer writes; request throttling.
- Project creation and contacts, drag-and-drop uploads, content/type checks, and a background processing queue. Up to 20 files per batch, 30 MB per file; configure a 128 MB request limit.
- Automatic file categorization using filename, type and extracted text; optional AI classification and visual style detection. Categories and the deck palette/font can be corrected by the designer.
- The presentation has an introduction, an individual slide for each extracted image, and changes, budget, contacts and downloads. Moodboard, photo, render and drawing slide types can repeat as often as needed. Each visual has its own source page/crop reference and feedback identifier. Assembled moodboard pages are retained alongside their extracted pictures. All original files remain downloadable.
- Included vendor subquotes and additional subquotes, expandable at multiple levels. Integer-cent money; unknown amounts remain `NULL`; quoted and estimated costs are distinguished. Each imported budget row points to its source file version. Cyclic subquotes are rejected.
- Budget questions based on the current iteration, with downloadable source references. Without AI, the helper explicitly limits itself to totals, unspecified costs and included subquotes.
- Click a photo to magnify it with a quick animation. Left/right arrow keys navigate the presentation, keeping adjacent photo slides full-screen and returning to the normal layout for any other slide type. Escape or the close button returns to the current photo slide. Reduced-motion preferences are respected.
- **Make photorealistic** is available on render slides, including renders cropped from PDF or PowerPoint. It edits the selected image and saves an immutable image version for that slide. **Compare original** switches between the generated result and the original crop. Earlier shared iterations retain their own selected image versions. Standalone file edits also use the image-edit API and create a new version of the same logical file. The previous bytes are retained. AI edits are designer actions in a draft; clients leave suggestions for the designer to review. Image API errors are surfaced, and potentially paid requests are not blindly retried.
- Each iteration is a snapshot of file-version references, budget rows and theme. Creating another iteration copies references, not file blobs. Only replacements create file versions. Original filenames that match a current file replace that asset; **Replace file** supports a renamed replacement. Exact duplicate content is not uploaded again to the same asset.
- Client bearer links are recipient-labelled, revocable, valid for 90 days and restricted to one iteration. Link tokens are hashed at rest and live in the URL fragment, keeping them out of ordinary request URLs and referrers. Possession of the link grants access; this is not identity verification and a forwarded link can be used by its holder. Audit attribution identifies the link used, not independently verified identity.
- Publication freezes the draft. Processing must finish before sharing. Older links keep their old file/budget snapshot and cannot read later versions. Designers preview using their existing session.
- Activity records cover uploads, replacements, processing, iteration creation, previews/client opens, file downloads, feedback, sends, generated links and revocations. Preview/client-open events are requested by the browser, so this is a useful project history, not tamper-proof compliance logging.

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

In **Files**, use the eye button to inspect each document page, its text, extracted pictures, palette, and any visual analysis. Each extracted picture also links directly to its presentation slide. In **Presentation**, **Edit labels** changes the title, image type and situation independently. Situations are Before (existing), Concept (proposed), After (documented completion), Reference, or Unknown. AI classifies every crop in batches of six using the image, page preview and nearby captions; a mixed page can contain both Before photos and Concept renders. Uncertain or unsupported labels remain marked for review. Without AI, only explicit source labels provide tentative classifications; an ordinary image filename is not automatically a render or a before photo. PDF and PowerPoint pages can also be browsed in the presentation. Existing uploads can use **Extract pages & images** or **Extract again** in this view. Re-extraction creates a new file version, preserving older shared presentations. It is available only in drafts.

Colors are sampled from the actual crops, with similar colors merged and paper white excluded. Moodboard pages receive more weight than ordinary presentation pages; financial and technical pages do not supply the design palette. AI analyzes up to four pages per request, including page previews and up to three detail crops per page, then proposes a style with source page references and an explanation. Without AI, explicit style wording can provide a tentative suggestion. An unsupported style stays unspecified. Manual theme changes are preserved during processing.

**Review before sharing.** Each import processes up to 120 pages, 40 image regions per page, and 60 MB of extracted images. Limits and individual page failures are reported. Each page retains its own text; the combined AI financial analysis uses up to 100 KB of source text and reports truncation. Image regions follow their visible placement, including cropping and page rotation. Flattened moodboards can be separated at clear white gutters; complex collages may remain a single crop. OCR can miss or misread text. LibreOffice font availability can affect slide rendering; unsupported embedded image formats are reported in the fallback. Saved spreadsheet formula caches can be stale. AI visual descriptions and style are suggestions, and source prices and tax treatment still require review.

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
```

The integration suite uses an isolated temporary database and fake `.test` addresses. It checks token replay/expiry, 14-day sessions, CSRF, tenant isolation, upload validation, PDF/CSV/XLSX/PPTX ingestion, integer-cent totals, subquote cycles, shared snapshot immutability, replacement accounting, version download restrictions, feedback, revocation and link expiry. It also checks page/image access, progress stages, palette provenance, re-extraction snapshots and manual theme preservation. The extraction suite exercises multi-page PDF, rotated pages, scanned text, slide ordering and picture crops with real document tools. The analysis test verifies multi-page vision requests, independent image classification across batches, mixed Before/Concept captions and partial API failure handling. Slide tests cover repeating types, stable identifiers and crop references. Workflow tests also simulate image edit results to check preservation of originals, stale-result rejection and immutable shared slide images. These tests send no real email and make no live AI calls.

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
