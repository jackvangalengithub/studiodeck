# Frontend navigation and code execution policy

The live application uses native anchors for navigation. Ordinary primary clicks keep the SPA's batched loading behavior. Ctrl/Cmd-click, Shift-click, middle-click, context menus and copy-link use browser behavior. Commands and form submissions remain buttons.

## Implementation

`public/assets/navigation.js` contains the navigation registry and the panel URL codec. The shared DOM helper resolves registered view controls to anchors before inserting them. Links have destinations immediately; they do not need a first click to obtain a URL. Disabled controls retain native disabled-button semantics. The click dispatcher leaves modified clicks alone and only intercepts ordinary same-origin navigation.

Existing workspace, project, tab, iteration, filter and slide URLs remain valid. Viewer destinations extend their containing route with `panel` and a JSON `selection` query parameter. Both the operation and its string fields are allowlisted. These parameters cannot dispatch save, approval, upload, deletion or publication operations. Refresh and Back/Forward restore the underlying route before opening its selection. Record access remains subject to platform authorization.

Project preview links can use `presentation=1` when the first slide is not yet loaded. Studio editor links to hidden slides use `preview=hidden`; client presentation routes do not interpret this flag.

## Navigation inventory

| UI locations | Registry actions / destination |
| --- | --- |
| Logo, Projects sidebar, project breadcrumb | `projects` |
| Project overview cards and Preview menu | `open-project`, `preview-project` |
| Workspace chooser, studio/client project entry points | `destinations`, `destination-studio`, `destination-client`, `client-view` |
| Account menu and sidebar profile | `profile`; dialog context preserved when opened from a presentation or chooser |
| Sidebar communication, users, settings, billing, website; package banners | `all-comments`, `studio-users`, `settings`, `billing`, `website` |
| Project tabs and overview shortcuts | `tab`, `project-clients`, `contacts`, `review-processed`, `studio-communication` |
| Presentation cover and overview/editor slide cards | `preview`, `open-editor-slide` |
| Presentation thumbnails, previous/next, section-menu slide entries | `go-slide`, `prev-slide`, `next-slide`, `jump-section` |
| Editor group entries, presentation mode, reading-mode top | `editor-section`, `presentation-mode`, `scroll-top` |
| Iteration choices, return to editor/presentation | `switch-iteration`, `exit-preview`, `comm-back` |
| Communication subject rows and linked conversations | `comm-thread`, `comm-open`, `comm-location` |
| Open-item rows, question context and pending approvals | `comm-open`, `comm-location`, `discuss-open-question`, `comm-pending`, `project-pending` |
| Communication views, pagination and presentation communication panel | `communication-filter`, `comm-view`, `communication-page`, `comm-show`, `studio-checklist` |
| Original slide, commented slide, linked budget/confirmation | `comm-source`, `comment-slide`, `comm-budget`, `comm-budget-source` |
| File/image/CSV previews and extracted content | `preview-image`, `preview-csv`, `preview-extracted` |
| Document pages, originals, history and reference documents | `review-pages`, `originals`, `history`, `project-documents` |
| Evidence and citations | `comm-evidence`, `legal-citation`, `check-evidence` |
| Presentation budget viewer | `studio-budget` |
| Original/current/attachment/pack downloads | Native platform userfile links when file metadata is available |
| Extracted image downloads | Native file links when metadata is available; generated text exports remain commands |
| Website entry/exit, Chat/Code, source file/scope | `website-enter`, `website-leave`, `website-tab`, `website-file`, `website-source-scope` |
| Website pages, existing project pages, materials and images | `website-open-page`, `website-pages`, `website-manage-projects`, `website-materials-tab`, `website-images` |
| Website design gallery, categories, design previews and return | `website-gallery`, `website-filter-style`, `website-example`, `website-gallery-back`, `website-gallery-close` |
| Feedback inbox, report detail, theme selection, pagination | `product-feedback-inbox`, `feedback-report`; filter submissions update the same URL state |
| Sign-in and project access return/read links | `/login`, `billing-access-back`, `billing-access-read` |

Already-native links include shared conversation destinations, email/telephone contacts, invoice/PDF links, published websites and external media links. Save/delete/archive/pin, create/edit forms, approvals, checkout-session creation, sharing commands, uploads, generated exports, zoom, playback and menu disclosures remain buttons. Select inputs remain native selects; their choices are not anchors.

The frozen tutorial remains an isolated demo with its own navigation rather than live workspace destinations.

## No eval

- CSP omits `unsafe-eval`, `trusted-types-eval` and `wasm-unsafe-eval`. Trusted Types policy creation remains disabled.
- `scripts/check-no-eval.mjs` rejects evaluator references and aliases, indirect eval, dynamic function constructors, constructor extraction, reflective evaluator access and string/unknown timer callbacks.
- Every shipped JavaScript file is checked, including mock and vendor code. Reviewed vendor bundles retain SHA256 integrity pinning. Non-compiling `Function.prototype` utilities and class metadata are permitted.
- The static guard catches prohibited source patterns; CSP is the runtime boundary against obfuscation and arbitrary dataflow. Tests execute real page scripts to check rejection; DevTools evaluation is not used as proof of page-level CSP enforcement.
- `npm test`, CI, the development precheck and Docker build enforce the checks. The policy applies to StudioDeck's served shells. Platform-owned proxied authentication pages retain the platform's policy.

## Verification and existing integration limits

Browser tests cover native new-tab behavior, keyboard links, image-independent navigation, one-batch project/communication transitions, failed/superseded requests, URL restoration, hidden-slide previews, direct downloads, feedback filters and typography parity. Typography selectors preserve the specificity of the original button selectors.

This change does not enable unavailable platform features such as website publishing or billing. Their links preserve existing error handling. The feedback adapter supports server-side filtering, pagination and direct report lookup; global theme suggestions and aggregate counts are still absent from its platform response and are not fabricated. Legacy generated exports or downloads without a known native file ID retain their existing action handler.
