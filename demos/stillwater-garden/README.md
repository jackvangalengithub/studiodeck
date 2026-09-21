# Stillwater Garden — Demo 02

A contemporary woodland retreat with a reflecting pool, meadow walk, charred-timber dining pavilion, sunken lounge, productive garden and quiet woodland paths. Created from scratch as StudioDeck's second fictional showcase.

## Open

- **StudioDeck:** Stillwater Garden · Landscape demo, pinned in Jackvangalen's studio. The first iteration is an editable draft.
- **Standalone deck:** open `index.html`. Arrow keys and the floating controls navigate, enter fullscreen and open downloads.
- **PDF:** `Stillwater-Garden-Presentation.pdf`, 34 designed landscape pages.
- **Project library:** `supplier-index.html` links all quotes, schedules and the scope document.

The native StudioDeck version has **36 visible slides**, using editable text, original imagery, material/planting/seasonal moodboards, zoomable concept plans, an interactive budget, contacts and downloads. The unused Changes section is hidden in client preview. No client invitations or share links were created.

## The complete package

- **15 original generated images:** water court, dining pavilion, meadow, woodland, sunken lounge, productive garden, night scene, aerial concept, material board, botanical board four-season composition, two classic 3D studies and two crayon-style sketches.
- **Four editable SVG design studies:** masterplan, planting strategy, lighting plan and landscape section. PNG exports are included for the native presentation.
- **15 fictional supplier quotations:** single-page PDFs with editable HTML sources, scope, inclusions, exclusions, illustrative lead times and VAT arithmetic.
- **18 budget rows:** source-linked packages, included subquotes, a third-tier stone supplier, optional kitchen and rainwater packages, furniture selection range, contingency and unknown ground conditions.
- **Four CSV schedules:** budget, materials, candidate planting palette and programme.
- **Scope PDF:** package boundaries, exclusions and decision gates.
- **Reusable sources:** `manifest.json`, `image-prompts.json`, HTML, SVG, original PNGs, optimized WebP assets and individual slide JPEGs.

Images were generated using the **built-in image_gen tool** and the imagegen skill. The complete final prompt set is in `image-prompts.json`; selected originals and project-ready versions are in `assets/`.

## Investment story

| Selection | Fictional amount |
| --- | ---: |
| Base furniture; optional packages off | €213,400 |
| Premium furniture; optional packages off | €221,400 |
| Premium furniture + kitchen + rainwater storage | €240,600 |

All totals include an **€18,000 client-held contingency**. The furniture upgrade adds €8,000; outdoor kitchen adds €12,800; rainwater storage adds €6,400. Exceptional ground conditions remain unpriced and excluded.

Terra Forma (€64,000) includes Ground Atelier (€18,000), Raincraft (€12,000) and Stone & Line (€34,000). Stone & Line includes Quarry North (€19,500). Timber Field (€32,000) includes Frame Studio (€9,000). These included prices are counted once. The kitchen is additional to the pavilion. Optional storage is additional to drainage even though drainage itself is included in the main contract.

Uniform 21% VAT is explicitly assumed for fictional arithmetic only. Suppliers, clients and prices are invented; no real commercial offers are represented. Images are generated concepts, not completed-project photography. The kitchen shown in the pavilion image is an optional addition.

## Design assumptions

The imagined plot is 40 × 35 m (1,400 m²). All drawings are schematic and require measured survey and technical design before any real implementation. The aerial image describes atmosphere; the masterplan describes conceptual adjacency. Plant names and quantities are an illustrative candidate palette, not verified horticultural specifications.

## Rebuild and install

From the repository root:

```sh
python3 scripts/build-garden-demo.py
node scripts/render-garden-demo.cjs
```

The renderer requires Playwright and Chromium. Set `PLAYWRIGHT_MODULE` and `CHROMIUM_EXECUTABLE` when using non-default installations. Existing generated artwork is preserved; rebuilding does not call an image API.

`scripts/import-garden-demo.py` requires Pillow and PyMuPDF, available in the application Docker image. Supply `--bundle`, `--database`, `--studio` and `--owner`. It verifies membership, backs up SQLite, creates only the new garden project in one transaction, and exits without changes if that project already exists. It invokes neither AI nor email.

`scripts/check-garden-demo.cjs` is an opt-in local acceptance check. It creates and removes a temporary session, visits all native slides, waits for every displayed image to decode, expands nested supplier rows, verifies option arithmetic and downloads linked supplier PDFs. Results are saved under `checks/`; standalone layout and navigation checks are in `render-checks.json`.

## Added visual studies

Two intentionally computer-made 3D design studies are included as native `render` slides, with model edges, simplified materials and geometry. Two handdrawn-style crayon sketches are included as native `drawing` slides. The existing presentation imagery is retained.

The new PNG originals and optimized WebP files are in [`assets/`](assets/), named `render-*` and `sketch-*`. Final prompts and refinements from the built-in image_gen tool are in [`additional-image-prompts.json`](additional-image-prompts.json); slide content and insertion points are in [`additional-slides.json`](additional-slides.json).

For already installed demos, `scripts/update-demo-visuals.py --database PATH --demos PATH --studio ID` adds only the new slides to the original drafts and versions the designed PDFs. It backs up SQLite, preserves original sources and budget choices, and is idempotent for an unchanged bundle. Fresh imports include the additions automatically.
