# Project Communication

The project’s Communication tab brings existing presentation comments and replies together with general messages and confirmation requests. Use **New conversation** to start a named thread with a subject, first message and optional attachment. Replies and confirmation requests stay in that thread, which remains available after reloading. The original slide threads are preserved; replies posted here also appear alongside the slide. The studio-wide Communication feed retains its project and iteration context. Clients open Communication from their presentation.

A request contains a message and one recipient, with an optional file version and signed budget change in euros including VAT. The amount is the change, not the new total. Positive amounts add cost and negative amounts reduce it. Regular replies never approve a request.

Only the named recipient can confirm. The author can withdraw a pending request. Completion records the authenticated identity and time. Confirmed and withdrawn requests stay visible; the checklist supports pending-only, needs-my-confirmation, and waiting-for-someone-else filters.

The recipient dropdown shows the full project directory, grouped into Team, Clients and Other people involved, excluding the sender. A contact needs an email address. The project team can select **Invite to this conversation** for contacts without presentation access. The request form explains that the invitation includes this conversation’s earlier messages and attachments. Sending the request creates a conversation grant and queues an invitation email, without creating a presentation share or studio membership. Clients and conversation guests cannot invite additional people.

Invitations are bound to the recipient’s signed-in email, expire after 90 days, and open a separate `/conversations/{root}` page. The emailed sign-in credential expires after 15 minutes and works once; it is never returned to the sender. Guests can read that root and its replies, download only file versions explicitly attached there, reply, request confirmation from existing participants, and confirm requests addressed to themselves. They see individual requested budget changes, not the project budget. They cannot browse other conversations, slides, source file history, or the project directory. Shared conversations also appear on the account’s destination screen.

The team can use **Remove access** in a named conversation to revoke its guest invitation. Existing sessions, queued mail, attachment downloads and pending sign-in tokens are checked or invalidated. Removing the person from the project directory or expiring their invitation also removes access. Conversation access does not grant broader access to an iteration, even when it is still a draft.

Every write checks authentication, CSRF, project/grant access, and billing access inside the write transaction. Locked iterations allow conversation and nonfinancial confirmations, but block uploads and budget changes.

Approval and insertion of the signed budget adjustment happen in one SQLite write transaction. Repeated confirmation is idempotent. Budget rows are protected from manual changes and quote nesting; corrections require another confirmation. New iterations copy approved budget rows with a link to the original decision. Pending requests stay in their original iteration and do not affect any budget. Select the original iteration to continue those conversations.

Attachments pin the exact file version. Direct uploads use the normal validation, storage quotas and background document processing, as reference documents. They do not automatically extract budget rows. Uploaded files remain in Files even if the message is cancelled. Linked originals remain downloadable if the current asset version changes. Requests use existing comment notification preferences and outbox access checks. The project export includes communication records and files.

`app/confirmation_schema.sql` is applied automatically when the database opens. It adds tables only; existing comments require no conversion. `/mock` remains unchanged. The public onboarding demo retains its existing sample comments.

Validation:

- `python3 -m unittest discover -s tests -p test_confirmations.py -v`
- `python3 -m unittest discover -s tests -p test_security.py -v`
- `python3 -m unittest discover -s tests -p test_conversation_access.py -v`
- Start `tests/fixtures/communication-server.py` in the PHP test image, published on loopback port 18496, then run `node tests/test_communication.cjs` with `PLAYWRIGHT_MODULE` and `CHROMIUM_PATH` if needed. All test identities, messages and budgets live in a temporary database.

For the invitation browser test, start the fixture with `COMMUNICATION_MAIL=1` (log-only delivery), then run `node tests/test_conversation_guest.cjs`. The fixture exports its temporary invitation mail to `/browser/mail.jsonl`; no real messages are sent.

Mentions are available in new conversations, replies, confirmation messages, slide comments and the guest conversation page. Type `@`, search by name or email, then select a person with the keyboard or pointer. Duplicate names use an explicit `@email` token. Typed `@email` also works; ordinary email addresses do not trigger a mention. Mentioned names are highlighted, and notification email subjects identify a direct mention.

The project picker includes the full project directory: team, clients and other contacts. Contacts without an email are visible but disabled. Project editors can select “Invite to this conversation” for contacts without access; sending that selected mention invites them only to the thread and its attachments, including earlier messages. Opening the picker, removing the mention or typing an uninvited email as plain text does not grant access. Guest pickers only include participants in their invited conversation, and clients/guests cannot invite other contacts. The server verifies recipients and the remaining message text inside the posting transaction, stores explicit identities in `comment_mentions`, and rechecks notification preferences and access before sending. Removing a selected mention removes its notification effect.

Profile → Communication preferences offers all conversation emails or only explicit @mentions, with the existing email checkbox as the master switch. Mentions-only also applies to confirmation requests: being selected as the approver alone is not an @mention. Messages remain visible in Communication regardless of email preferences. Existing profiles default to all messages; existing email opt-outs remain off. The preference and mentions schema migrate automatically.

Mention checks: `python3 -m unittest discover -s tests -p test_mentions.py -v`; run `node tests/test_mentions.cjs` against a fresh mail-enabled communication fixture for desktop/mobile, profile persistence and restricted guest checks.
