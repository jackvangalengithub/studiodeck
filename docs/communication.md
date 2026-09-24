# Project Communication

The project’s Communication tab is the shared home for slide feedback, named conversations, checklist questions/actions, and confirmation requests. It spans the project's iterations. The client view includes only iterations with a current, valid invitation; changing the selected deck never grants access to another iteration. The studio-wide feed retains project and source iteration context.

Each subject has one comment thread. Newly saved or accepted checklist items link to it through `checklist_threads`; their replies are normal comments with mentions, unread state, and notifications. Multiple actions can share a subject. Linked work is not copied into new iterations. Presentation Checklist remains a summary and opens the same discussion. AI suggestions stay private until accepted. Existing historical records receive no bulk conversion.

New studio conversations default to Studio only in the interface. `communication_audiences` enforces that audience for payloads, replies, thumbnails, read receipts, mentions, approvals, invitations, and mail delivery. The separate Share conversation action explains that earlier messages and attachments become visible to clients with access to the original iteration. Sharing is one-way; item notes have their own published flag. A shared conversation can contain studio-only action details. Project Files access remains independent of message visibility.

The project Communication tab has two presets: All communication and Needs attention (unread messages, open work or pending approval). Completing all visible work with no pending approval makes a work subject complete; plain discussions can be marked answered. These states never substitute for explicit approval. Needs attention is a preset in Communication, including the studio-wide list, with one entry per subject. The separate menu item and dashboard have been removed; old links open `/comments?filter=attention`. Project deadlines remain project details.

A request contains a message and one recipient, with an optional file version and signed budget change in euros including VAT. The amount is the change, not the new total. Positive amounts add cost and negative amounts reduce it. Regular replies never approve a request.

Only the named recipient can confirm. The author can withdraw a pending request. Completion records the authenticated identity and time. Confirmed and withdrawn requests stay visible. Pending requests appear under Needs attention.

The approval recipient dropdown includes eligible people from the project directory, excluding the sender. Studio-only conversations restrict it to team members. A contact needs an email address. The project team can select **Invite to this conversation** for contacts without presentation access. The request form explains that the invitation includes this conversation’s earlier messages and attachments. Sending the request creates a conversation grant and queues an invitation email, without creating a presentation share or studio membership. Clients and conversation guests cannot invite additional people.

Invitations are bound to the recipient’s signed-in email, expire after 90 days, and open a separate `/conversations/{root}` page. The emailed sign-in credential expires after 15 minutes and works once; it is never returned to the sender. Guests can read that root and its replies, download only file versions explicitly attached there, reply, request confirmation from existing participants, and confirm requests addressed to themselves. They see individual requested budget changes, not the project budget. They cannot browse other conversations, slides, source file history, or the project directory. Shared conversations also appear on the account’s destination screen.

The team can use **Remove access** in a named conversation to revoke its guest invitation. Existing sessions, queued mail, attachment downloads and pending sign-in tokens are checked or invalidated. Removing the person from the project directory or expiring their invitation also removes access. Conversation access does not grant broader access to an iteration, even when it is still a draft.

Every write checks authentication, CSRF, project/grant access, and billing access inside the write transaction. Locked iterations allow ordinary messages and nonfinancial confirmations, but block new tracked work, work completion, uploads and budget changes.

Approval and insertion of the signed budget adjustment happen in one SQLite write transaction. Repeated confirmation is idempotent. Budget rows are protected from manual changes and quote nesting; corrections require another confirmation. New iterations copy approved budget rows with a link to the original decision. Pending requests stay in their original iteration and do not affect any budget. Their conversation remains available in the project-wide hub; financial changes still apply only to the original iteration.

Attachments pin the exact file version. Direct uploads use the normal validation, storage quotas and background document processing, as reference documents. They do not automatically extract budget rows. Uploaded files remain in Files even if the message is cancelled. Linked originals remain downloadable if the current asset version changes. Requests use existing comment notification preferences and outbox access checks. The project export includes communication records and files.

`app/confirmation_schema.sql` is applied automatically when the database opens. It adds the communication tables; the thread-purpose schema update preserves existing threads while mapping their types to the three current choices. New work is linked when accepted or saved; untyped historical comments are not backfilled. `/mock` remains unchanged. The public onboarding demo retains its existing sample comments.

Validation:

- `python3 -m unittest discover -s tests -p test_communication_hub.py -v`
- `python3 -m unittest discover -s tests -p test_confirmations.py -v`
- `python3 -m unittest discover -s tests -p test_security.py -v`
- `python3 -m unittest discover -s tests -p test_conversation_access.py -v`
- Start `tests/fixtures/communication-server.py` in the PHP test image, published on loopback port 18496, then run `node tests/test_communication.cjs` with `PLAYWRIGHT_MODULE` and `CHROMIUM_PATH` if needed. All test identities, messages and budgets live in a temporary database.

