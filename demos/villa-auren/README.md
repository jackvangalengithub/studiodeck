# Villa Auren — Demo 01

A complete fictional interior-design commission for a warm modern villa in Bergen, the Netherlands. Created from scratch for StudioDeck demonstrations. Clients, suppliers, quotations and prices are fictional. All architectural images and artwork are AI-generated concepts, not photographs of a completed project.

## Open the demo

- In the local StudioDeck application: **Villa Auren · Modern villa demo**, pinned in Jackvangalen’s studio. The first iteration is an editable draft; no client messages or sharing links were created.
- Open `index.html` for the standalone 27-slide designed presentation. Arrow keys navigate; the floating controls provide fullscreen, PDF and supplier-pack links.
- Open `Villa-Auren-Presentation.pdf` for the 27-page landscape PDF.
- Open `supplier-index.html` for the 15 fictional quotations and supporting documents.

The native StudioDeck version has 29 visible slides: the same design story, native room imagery and moodboards, a zoomable floor plan, an interactive budget, contacts and source downloads. The unused Changes section is hidden in client preview.

## Included

- Eleven original images, including two classic 3D model studies: exterior, living room, kitchen/dining, bedroom, bathroom, study, two physical-sample moodboards and abstract artwork.
- Original PNGs and optimized WebP assets in `assets/`; editable schematic plan in SVG.
- Introduction, client brief, design principles, room concepts, specifications, colour palette, lighting strategy, options, programme and scope.
- Fifteen supplier PDFs and their editable HTML sources in `suppliers/`.
- `budget.csv`: 18 rows, including multilevel included subquotes, an additional optional subquote, a furniture range and an unknown landscape allowance.
- `materials.csv`, `programme.csv`, `scope.pdf` and their supporting source documents.
- `manifest.json`: reusable content, theme and source mapping.
- `image-prompts.json`: the original nine prompts; generated with the built-in image_gen tool using the imagegen skill.
- `slides/`: individually rendered presentation pages.

## Budget arithmetic

| Selection | Fictional total |
| --- | ---: |
| Base furniture selection, options off | €278,500 |
| Premium furniture selection, options off | €286,500 |
| Premium furniture + study + terrace | €314,600 |

Every total includes a €25,000 client-held contingency. The study adds €9,600 and terrace furniture adds €18,500. Landscape works are unpriced and excluded. Uniform 21% VAT is an explicit fictional arithmetic assumption, not tax advice or a real quotation basis.

Forma Build (€82,000) includes Lumen Works (€18,500), Flow Systems (€14,000) and Terra Surface (€21,000). Lumen Works includes Signal Atelier (€4,800). Grain Atelier (€54,000) includes Quarry Objects (€16,000) and Quiet Appliances (€12,000). Included subquotes are never added twice.

## Rebuild and install

From the repository root, run `python3 scripts/build-villa-demo.py`, then `node scripts/render-villa-demo.cjs` with Playwright available. If needed, set `PLAYWRIGHT_MODULE` and `CHROMIUM_EXECUTABLE` to local installations. The builder preserves the generated imagery; it does not call an image API.

`scripts/import-villa-demo.py` requires Pillow and PyMuPDF, both present in the application Docker image. Supply `--bundle`, `--database`, `--studio` and `--owner`. It verifies studio membership, backs up the database, creates only the new project in one transaction, and exits without changes if that project already exists. It sends no email and makes no AI calls.

`scripts/check-villa-demo.cjs` is an opt-in acceptance check for this local installation. It creates and removes a temporary session, visits each visible slide, waits for images to decode, verifies totals and nested source downloads, and records its results in `checks/acceptance.json`. Browser layout and standalone navigation results are in `render-checks.json`.

The plan is illustrative zoning, not a measured construction drawing. Generated architectural elements and landscaping may extend beyond the priced interior packages; the scope document states these boundaries.

## Added visual studies

Two intentionally computer-made 3D design studies are included as native `render` slides, with model edges, simplified materials and geometry. The existing presentation imagery is retained.

The new PNG originals and optimized WebP files are in [`assets/`](assets/), named `render-*`. Final prompts and refinements from the built-in image_gen tool are in [`additional-image-prompts.json`](additional-image-prompts.json); slide content and insertion points are in [`additional-slides.json`](additional-slides.json).

For already installed demos, `scripts/update-demo-visuals.py --database PATH --demos PATH --studio ID` adds only the new slides to the original drafts and versions the designed PDFs. It backs up SQLite, preserves original sources and budget choices, and is idempotent for an unchanged bundle. Fresh imports include the additions automatically.
