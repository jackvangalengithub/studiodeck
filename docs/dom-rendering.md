# Safe DOM rendering

Use `e(tag, props, children)` from `public/assets/dom.js` for new UI code.
Strings and numbers become text nodes; nested arrays and existing DOM nodes can
be composed without HTML parsing. Pass raw user text, not HTML-escaped text.

```js
import {e} from './dom.js';

const card = e('article', {className: 'project-card'}, [
  e('h2', {}, project.name),
  e('p', {}, project.description),
  e('button', {type: 'button', on: {click: () => openProject(project.id)}}, 'Open'),
]);
container.replaceChildren(card);
```

The helper allows ordinary HTML elements and a limited set of attributes, plus
`data-*` and `aria-*`. `className`, `htmlFor`, `tabIndex` and `readOnly` are aliases.
Events are function listeners in `on`; inline event attributes are rejected.
Form values are assigned as values, including textarea and select elements.
Use classes for styling; style strings and objects are deliberately unsupported.

`href` allows relative/HTTP(S), mailto and tel URLs. `src`, `poster` and `action`
allow relative/HTTP(S); media URLs also accept same-origin blobs. Script schemes,
`data:` URLs and unhandled URL props such as `srcset` are rejected. Add future
attributes deliberately with their corresponding validation and browser tests.

There is no `innerHTML`, `outerHTML`, `srcdoc`, raw-HTML child or custom-element
escape hatch. Script, style, iframe, object and similar active elements cannot be
created through this helper. Supplied DOM nodes and function listeners remain
trusted application code; the helper does not sanitize arbitrary existing nodes.
Keep tag names, prop names and `data-action` values application-owned. Do not
spread arbitrary API objects into props.

## Existing template boundary

This is an incremental migration. The frontend still has HTML string templates,
which require contextual escaping. The helper does not make those templates safe.
Shared modal titles now always use text nodes; callers must pass unescaped titles.
Modal bodies accept DOM nodes, while existing HTML bodies remain supported through
one documented template boundary. The close icon is fixed application SVG.

A filename previously reached the modal heading unescaped through extracted-file
preview. The browser regression reproduced markup injection before the fix and
now verifies literal text, no injected elements and no script execution. This
also protects other user-derived modal titles, including document-page names and
website project/testimonial names. Previously escaped filename/budget titles have
been adjusted so ampersands and angle brackets display correctly.

Continue replacing template bodies with nodes by feature. Until then, retain
`esc()` for text and quoted attribute interpolation in those bodies, and validate
URL schemes separately. Keep rich text/website HTML behind an explicit, separately
reviewed sanitization or sandbox boundary; do not add a generic raw-HTML prop.

Reference: [OWASP DOM-based XSS prevention](https://cheatsheetseries.owasp.org/cheatsheets/DOM_based_XSS_Prevention_Cheat_Sheet.html).