For the invitation browser test, start the fixture with `COMMUNICATION_MAIL=1` (log-only delivery), then run `node tests/test_conversation_guest.cjs`. The fixture exports its temporary invitation mail to `/browser/mail.jsonl`; no real messages are sent.

Mentions are available in new conversations, replies, confirmation messages, slide comments and the guest conversation page. Type `@`, search by name or email, then select a person with the keyboard or pointer. Duplicate names use an explicit `@email` token. Typed `@email` also works; ordinary email addresses do not trigger a mention. Mentioned names are highlighted, and notification email subjects identify a direct mention.

The project picker includes the full project directory: team, clients and other contacts. Contacts without an email are visible but disabled. Project editors can select “Invite to this conversation” for contacts without access; sending that selected mention invites them only to the thread and its attachments, including earlier messages. Opening the picker, removing the mention or typing an uninvited email as plain text does not grant access. Guest pickers only include participants in their invited conversation, and clients/guests cannot invite other contacts. The server verifies recipients and the remaining message text inside the posting transaction, stores explicit identities in `comment_mentions`, and rechecks notification preferences and access before sending. Removing a selected mention removes its notification effect.

Profile → Communication preferences offers all conversation emails or only explicit @mentions, with the existing email checkbox as the master switch. Mentions-only also applies to confirmation requests: being selected as the approver alone is not an @mention. Messages remain visible in Communication regardless of email preferences. Existing profiles default to all messages; existing email opt-outs remain off. The preference and mentions schema migrate automatically.

Mention checks: `python3 -m unittest discover -s tests -p test_mentions.py -v`; run `node tests/test_mentions.cjs` against a fresh mail-enabled communication fixture for desktop/mobile, profile persistence and restricted guest checks.

### Feedback pins

On an image or floorplan, choose **Pin feedback**, then click the point to discuss. Keyboard users can move the crosshair with arrow keys and press Enter; Escape cancels placement. Pins follow floorplan zoom and pan. When comparing an original and AI variation, first choose **Show original** or **Show generated image** so the pin identifies one image.

A pin opens its subject in Communication, with replies, mentions and unread tracking. Conversation pins can be marked **Resolved**; typed pins use their thread’s work or approval status. **Show resolved pins** reveals completed pins. Pins store the exact source, page/crop and image variation with normalized coordinates. They appear only on that image version, and comment thumbnails continue to show the referenced image after replacements. Conversations stay in their original iteration. Locked iterations still allow discussion feedback. Studio viewers can read pins; project members and invited clients can place them, with completion and approval governed by the thread’s permissions.

Checks: `python3 -m unittest discover -s tests -p test_annotations.py -v`, `node tests/test_annotations.mjs` and `tests/test_annotations_browser.cjs` against the disposable Communication fixture.

### Thread purposes and replies

New conversations and photo pins offer three thread types: **Conversation**, **To do**, and **Approval**. Blue, amber and green accents distinguish them in the picker, inbox and summary. Type, responsibility, due date, approval amount and status belong to the root subject and appear in its header. Photo-pin creation includes the selected image location. Replies contain only a message, mentions and optional attachments; the API rejects typed replies. The title and status sit inside the top summary box, followed by the reply field and messages ordered newest first, in both the project hub and guest view.

Conversations optionally name a **Waiting for** person; this tracks the expected response under Needs attention until resolved or the waiting person is cleared. To dos require a responsible person and optionally a due date. The author, responsible person or project team can complete/reopen work; pin completion follows that same status. The author or team can change a conversation into a to do without losing its messages or pin. Changes of purpose, responsibility and due date are recorded in thread history.

Approval terms are immutable. An approval may include a signed budget adjustment; enabling the budget option requires an amount. **New linked thread** creates a separate subject for a new approval or cost change. Linking inherits the source thread’s audience but does not give guests access to its history. Only explicit approval changes the budget; it never completes linked work. Original thread/iteration identity remains stable across project iterations.

Guests also reply with plain messages and can start a linked thread using only existing participants. Guest access granted to a linked thread depends on the originating invitation and cannot outlive its revocation, expiry or deletion. Other project data stays outside that grant.

Existing typed discussions/questions map to Conversation, and confirmations/price adjustments map to Approval without changing message identities, assignments or decision terms. Accepted source inconsistency suggestions start Conversation threads with evidence. Thread metadata and change history are included in exports.

The separate Checks navigation entry is removed; old links open Communication. Source-role corrections live under Files. **Suggest items** first explains the evidence comparison and opens a manual run only after **Compare files**. Suggestions require meaningful conflicting evidence; routine actions, missing prices and preferences are no longer generated. File extraction continues unchanged. See [consistency suggestions](consistency-checks.md).
