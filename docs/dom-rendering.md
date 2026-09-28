# Safe DOM rendering

All first-party frontend rendering, including the conversation page and frozen
communication demo, now creates DOM nodes. There is no runtime HTML template
parser, HTML insertion boundary, or Trusted Types policy that accepts raw HTML.

Use `e(tag, props, children)` from `public/assets/dom.js` for new UI code:

```js
import {e} from './dom.js';

container.replaceChildren(e('article', {className: 'project-card'}, [
  e('h2', {}, project.name),
  e('p', {}, project.description),
  e('button', {type: 'button', on: {click: () => openProject(project.id)}}, 'Open'),
]));
```

Strings and numbers become text nodes. Pass raw text, not HTML-escaped text.
`<img onerror=...>` in a title stays visible text. Nested arrays and existing DOM
nodes can be composed; existing nodes and function listeners are trusted code.
Keep tag names, prop names, CSS declarations and action names in application code.
Do not spread arbitrary API objects into props or treat incoming JSON as a view.

## Composing and reusing views

`public/assets/render.js` supports the existing modular renderers with structured,
reusable descriptions. `element`, `fragment`, `join`, `concat` and translation
interpolation retain their node structure. `mount`, `append`, `replace` and
`insert` construct native nodes through `e()`. They never parse strings as HTML.
A private WeakMap brands descriptions and attribute fragments; API objects cannot
impersonate them. Reusing an icon description creates fresh SVG nodes.

`attributes` and `spread` compose application-created props. Raw attribute strings
are rejected. `plain` extracts text; it is not an HTML serializer. `update` avoids
replacing unchanged progress controls, preserving keyboard focus during polling.
The small `esc` callbacks retained in legacy module interfaces now only normalize
values to strings; they do not perform HTML escaping.

## Context-specific checks

The helper allows a limited set of HTML/SVG elements and attributes, plus `data-*`
and `aria-*`. Events are function listeners in `on`. Inline handlers, custom
elements, script/style/object/embed elements, `srcdoc`, `srcset`, and raw HTML
props are rejected. Selects, inputs and textareas receive literal values.

`safeUrl` validates URL props and native URL assignments after browser URL parsing.
Links allow HTTP(S), relative URLs, mailto and tel. Media/form URLs allow HTTP(S)
and relative URLs. Media can also use same-origin blobs and base64 raster images;
blob links require a download attribute. Script schemes and HTML data URLs fail.
CSS is assigned through the CSSOM; resource URLs, imports, expression/binding
syntax and CSS escapes are rejected in style strings. Theme colors have their
existing color validation as well.

Website previews remain isolated documents in sandboxed iframes. They never become
markup in the parent app. Frames created through the helper require a sandbox
without `allow-same-origin`. The interactive tutorial also uses this isolation;
its storage is optional and its messages must come from the exact frame window
with the expected opaque origin. CORS access is enabled only for public static
assets in Caddy so its JavaScript modules and fonts can load.

## Enforcement

Run `npm ci` and `npm test`. `npm run check:dom` scans shipped first-party JS/HTML,
including auth code and the frozen demo, using an AST. It rejects HTML sinks,
constant-computed sink names, dangerous property aliases, inline code, dynamic
code execution, unchecked URL assignments, and direct active-element creation.
The two bundled editor/formatter dependencies are pinned by SHA-256 in
`scripts/dom-vendor-integrity.json`; changing either requires reviewing it and
renewing that entry. Their HTML editing/formatting is covered by a browser test.
GitHub Actions runs `npm test` on pushes and pull requests.
The production Docker build runs the checks and DOM regressions before copying
public assets into the Caddy image. Caddy needs no Node runtime.

Caddy and the static app shells enforce:

```http
Content-Security-Policy: script-src 'self'; script-src-attr 'none'; object-src 'none'; base-uri 'self'; require-trusted-types-for 'script'; trusted-types 'none'
```

In supporting browsers, HTML-insertion APIs reject string assignments with a
TypeError. No Trusted Types policy may be created to bypass this. Inline scripts
and event handlers are blocked too. The initial static HTML document is parsed
normally; the policy does not automatically turn attempted HTML insertion into
text. The platform's proxied authentication pages retain their own policy.

Older browsers may ignore Trusted Types. The node-only renderer and contextual
validation provide the primary protection there. The source checker is a guard
against regressions, not a formal proof about all JavaScript or a substitute for
reviewing new DOM APIs, dependency changes, URL contexts or sandbox permissions.

Browser checks (batch tests need the local frontend running):

```sh
PLAYWRIGHT_MODULE=/path/to/playwright CHROMIUM_PATH=/path/to/chrome npm run test:browser:dom
```

The regressions cover literal names/messages/CSV/mentions, malicious slide titles,
URL and prop rejection, browser-enforced sink blocking, the website source editor,
isolated tutorial messaging, project tabs and the existing filename-in-modal XSS
case. Batch navigation still switches after its data response, without waiting for
images. See [MDN Trusted Types enforcement](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/require-trusted-types-for).
