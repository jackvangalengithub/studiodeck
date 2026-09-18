# Request 10: tests-only baseline

Measured on 2026-09-18. No application behavior or real account permissions were changed.

| Expectation | Provisional acceptance target | Measured result |
| --- | --- | --- |
| Wider Studio settings | Desktop width greater than the original 560px | FAIL: 560px |
| Two columns of options | Two desktop palette-option columns | FAIL: three columns |
| jackvangalen is admin | Existing account has admin membership in each local studio | PASS: both memberships are admin |
| Compact preview editor | At most 64px at 1440×900; at most 15% of height at 390×844 | FAIL: 82px desktop, 174px mobile (target 126.6px) |
| More sparkles | More than nine particles for queued and running image jobs | FAIL: nine in both states |
| Faster sparkles | Active animation cycle below 2.8 seconds | FAIL: 2.8 seconds in both states |
| Mobile settings navigation | Settings button accepts a tap after opening navigation from the slide editor | FAIL: slide section index intercepts pointer events |

The width/height thresholds and interpretation of “two columns” as palette-option columns are test assumptions, not previously specified design values. Browser tests use real app HTML/CSS/JS with fictional API responses. They measure UI behavior, not backend authorization.

New browser suite: **7 passed, 9 failed, 0 skipped**. Passing checks cover mobile dialog fit and retained options/save/cancel, retained editor controls, hidden editing controls for clients and read-only viewers, reduced-motion behavior, and no lingering processing sparkles after completed/failed jobs. Mobile dialog layout is tested through the settings URL independently of the failing navigation path.

The separate read-only account check passes. It verifies `storage/studiodeck.sqlite`, not a remote deployment. Without an explicit database path, it reports a skip. It never promotes or creates an account.

All **15 pre-existing test scripts** passed: six JavaScript, seven Python, and two PHP. The expanded deletion integration script also passes checks for promotion in an existing session, blocked self-promotion, deletion refusal for a member's own project, demotion invalidating permission despite an issued confirmation, and successful confirmed deletion after promotion. These role changes and deletions occur only in a temporary fixture database.

## Running the checks

With Playwright and its Chromium installed:

```sh
node --test tests/test_studio_polish.mjs
LOCAL_ADMIN_DATABASE=storage/studiodeck.sqlite python3 tests/test_local_admin.py
PHP_BIN=php python3 tests/test_project_deletion.py
```

For a Playwright installation outside the repository, set `PLAYWRIGHT_MODULE` to its package directory. Set `CHROMIUM_PATH` to use an existing Chromium executable. The browser suite starts its own loopback server, mocks API requests, blocks external browser requests, and closes the browser/server when finished. It returns a nonzero exit code for unmet expectations; failures are not marked as TODO or ignored.

Optional account selectors: `LOCAL_ADMIN_IDENTITY` accepts an exact name, email, or email local part (default `jackvangalen`); ambiguous matches fail. `LOCAL_ADMIN_STUDIO_ID` limits the check to one membership. SQLite is opened with `mode=ro` and `query_only=ON`.

PHP/Python checks require the dependencies listed in the project's Dockerfile. For this baseline they ran in the existing `studiodeck` image, with networking disabled, read-only mounts of `app`, `public`, `scripts`, and `tests`, and writable temporary storage. Neither `.env` nor the real storage directory was mounted. No real email or AI calls were made.
