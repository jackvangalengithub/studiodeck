# Asset sources

All production assets are served locally. There are no runtime image or font requests to third parties.

## Retained stock assets (not used by the current page)

Photographs obtained from Unsplash's image CDN. They are illustrative stock imagery, not customer work, testimonials or claimed Studiodeck outputs. Use is subject to the [Unsplash license](https://unsplash.com/license).

| Local file | Source |
| --- | --- |
| `interior.jpg` | https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1600&q=88 |
| `detail.jpg` | https://images.unsplash.com/photo-1613977257592-4871e5fcd7c4?auto=format&fit=crop&w=1200&q=88 |

## Typography

- **DM Sans variable (active site typography)** — [Google Fonts family](https://fonts.google.com/specimen/DM+Sans), [license source](https://github.com/google/fonts/blob/main/ofl/dmsans/OFL.txt). License included in `LICENSE-dm-sans.txt`.
- **DM Serif Display Regular and Italic** — [Google Fonts family](https://fonts.google.com/specimen/DM+Serif+Display), [license source](https://github.com/google/fonts/blob/main/ofl/dmserifdisplay/OFL.txt). License included in `LICENSE-dm-serif-display.txt`.

Fonts are distributed under the SIL Open Font License 1.1. Local files are unmodified downloads.

The favicon and CSS interface illustrations were created for this website. The feature illustrations are conceptual; the architecture photograph does not claim to demonstrate an actual AI before/after result.


## Original villa concepts

Three villa interiors, a luxury villa exterior and an architectural garden were generated with the built-in image generation tool for this site. They are illustrative concepts and are labelled as AI-generated; they are not client work or actual completed villas. The exact prompts are in [villas/PROMPTS.md](villas/PROMPTS.md).

- `villas/villa-mediterranean.png` / `.webp`: Mediterranean arches, travertine and a sea view.
- `villas/villa-japandi.png` / `.webp`: sunken linen seating and a Japanese courtyard.
- `villas/villa-classic.png` / `.webp`: contemporary classic salon with arched windows.

The PNG files preserve the generated originals; the website uses WebP encodings at the same 1536 × 1024 resolution. No visual edits were made during encoding.

Additional typography: [Cormorant Garamond](https://fonts.google.com/specimen/Cormorant+Garamond), SIL Open Font License 1.1, included as `LICENSE-cormorant-garamond.txt`.

- `architecture.jpg`: original AI-generated luxury limestone estate exterior, replacing the previous stock image at the same path. The generated PNG is preserved in `villas/villa-exterior.png`. The exact exterior prompt is recorded in [villas/PROMPTS.md](villas/PROMPTS.md#villa-exterior). The JPEG preserves the 1536 × 1024 composition.

- `garden.jpg`: original AI-generated landscape-architecture concept with limestone stepping stones, reflecting water, terraced planting and a garden pavilion. Original: `villas/architectural-garden.png`. [Exact prompt](villas/PROMPTS.md#architectural-garden). The JPEG preserves the 1536 × 1024 composition.

The site uses locally hosted `dm-sans-variable.ttf` from the [Google Fonts variable source](https://github.com/google/fonts/blob/main/ofl/dmsans/DMSans%5Bopsz%2Cwght%5D.ttf), with true light headings (weight 300) and regular body text. The older static and serif font files are retained as unused assets.

## Shared studio setup imagery

`studio-types/{interior,landscape,architecture,furniture,events}.webp` are unmodified copies of `public/assets/studio-types/`. The selector and audience-specific examples use the same images as the app’s setup wizard. Interior, landscape, architecture and furniture imagery comes from the generated Villa Auren and Stillwater Garden demo assets; the event concept was generated for studio setup. See [studio setup provenance](../../docs/studio-setup.md). These are illustrative generated concepts, not completed customer projects.

## Sign maker category

`studio-types/signmaker.webp` is an identical copy of `public/assets/studio-types/signmaker.webp`, prepared at 1200 × 800 from an original image generated with the built-in image generation tool. It is an illustrative concept, not client work. See [the generation prompt](studio-types/SIGNMAKER-PROMPT.md).
