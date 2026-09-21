# Haus Morgenlicht — Demo 03

An old Austrian chalet opened to air, light and mountain views. This fictional conversion keeps the roof silhouette, stone plinth, weathered beams and green tiled stove, then introduces pale fir, warm plaster, mineral stone, generous glazing and soft Alpine textiles.

## Open the project

- **StudioDeck:** [Haus Morgenlicht · Austrian chalet demo](http://localhost:8199/85c6b0cceb613adb3b2c8e0db4f63d25/projects/200ba7b5da42242890fb71fcb885b4bf), pinned alongside Villa Auren and Stillwater Garden.
- **Standalone presentation:** `index.html`, with arrow-key navigation, fullscreen and download links.
- **Designed PDF:** `Haus-Morgenlicht-Presentation.pdf`, 34 landscape pages.
- **Source library:** `supplier-index.html`, including 19 fictional supplier quotations and supporting schedules.

The native StudioDeck presentation has **36 visible slides**, with editable text, original imagery, moodboards, before/proposed comparisons, zoomable plans, an interactive budget, contacts and source downloads. The initial iteration is a draft, and the unused Changes section is hidden in client preview. The importer sends no invitations and creates no share links.

## The visual story

**15 original images:** two imagined before views, the proposed summer and winter exteriors, the proposed living room, kitchen, bedroom, ski/hiking arrival, optional wellness room, optional terrace, a mountain landscape, two tactile moodboards, and two classic 3D model studies.

The proposed exterior was edited from the imagined original; the winter exterior was edited from that summer proposal. The proposed living room was edited from the original interior, keeping the beams, stove, room boundaries and camera view recognisable. All images—including the before views—are generated fictional studies, not site photographs or proof of completed works.

Images were made with the **built-in image_gen tool** and the imagegen skill. `image-prompts.json` contains the final prompts and reference relationships. Original PNGs and optimized WebP assets are saved in `assets/`.

## Plans and project documents

- Four editable SVG drawings and PNG exports: imagined existing main floor, proposed main floor, proposed upper floor, and a section through the chalet.
- Before/proposed exterior and interior comparisons, plus a summer/winter diptych.
- Material palette, conversion strategy, intervention schedule and 40-week indicative programme.
- Nineteen single-page fictional supplier quotes, with their editable HTML sources.
- Twenty-one budget rows, including included subquotes at several levels, optional packages, a furniture range, contingency and unknown conditions.
- `budget.csv`, `materials.csv`, `interventions.csv`, `programme.csv` and `scope.pdf`.
- `manifest.json`, `presentation.css`, `quote.css`, HTML and individual slide JPEGs for reuse.

## Investment story

| Selection | Fictional amount |
| --- | ---: |
| Base furniture, options off | €687,500 |
| Premium furniture, options off | €703,500 |
| Premium furniture + wellness + terrace | €750,900 |

Every total includes a **€62,000 client-held contingency**. Furniture upgrades add €16,000; wellness adds €34,800, including its €14,800 sauna; terrace living adds €12,600. Concealed timber defects and unforeseen ground work remain unknown and excluded.

Alpen Bauatelier (€248,000) includes structure (€92,000), roof/fabric (€98,000) and building services (€58,000). Services include electrical (€24,000) and heating/ventilation (€34,000). Panorama Werk (€104,000) includes glazing supply (€64,000). Fir Atelier (€78,000) includes appliances (€16,000). Included subquotes are counted once. The optional wellness package and its included sauna remain disabled until the parent option is selected.

Uniform 20% VAT is an explicit fictional arithmetic assumption, not a tax determination. All suppliers, clients, offers and costs are invented. Wellness and terrace imagery shows optional packages.

## Design assumptions

The concept assumes approximately 280 m² of interior accommodation across three levels on a sloping Alpine site. Drawings are unmeasured studies, not construction documents. Actual condition, structure, roof geometry, services, energy performance, access, approvals and safety requirements require professional assessment for any real project. The illustrative before images establish a design narrative only.

## Rebuild and install

From the repository root:

```sh
python3 scripts/build-chalet-demo.py
node scripts/render-chalet-demo.cjs
```

The renderer needs Playwright and Chromium. Set `PLAYWRIGHT_MODULE` and `CHROMIUM_EXECUTABLE` for non-default installations. Existing artwork is preserved; rebuilding does not invoke image generation.

`scripts/import-chalet-demo.py` uses Pillow and PyMuPDF, available in the application Docker image. Supply `--bundle`, `--database`, `--studio` and `--owner`. It verifies studio membership, creates a database backup, and imports the new project in one transaction. If the project already exists, it exits without changing it. It makes no AI or email requests.

`scripts/check-chalet-demo.cjs` verifies the installed local demo using a temporary session that is removed afterwards. It checks all visible slides and displayed images, before/proposed labels, nested supplier expansion, source downloads and budget scenarios without resetting saved user choices. Results are in `checks/`; standalone render checks are in `render-checks.json`.

## Added visual studies

Two intentionally computer-made 3D design studies are included as native `render` slides, with model edges, simplified materials and geometry. The existing presentation imagery is retained.

The new PNG originals and optimized WebP files are in [`assets/`](assets/), named `render-*`. Final prompts and refinements from the built-in image_gen tool are in [`additional-image-prompts.json`](additional-image-prompts.json); slide content and insertion points are in [`additional-slides.json`](additional-slides.json).

For already installed demos, `scripts/update-demo-visuals.py --database PATH --demos PATH --studio ID` adds only the new slides to the original drafts and versions the designed PDFs. It backs up SQLite, preserves original sources and budget choices, and is idempotent for an unchanged bundle. Fresh imports include the additions automatically.
