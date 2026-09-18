# Tenant and account security

Updated 18 September 2026. The application enforces the following rules on the server, including direct API and file requests.

| Identity | Access |
| --- | --- |
| Anonymous, forged or expired session | `/login`, its two minimal assets, and the login/session API only. |
| Studio member | Their project teams and public projects within a studio they belong to. Project editing requires team membership. |
| Studio admin | Studio administration, plus the same project boundaries. Permanent deletion requires both admin and project-team membership at both confirmation and deletion. |
| Client | Explicitly assigned, unexpired, unrevoked shared iterations and their files. Comments, thread resolution, questions and budget choices require the session and CSRF token. No studio rights are created by an invitation. |
| Account with several roles/studios | Each request checks the selected studio or client assignment. An ID or `Client` header is only a selector, never a credential. |

Public means **public within that studio**. All files attached to an authorized iteration, including their prior versions, are downloadable; hiding a presentation slide is a presentation setting, not a separate file permission. Share only files whose contents and version history the recipients may see. Client access never grants an unpublished iteration automatically.

## Authentication and invitations

`authenticated_user()` validates the opaque session and optionally CSRF. `owner()` additionally requires current studio membership. `owned_project()` checks studio scope and project membership/visibility. `access_iteration()` enforces either studio/project rights or an identity-matched client grant. Every non-login API requires a valid session by default.

Sign-in credentials expire after 15 minutes, are stored as hashes and are consumed transactionally once. Sessions expire after 14 days and use HttpOnly, SameSite=Lax cookies with Secure enabled for an HTTPS `APP_URL`. The database remains the authority for current memberships and grants; removing membership or revoking a share affects subsequent requests using existing cookies.

A designer's **copy link** is a project URL that requires login. It never contains the recipient's account credential. Invitations emailed to the recipient contain a private one-use login credential bound to that share. This distinction prevents an inviter from impersonating an existing account with rights in other studios. Comment notifications issue a fresh credential when dispatched; delivery and login consumption both check the grant. New client accounts receive no studio membership. Existing studio users can create another studio; client-only users cannot.

Legacy `Bearer` share/notification tokens no longer authorize requests and are not exchanged for account sessions. Opening an old `/#/view/…` link leads to sign-in; the recipient uses the email address on their assignment. Existing project grants remain usable through that account. A failed/log-only email send cannot be worked around by returning a private account credential to the designer.

`MAIL_TRANSPORT=log` is local development only: credentials appear in the server's private mail logs. They are not returned by the API. Production needs working email delivery.

## Deployment requirements

**All requests, including existing static files, must pass through `public/router.php`.** The router checks authentication before serving app JavaScript, CSS and pages, and resource authorization before studio/project/client pages. Protected responses use `Cache-Control: no-store`. A web server's normal static-file shortcut would bypass these checks.

- Development: the documented PHP server command uses this router.
- Nginx/PHP-FPM: adapt [nginx-security.conf](nginx-security.conf) inside your HTTPS server block. Do not add a static `/assets/` location or `try_files $uri` bypass. Execute only the router; it dispatches `/api.php` internally.
- Apache 2.4: `public/.htaccess` routes all requests, including existing files, through the router. Enable `mod_rewrite` and permit its `Options` and rewrite directives; otherwise put the same rules in the virtual host.
- Set the document root to `public/`, `APP_ENV=production`, and the exact HTTPS `APP_URL`. Keep `.env`, source, SQLite/WAL files, storage, backups and mail logs outside the document root. Do not cache authenticated responses in a proxy or CDN.

The static pitch/demo build is separate and does not enforce PHP authorization or contain production tenant data.

Existing explicit memberships are preserved. Accounts accidentally provisioned as studio users by older client-signup behavior need an administrator's membership review; the application cannot reliably infer which historical memberships were intended. This patch does not silently delete studios or revoke legitimate accounts.

## Verification

Recorded validation: **44 security tests and 7 client-roster tests passed**; the studio-membership, permanent-deletion and mocked Drive integration scripts passed. The real Chromium login/access/logout check and JavaScript route tests also passed. PHP/JavaScript syntax checks and `git diff --check` passed.

The security suite uses a copied source tree, fresh migrated SQLite databases, seeded identities and temporary HTTP servers. It never reads the workspace `.env`, sends real email, calls AI/Drive or modifies the application's stored data.

```sh
PHP_BIN=php python3 tests/test_security.py -v
PHP_BIN=php python3 tests/test_project_clients.py -v
PHP_BIN=php python3 tests/test_studios.py
PHP_BIN=php python3 tests/test_project_deletion.py
PHP_BIN=php python3 tests/test_drive.py
```

Security coverage includes endpoint inventory, absent/forged/expired sessions, studio/project scope, client grants and draft isolation, original files/previews/document crops/image variants, mixed resource IDs, membership removal, revocation/expiry/logout, deletion permission changes, studio-admin settings, CSRF, SQL injection probes, credential confidentiality, token replay and concurrent redemption requests. Comments feeds deliberately list only project-team discussions, even where a public project is otherwise readable.

The real-browser check uses `tests/security_browser_fixture.py` with `tests/test_security_browser.cjs`. Start the fixture in the PHP test image, mount an empty export directory at `/browser`, and forward container port 18499 to **127.0.0.1:18499**. Run the Node test with `SECURITY_BROWSER_EXPORT`, `PLAYWRIGHT_MODULE` and `CHROMIUM_EXECUTABLE` set for that environment. The fixture contains only seeded test accounts, exits on the test's `done` marker, and times out after three minutes. It checks email login, redirect/refresh behavior, studio and client navigation, unauthorized requests, token replay, logout and asset protection.

The design follows [OWASP authorization guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) and [session guidance](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html). Passing tests verify these application contracts, not absolute security. Live HTTPS/proxy/CDN behavior, the actual membership roster, production email and multi-process deployment need deployment validation. Concurrent requests in this suite use PHP's development server; this is not a multi-worker load test or an independent penetration test.
