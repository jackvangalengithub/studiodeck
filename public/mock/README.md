# Communication design mock

Open `/mock#comments` on the running app. This is an isolated, interactive design prototype inside the existing StudioDeck workspace.

## Review the design

- **Kitchen installation** shows a Conversation in blue.
- **Review the material samples** shows a To do in amber.
- **Washable paint for the hallway** shows an Approval in green, with a budget adjustment.
- All three use the same rounded header, typography, person row, and 58px round completion control with a large checkmark.
- Thread items stay white and warm grey, including the selected item. Type colors are confined to the message header.
- Hover or focus the completion control for **Mark as done** / **Mark as open**. Click, Enter, or Space toggles the state.
- Use **All**, **Open**, and **Done** to filter the list. Reply or create a conversation to try the layout with your own content.
- The layout becomes a horizontally scrolling thread list above the message on smaller screens.
- **View as** changes the demo perspective. Internal threads are visible to the studio. **Reset** restores the samples.

## Prototype scope

Replies, new conversations, and completion states are stored in session storage in this browser tab. The completion control previews the same visual interaction for all three types; it does not execute a production approval or change a real project budget. No messages or invitations are sent.

Only files inside `public/mock` implement this design. The production conversation UI is unchanged. The copied workspace assets and fictional demo backend remain in `assets/`; `mock.js` and `mock.css` contain the prototype interactions and styling.
