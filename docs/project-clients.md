# Project client members

Each project has two independent lists:

- **Project team:** studio users who can edit the project and manage its clients.
- **Client members:** named email addresses that can be selected when sharing an iteration. Adding someone here does not email them or give them access to existing iterations.

Use **Manage clients** beside the project team to add, rename or remove clients. An email identifies the client; to change it, remove the old membership and add the new address.

**Send to clients** shows the whole client list with every checkbox selected initially. Use individual checkboxes, **Select all**, or **Clear selection** to choose recipients. The dialog allows 1–20 recipients per send. It preserves the message while changing selections and shows an error if a selected member was removed before submitting.

Only selected clients receive invitations and access to that iteration. Sharing an iteration with Alice does not give Bob access just because both are client members. Sharing a later iteration with Bob does not give Alice access to that later iteration. Existing invitations remain valid when someone is unchecked on a subsequent send.

Removing a client member ends access to all shared iterations of that project, revokes their links and notification aliases through the underlying share, and cancels queued project notifications. Their other projects are unaffected. Re-adding a removed member does not restore revoked invitations; share the intended iteration again.

## Data and compatibility

`project_client_members` stores project ID, normalized email, name and creation time. It is separate from studio/project-team membership and from iteration `shares`. Membership and an active iteration share are both required for client access, including downloads and notification delivery. The client roster is included in studio project payloads, not in client deck payloads.

The one-time `project-clients-v1` migration imports existing Client contacts and past share recipients. It preserves all existing share expiry/revocation flags and does not create new iteration grants. Removed clients are not reimported on later requests. Deleting a project cascades to its client members.

New UI requests use `share` with `client_emails`, which must select existing project client members. The older `emails` API remains compatible for existing callers: an authorized project team member can invite by email, and those invitees are added to the roster. Creating a project with client emails or saving a Client contact also populates the roster.

Client access requires an identity session matching the invited email. Copyable presentation URLs contain no credentials; private one-use login links go only to the recipient’s mailbox. Legacy bearer links require a new email sign-in. See [the security review](security-review.md) for the access rules and required production routing.

## Verification

```sh
PHP_BIN=php python3 tests/test_project_clients.py -v
node --test tests/test_project_clients.mjs
```

The API tests use a temporary database and loopback PHP server, with no real email or external calls. They cover member/team separation, permissions, subset-only iteration/file access, stale selections, revocation, notification cancellation, migration and legacy invitations. PHP needs SQLite and GD extensions.

Browser tests exercise the real UI with a mocked API on desktop and mobile. Set `PLAYWRIGHT_MODULE` and `CHROMIUM_PATH` if those dependencies are not installed in their default locations.
