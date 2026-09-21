# First-time studio setup

New studios open a three-step introduction: English or Dutch, studio name, then one of five business types. Completing the wizard stores `language`, `name`, `business_type`, and `setup_completed_at` on the studio. Only studio admins can complete setup or change these settings. Repeated completion requests cannot overwrite a finished setup.

Studio settings includes a Business type selector. Its choice updates My Projects and Website welcome images, localized introductory copy, and the three recommended website templates. All ten layouts remain available. Template previews and newly started websites use the selected niche's imagery and example copy. Existing website source, revisions and published releases remain untouched when studio settings change.

The shared catalog is `public/assets/studio-types.json`; PHP and the browser both read it. Stable IDs are `interior`, `landscape`, `architecture`, `furniture`, and `events`. Photos live in `public/assets/studio-types/`.

The `studio-setup-v1` migration gives established studios with projects the existing interior defaults and marks setup complete. Empty studios receive the introduction; invited members and client guests do not. Setup completion does not activate or consume a billing trial.

Checks: `python3 tests/test_studio_setup.py`, `node tests/test_studio_setup.cjs`, and `php tests/test_website.php`. The browser test supports `PLAYWRIGHT_MODULE`, `CHROMIUM_EXECUTABLE`, and `STUDIODECK_SETUP_ARTIFACTS`. API checks use a temporary database and log-only email.

## Image provenance

Interior, landscape, architecture and furniture assets reuse the generated Villa Auren and Stillwater Garden demo photography. Event imagery was generated with the built-in imagegen tool, then encoded to WebP for the app. Final assets are `public/assets/studio-types/{interior,landscape,architecture,furniture,events}.webp`.

Event image prompt:

> Use case: photorealistic-natural. Asset type: photographic choice tile and website hero for an event and exhibition design studio. Create one beautifully composed editorial architectural photograph of a contemporary temporary exhibition and launch event installation in a tall converted industrial gallery. Sculptural translucent warm ivory fabric ribbons suspended overhead, curved clay-colored display plinths, artful botanical arrangement, softly glowing amber lights, carefully designed circulation and tactile natural materials. Spacious but visibly designed for a special event, sophisticated creative studio aesthetic. Wide landscape framing, main installation centered so it also crops elegantly to portrait; believable physical construction and subtle real textures. No people, no readable text, no logos, no watermarks. Warm atmospheric light, restrained cream, terracotta and olive palette. High-end magazine photography, not a 3D rendering.
