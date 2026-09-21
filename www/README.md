# Studiodeck marketing website

A standalone, responsive marketing site for interior designers, architects, garden designers and design firms. Built with HTML, CSS and vanilla JavaScript. No build step, runtime packages, CDN dependencies, tracking or backend.

## Preview

From the repository root:

```sh
python3 -m http.server 4180 --directory www
```

Open http://localhost:4180. You can also open `www/index.html` directly. The existing application's preview server serves `public/`, not this directory.

Upload the contents of `www/` to any static host. All assets and internal references are relative, so it can also live under a `/www/` subdirectory. The marketing site does not change the PHP application's routes or files.

## Included

- Editorial design using the exact seven Warm grayscale colors from `public/assets/studio.js`, with locally hosted fonts and imagery.
- Original AI-generated luxury villa exterior and architectural garden in `assets/architecture.jpg` and `assets/garden.jpg`, plus three original AI-generated villa interiors: Mediterranean, Japandi and contemporary classic. Panoramic hero and supporting project imagery. Prompts are in `assets/villas/PROMPTS.md`.
- An opening business-type selector with the same five choices and exact image files as studio setup: interiors, gardens/landscapes, architecture, furniture/cabinetry and events/exhibitions. Selection updates the hero, presentation, approval and portfolio examples. The `audience` URL parameter preserves a choice on refresh or when shared; no cookies or local storage are used.
- Dedicated customer communication/approval and Website add-on sections, with illustrative project conversations and connected portfolio showcases. Website pricing remains €39/month.
- Interactive sample presentation: vision, palette, budget sources and client feedback.
- Expanded image viewing, keyboard-accessible tabs and dialogs, mobile navigation, native FAQ disclosures, and reduced-motion support.
- Monthly-only subscriptions at €39/€199/€399, plan details and downloadable text summaries. All AI features are included. Image alterations have an allowance of 10 per project per calendar month, or 10 total with a Project Pass.
- Included active-project capacity of 3/15/50, plus extra active projects at €10 each per month. Studio supports up to 5 people; Practice includes 15, with extra people at €20 each per month.
- A prominent €19.00 one-time Project Pass with 150 days of access above the Solo, Studio and Practice plans.
- A top-of-page drag-and-drop / AI assembly showcase with a magic-wand illustration and an illustrative client AI conversation. The opening message emphasizes keeping existing design tools and workflow.
- Honest launch status, illustrative-project labels and privacy/credit information.

The demo intentionally uses fictional project data. Its comments only exist in page memory. Downloads are generated locally. No email is sent, no account is created and no payment is collected.

## Commercial decisions

See [PRICING.md](PRICING.md) for the recommended packages, alternatives, economics and launch decisions. The app implements these packages, Stripe checkout, trials, project/seat limits and image allowances. Actual purchasing requires the deployment’s Stripe configuration.

Before enabling purchasing, configure the application origin, Stripe products, tax handling and production billing terms. Plan dialogs link into signup; payment happens in the authenticated app.

Audience labels and image files are copied from `public/assets/studio-types.json` and `public/assets/studio-types/` so this site stays independently deployable. Keep `audience.js`, selector labels and `assets/studio-types/` aligned with that catalog.

Plan amounts are in `script.js` and the static HTML in `index.html`; keep those in sync when editing. Plan features are in `index.html`. Exact app color tokens and base styling are in `styles.css`; the editorial layout is in `luxury.css`. Photograph and font provenance is in [assets/SOURCES.md](assets/SOURCES.md).

## Validation

Checked in Chromium at 320, 375, 390, 768, 1024, 1440 and 1920 CSS pixels. Browser checks cover resource loading, horizontal overflow, the mobile menu, monthly prices, plan selection, downloaded summaries, keyboard tabs, budget source disclosure, safe text-only sample comments, expanded images, FAQ and privacy dialogs.

No changes or tests are required in the separate PHP application for this static site.

## Signup connection

Set the `studiodeck-app-url` meta tag in `index.html` to the deployed application origin (for example `https://app.example.com`). Empty uses the marketing page’s origin. The trial CTA and plan dialog link to `/login`; payment is handled inside the PHP app through Stripe. For separate local preview servers, set this to the PHP server origin. See [billing setup](../docs/billing.md).

`tests/test_marketing_browser.mjs` checks audience switching, shared wizard images/labels, refresh and direct links, responsive layouts, example interactions and unchanged pricing. Serve `www/` and supply `MARKETING_TEST_URL`, `PLAYWRIGHT_MODULE` and `CHROMIUM_EXECUTABLE` as needed.
