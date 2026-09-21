# First-project welcome

The Projects page shows a welcome experience only when the selected studio has no projects at all. The `projects` API returns `studio_empty`, calculated independently of archive filtering and project membership. This exposes only a boolean, not private project counts, names or IDs. Search results, archived-only studios and members without access keep the normal project list.

The page provides direct project creation, a one-minute video and an interactive tour through the real app. New studio admins first complete the [studio identity wizard](studio-setup.md), choosing their language, studio name and business type. Billing setup does not open automatically over the welcome page. Choosing to create a project still runs the existing setup and billing/access checks, then opens the wizard at **How it works**, including after watching the video or finishing the tour. File upload remains optional. Once a project is created, the normal dashboard returns; a studio whose last project is permanently deleted qualifies for the welcome again.

## Learning paths

- The video is a 60-second sequence of captured product screens with warm AI narration and an original, quiet ambient score, served from the authenticated app assets. It plays only after a Play click, with native controls, English/Dutch narration and captions selected by the app language, and a readable transcript. A short label identifies the AI narration. Audio is embedded in each video, so native volume, mute, pause and seek controls apply to the whole soundtrack. The authenticated asset gateway serves WebM byte ranges for seeking. It uses no third-party video service. The app tour remains available if video playback fails.
- The app tour opens the actual app in an isolated practice frame with sample files and a budget. A highlighted box marks the current control, and an instruction card explains the action. Customers use the real Presentation tab, slide editor, preview, budget option and comment form. The guide advances only when the requested action completes; editing requires a changed title to be saved, and feedback requires a successfully added comment. Back, Skip, Exit and recovery for closed controls are available. Keyboard focus follows the highlighted control; the instruction card stays visible on mobile.
- `app-tour.js` supplies the practice frame with an in-memory data adapter. Every API call in tour mode is intercepted with no server fallback, so the tour never creates a real project, sends email, consumes a slot or runs AI. Parent studio state and URL remain intact. Exiting discards practice edits, and another tour starts fresh. Parent messages are checked against both the frame window and the same origin. The authenticated `/index.html?app-tour=1` entry permits same-origin framing; other pages keep `X-Frame-Options: DENY`.
- A Getting started entry in the sidebar keeps both learning paths accessible after the first project exists.
- The first project created from an empty studio gets a dismissible checklist. File and sharing completion come from project data; opening a real preview records the review step. Sharing still requires the existing client-selection and confirmation flow.

Checklist preferences and the first-project ID live in local storage, scoped to the signed-in user and studio. These preferences survive reloads in that browser but do not sync across devices. Clearing browser storage resets them. No analytics or new external services are configured by this feature.

## Implementation

`public/assets/onboarding.js` owns the welcome, practice frame, video dialog and checklist. Copy is in `onboarding-copy.js` (English and Dutch); styling is in `onboarding.css`. The onboarding module receives navigation callbacks but no API client. `app-tour.js` owns sample data, highlighting and action-based advancement. `app.js` uses its normal rendering and event handlers inside the practice frame. `app.js` connects it to the existing wizard, preview and sharing flows.

The video, poster and WebVTT tracks are in `public/assets/onboarding/`. To rebuild them after the product UI changes:

```sh
PLAYWRIGHT_MODULE=/path/to/playwright \
CHROMIUM_EXECUTABLE=/path/to/chromium \
FFMPEG_BIN=/path/to/ffmpeg \
node scripts/build-onboarding-tour.cjs
```

The generator uses the fictional full-app fixture in `tests/fixtures/onboarding-server.cjs`; no account, database or credentials are used. The installed FFmpeg needs MJPEG input, VP8 and Opus encoding, FLAC decoding and WebM output; Playwright's stripped-down FFmpeg is no longer sufficient. The generator reuses the committed audio masters in `scripts/assets/onboarding/` and does not call a speech service. `tour.webm` is English and `tour-nl.webm` is Dutch.

To regenerate the soundtrack after changing the caption copy, run:

```sh
FFMPEG_BIN=/path/to/full/ffmpeg python3 scripts/build-onboarding-audio.py
```

This separate build step requires Python 3 with NumPy and an `OPENAI_API_KEY` in the environment or local `.env`. It sends only the generic caption sentences to OpenAI's speech endpoint, using `gpt-4o-mini-tts` and the `marin` voice. See the [official speech guide](https://developers.openai.com/api/docs/guides/text-to-speech). Generated speech is cached by text, voice and instructions under ignored `storage/onboarding-audio/`. Each line is fitted to its caption window without changing pitch, normalized, and mixed with a locally synthesized original score (soft pads and keys, no third-party music assets). The script saves reusable FLAC masters and muxes both finished videos. It requires an existing `tour.webm` as the visual source. Playback needs no API key or external connection.

Captions in the video generator, the committed WebVTT tracks and the transcript should be updated together when the story changes. Regenerate audio after updating the captions, then rebuild the video to refresh the captured UI.

## Verification

```sh
PLAYWRIGHT_MODULE=/path/to/playwright \
CHROMIUM_EXECUTABLE=/path/to/chromium \
node tests/test_onboarding.cjs

python3 tests/test_onboarding.py
```

The browser test serves the real frontend with fictional API responses and writes desktop/mobile screenshots to `/tmp/studiodeck-onboarding` (override with `STUDIODECK_ONBOARDING_ARTIFACTS`). It covers eligibility, setup handoff, practice-session isolation and action-based advancement, escaping, project creation, checklist progress and dismissal, captions, English/Dutch audio decoding and seeking, English/Dutch copy and mobile overflow. The Python test exercises the real API with an isolated temporary SQLite database and log-only email, including archived/private projects, studio switching, authenticated tour asset MIME types, byte ranges and unauthenticated range rejection. It needs the PHP dependencies in the Docker image.
