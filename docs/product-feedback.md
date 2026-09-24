# Product feedback

**Help improve Studiodeck** appears above the profile in the workspace sidebar for
all studio members, including viewers and studios without current billing access.
It opens a three-step form, in English or Dutch, with questions tailored to broken
behaviour, friction, missing functionality, positive experiences or other feedback.
Reports are separate from project comments and never shared with project clients.

Answers and an optional screenshot survive going back and closing/reopening the
form in the same page session. Reloading the page clears unfinished drafts.
Drafts are scoped to the current account and studio. Failed submissions keep the
answers; an idempotency key prevents retries from creating duplicate reports.

The form records the selected area, intended outcome, experience, impact,
frequency and permission for a follow-up email. It also records the authenticated
account/studio, a coarse screen name and `APP_VERSION` (default `unversioned`).
It does not collect full URLs, project IDs, browser logs, files or conversations.
The final step discloses the attached context. Screenshots are opt-in PNG/JPEG/WebP,
up to 5 MB and 16 megapixels with a 6,000-pixel limit per side. The server resizes
them to at most 2,400 pixels per side and re-encodes to JPEG to strip metadata.

## Private team inbox

Set a comma-separated list of verified account emails in the server environment:

```dotenv
PRODUCT_FEEDBACK_TEAM_EMAILS=feedback@studiodeck.com
PRODUCT_FEEDBACK_NOTIFY_EMAIL=feedback@studiodeck.com
APP_VERSION=your-release-label
```

An empty allowlist disables access. Being a studio admin does **not** grant access.
Allowlisted people sign in with their normal account and use **Product feedback
inbox** in the workspace sidebar. The account needs a studio workspace to reach
that sidebar. No special account or password is created by this configuration.

The inbox supports area, type, status, impact, theme and text filters, pagination,
distinct reporter/studio counts, and recurring theme counts. Open a report to see
its original wording and screenshot, assign a reusable theme, add private notes,
or update its status. Stale concurrent review edits are rejected. Contact email
is shown only when the reporter opted into a follow-up. Saving a review sends no
email. Staff can follow up separately.

## Email notifications

`PRODUCT_FEEDBACK_NOTIFY_EMAIL` receives an email for each new submission. This
is separate from the inbox access allowlist. Emails contain the selected type,
area, both answers, impact/frequency, reporter name, studio and report ID. The
reporter's email is included only with follow-up consent. Screenshots stay in the
private inbox. Emails link to Studiodeck, where authorized team members can review
the report through **Product feedback inbox**.
Notifications use the shared Studiodeck email template, including its branded
layout and action button, with a feedback-specific footer.

New reports and their notification jobs are saved atomically. Retrying a submission
does not enqueue another email. The existing worker sends notifications and retries
transport failures up to three times, five minutes apart; feedback stays saved even
when email fails. `product_feedback_outbox` records `queued`, `sending`, `sent`,
`logged`, `failed` or `cancelled` delivery status. `sent` means the mail transport
accepted the message. As with other SMTP notifications, a worker crash after mail
acceptance but before recording success can cause a duplicate on recovery.
Changing or clearing the recipient cancels queued mail addressed to the old mailbox.
Existing reports are not emailed retroactively when notifications are enabled.

The local Docker environment captures mail in **MailCatcher at
http://localhost:1081**; it does not deliver to the real mailbox. Production uses
the app's configured `MAIL_TRANSPORT=mail` and server mail transport. With
`MAIL_TRANSPORT=log`, messages are written to `MAIL_LOG_PATH.messages.jsonl` and
marked `logged` without being sent.

With Docker Compose, `.env` changes require recreating the web and worker containers:
`docker compose up -d web worker`. Restart the worker after changing its PHP source.
Ordinary mounted web source changes apply directly.
The SQLite tables are created automatically on database initialization. Screenshots
remain in the private database, accessible only through the authorized image API.

## Verification

`python3 tests/test_product_feedback.py -v` requires PHP with SQLite and GD. It
creates isolated source copies/databases and never sends mail or calls paid APIs.
Set `PRODUCT_FEEDBACK_EXPORT=/tmp/product-feedback.json` to export a browser fixture.
Then run `PRODUCT_FEEDBACK_EXPORT=/tmp/product-feedback.json node
tests/test_product_feedback_browser.cjs`, with `PLAYWRIGHT_MODULE` and
`CHROMIUM_EXECUTABLE` set if needed. Browser checks use the actual UI with mocked
API responses; API tests separately exercise real authorization and persistence.
