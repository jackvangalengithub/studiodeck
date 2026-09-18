# Interface languages

Studiodeck supports English and Dutch. Existing studios continue in English.

- **Studio settings → Studio language:** English or Nederlands. Only studio admins can change this default.
- **Project settings → Presentation language:** Same as studio, English, or Nederlands. Project team members can change it.
- **Your profile → Your language:** Same as studio, English, or Nederlands. This is an account-wide personal preference, including client accounts.

An explicit user preference wins over an explicit project preference. Otherwise the presentation inherits its own studio’s language. “Same as studio” in a user profile means no personal override; an explicit project language still applies. Studio switching never substitutes another studio’s default for a client project’s own studio.

Language changes apply to existing presentations and all iterations. The personal setting changes only that user’s view. Project and studio settings change the inherited default. The sign-in page has an independent language selector remembered in that browser; English is its initial default.

## Translation files

Client interface copy lives in `public/assets/languages/en.js` and `nl.js`. The English catalogue preserves the existing wording. `public/assets/i18n.js` resolves preferences, interpolates named placeholders, and provides Dutch date/currency formatting while retaining the existing English locales. Missing translations fall back to English. Count-specific entries end in `_one`.

Workspace and editor copy lives separately in `public/assets/languages/studio-en.js` and `studio-nl.js`. Shared interface labels reuse the client catalogue. Labels and presets are resolved when displayed so changing language does not require a reload.

Server-rendered sign-in copy and the budget helper use `app/languages/en.php` and `nl.php`. AI budget answers use the viewer’s resolved language. The login router embeds only the sign-in catalogue; application assets still require authentication.

Translate application labels, default slide headings, navigation, comments and question controls, budget controls, downloads, profile controls, and sign-in text. Do not translate user-authored slide titles, descriptions, custom group names, comments, questions, source filenames, source excerpts, or uploaded documents. Existing generated project content is also preserved. The studio workspace and editor use the personal override or the active studio’s default. A project’s language controls its presentation, not the surrounding workspace.

`migrate_languages()` adds the studio default and nullable-in-spirit overrides (stored as the empty string) to existing databases without replacing their content. Blank project/profile values continue to inherit future studio changes rather than copying the current default.

## Checks

```sh
node --test tests/test_languages.mjs tests/test_slides.mjs tests/test_csv_preview.mjs tests/test_budget_math.mjs
python3 tests/test_languages.py -v
node tests/test_languages_browser.mjs
```

The Python tests require PHP with SQLite and GD. The browser test accepts `PLAYWRIGHT_MODULE` and `CHROMIUM_PATH`. Tests use temporary databases or fictional API responses and send no email or AI requests.
