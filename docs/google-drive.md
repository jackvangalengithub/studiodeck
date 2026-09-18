# Import files from Google Drive

## Use it in a project

1. Click **Upload files**.
2. Use **From my computer** to drag files into the dialog or browse your device. Review the selection and click **Add to project**.
3. Alternatively, open **From Google Drive**, then **Connect Google Drive**. Complete Google's consent screen in the popup.
4. Open a folder, or paste a Google Drive folder link into **Open a specific folder**. Shared-drive folders can be opened by their folder link too.
5. Tick the individual files you want, then click **Add to project**. Folder rows are navigation only; they cannot be selected or recursively imported. Moving to another folder clears the current selection.

The new-project wizard also has a **From Google Drive** button. Choose the files, return to the wizard with **Use selected files**, then create the project.

Connections belong to one signed-in person within one studio. Colleagues connect their own accounts. Disconnecting removes the saved connection for that studio; imported project copies remain available. To revoke Google's grant for the application entirely, use your Google Account's connected-app settings.

## Supported files and behavior

- PDFs, PowerPoint, Excel, CSV, JPG, PNG and WebP use the existing upload validation and document-processing pipeline.
- Google Docs export to PDF, Google Slides to PPTX, and Google Sheets to XLSX.
- Up to 20 files, 100 MB per file and 120 MB per import batch. Google imposes a separate **10 MB export limit** on Google Workspace documents through `files.export`. For a larger document, download it yourself and use the computer tab. [Google download/export documentation](https://developers.google.com/workspace/drive/api/guides/manage-downloads).
- Shortcuts, restricted downloads and unsupported file types cannot be selected.
- Each import creates independent project copies. This feature does not watch a folder or synchronize later changes. Import a changed file again to create the next version under the same filename. Identical files are deduplicated. Two selected Drive files with identical names must be renamed or imported separately.
- An import validates and downloads the whole selection before saving any files. A failed batch can be retried. Project membership, draft status and the Drive connection are checked again before saving.
- Original file versions, extracted text, AI processing and client access work the same as for computer uploads. The file metadata retains its Drive source ID, folder ID and import time.

## One-time administrator setup

The connection button remains disabled until the following configuration is present. No real Google credentials are included in the repository or tests.

1. In [Google Cloud Console](https://console.cloud.google.com/), choose a project and enable **Google Drive API**.
2. Configure the OAuth consent screen, audience, support details and permitted test users. Declare the scope `https://www.googleapis.com/auth/drive.readonly`.
3. Create an OAuth client with application type **Web application**.
4. Add this exact authorized redirect URI, replacing the origin with your `APP_URL`:

   ```text
   http://localhost:8199/api.php?action=drive_callback
   ```

   Production must use your HTTPS application URL. The browser should open Studiodeck using that same origin; `localhost` and `127.0.0.1` are different origins and do not share the login cookie.

5. Add the OAuth client values to the server's private `.env` file:

   ```dotenv
   GOOGLE_DRIVE_CLIENT_ID=your-web-client-id
   GOOGLE_DRIVE_CLIENT_SECRET=your-client-secret
   GOOGLE_DRIVE_TOKEN_KEY=your-base64-encoded-32-byte-key
   ```

   Generate the encryption key once, on the server:

   ```sh
   php -r 'echo base64_encode(random_bytes(32)),PHP_EOL;'
   ```

   Store the key with your other secrets and backups. Changing or losing it requires users to reconnect. Tokens are encrypted in SQLite; the browser never receives access or refresh tokens.

6. Restart the web and worker processes so they receive the new environment. With the local Docker setup:

   ```sh
   HOST_PORT=8199 docker compose up -d --no-build --force-recreate web worker
   ```

7. Open **Upload files → From Google Drive** and connect a permitted test account.

The custom folder browser uses `drive.readonly`, which permits reading and downloading all files the connected account can access; the app imports only the files the user selects. Google classifies this as a restricted scope. Before public distribution, complete the applicable Google verification and security-assessment requirements for server-side storage of restricted-scope data. A future Google Picker implementation with `drive.file` would offer narrower, per-file authorization but use Google's picker instead of this custom folder browser. [Google's scope and verification requirements](https://developers.google.com/workspace/drive/api/guides/api-specific-auth).

OAuth uses a session-bound, short-lived state and PKCE, and refreshes expired access tokens on the server. Revoked/expired refresh grants prompt reconnection. [Google's web-server OAuth flow](https://developers.google.com/identity/protocols/oauth2/web-server).

## Verification

`python3 tests/test_drive.py` runs real API calls against a temporary database with a simulated Google transport. It covers OAuth state/replay/CSRF, encrypted tokens, account and studio isolation, refresh/reconnect, folder-only navigation, file validation, atomic imports, exports, retries, provenance and processing. No Google, AI or email requests leave the fixture.

`tests/test_drive.cjs` checks the real app on desktop and mobile, including computer drag/drop, the simulated OAuth popup, folder links/navigation, pagination, file selection, imports, the project wizard and disconnect. It requires an isolated server whose router loads `tests/fixtures/drive-transport.php` before returning `public/router.php`; never load that test fixture in a deployed application. Set `STUDIODECK_TEST_URL`, `STUDIODECK_TEST_MAIL_LOG` and `STUDIODECK_TEST_CONTAINER` for the fixture, plus `PLAYWRIGHT_MODULE` and `CHROMIUM_EXECUTABLE` if needed.
