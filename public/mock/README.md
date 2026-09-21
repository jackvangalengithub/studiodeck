# Communication & confirmations mock

Open `/mock` on the running app. This isolated snapshot uses the actual StudioDeck workspace and unchanged core stylesheet. The new behavior lives in Communication; there are no separate approval, signing, or release screens.

## Try it

- Browse the Hallway paint, Kitchen installation, and existing slide-comment conversations.
- Use **Post reply** for a normal message, or **Ask for confirmation** to choose a recipient.
- Optionally attach an existing project file or upload a local image/PDF.
- Toggle **Include a budget change** and enter a positive or negative amount. The help icon explains extra costs versus cheaper options. Amounts in this example include VAT.
- Use **View as** to become the recipient. Confirming a cost-changing request adds a linked adjustment to the existing Budget tab exactly once. Pending requests do not affect totals. The example permits Sophie and Emma to confirm spending changes; Thomas can confirm non-financial details.
- Use **Confirmations**, **Pending only**, and the person filter for the checklist. Open any item to return to its full conversation.
- Use **Reset** to restore the sample data and remove local uploads.

The seeded examples include a pending €1,000 paint upgrade, a confirmed paint colour without a cost change, and a client asking the designer to confirm an installation detail. Confirmation requests can be withdrawn while pending. Confirmed wording, amounts, recipient, timestamp, and file versions are preserved. Confirmed budget rows link back to their source message and cannot be silently edited through the cost editor.

Original slide comments and replies are included in Communication. Replies posted on those threads also enter the app's existing comment data. Source links open the original presentation slide. New comments entered from the presentation appear in Communication after the app refreshes its data.

## Demo boundaries

All actions are local to this browser tab. Confirmation requests, replies, budget adjustments, selected conversation, filters, and attachments survive reload using session storage. Nothing is sent to a backend, client, subcontractor, or signing service.

Uploads accept images/PDFs up to 2 MB each and 3 MB combined, to keep the local session within browser storage limits. Preview preparation is simulated; this mock does not extract document text or run the production processing worker. Files are also listed in the app's Files view, and their exact versions remain attached to requests.

## Source

- `assets/app.css` and `assets/studio.js` retain the actual app appearance.
- `assets/app.js` contains small integration hooks and forces the local demo backend.
- `assets/demo.js` contains the fictional project and an idempotent bridge for confirmed adjustments, attachments, and original comment replies.
- `mock.js` implements conversation messages, confirmations, attachment selection, and budget changes.
- `mock.css` styles only the new components.

This is a frozen snapshot for review. To remove it, delete `public/mock` and remove the mock-specific handlers from `public/router.php` and `scripts/preview.mjs`.
