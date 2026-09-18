# Fakestripe

Local Stripe simulator for Studiodeck. No Stripe account, card details, or real payments are used.

Open **http://localhost:8199**, go to **Billing**, and buy a package. Checkout opens on **http://localhost:8299** with **Payment accepted** and **Payment declined** options. Submit the result, then use **Return to Studiodeck**. Signed webhooks reach the normal app inbox; the billing worker processes them within about 15 seconds. Refresh Billing if needed. The simulator homepage lists checkouts, invoices, and webhook delivery results.

An accepted prepaid Project Pass payment adds one unused pass, without creating a project. Use it to create a project; its 150 days begin on creation. An accepted subscription or existing-project purchase grants the normal application access. Decline simulates `checkout.session.async_payment_failed`, marks the order failed, and grants no paid access. Start a new checkout after a declined checkout. An unpaid upgrade invoice can be retried using the same form; the existing plan stays in place until acceptance.

## Run

The local `docker-compose.override.yml` adds a separate `fakestripe` container on loopback port 8299. State persists across restarts. The volume's physical name (`studiodeck_fakestrip-data`) and existing catalog IDs retain their original spelling to preserve stored records through the service rename.

The dashboard lists received checkouts and accepted subscriptions separately. A pending app order without a checkout means preparation failed before reaching the simulator; use Resume in Billing after fixing the error. In local mode, authenticated API failures include technical details logged under `[Studiodeck API] Request failed` in the browser console. Stripe failures include the endpoint, HTTP status, cURL error and provider message, without request credentials or bodies.

```sh
docker compose build fakestripe
docker compose up -d --no-build fakestripe web worker
```

The repository's local `.env` is configured with:

```dotenv
STRIPE_API_URL=http://fakestripe:8200/v1
STRIPE_SECRET_KEY=sk_test_fakestripe
STRIPE_WEBHOOK_SECRET=whsec_fakestripe_local
STRIPE_PORTAL_CONFIGURATION=bpc_fakestrip
STRIPE_PRICE_PASS=price_fakestrip_pass
STRIPE_PRICE_EXTENSION=price_fakestrip_extension
STRIPE_PRICE_SOLO=price_fakestrip_solo
STRIPE_PRICE_STUDIO=price_fakestrip_studio
STRIPE_PRICE_PRACTICE=price_fakestrip_practice
STRIPE_PRICE_EXTRA_PROJECT=price_fakestrip_extra_project
STRIPE_PRICE_EXTRA_SEAT=price_fakestrip_extra_seat
FAKESTRIPE_PORT=8299
FAKESTRIPE_PUBLIC_URL=http://localhost:8299
```

`STRIPE_API_URL` is the server-to-server URL, including `/v1`. `FAKESTRIPE_PUBLIC_URL` is the browser URL. If the app runs outside Docker, set `STRIPE_API_URL=http://localhost:8299/v1` and set the simulator's webhook URL to an address that reaches the app from its container. HTTP API URLs are allowed only with `APP_ENV=local`. The app otherwise defaults to `https://api.stripe.com/v1` and requires HTTPS.

To return to Stripe, restore its API URL, keys, webhook secret, portal configuration, and all seven price IDs, then recreate web and worker. Fake customer/subscription IDs belong only to this simulator; use a separate test studio when switching providers.

## Covered API calls

- Customers; products; price creation and lookup, including `scripts/setup-stripe.php`.
- Checkout creation, retrieval, line items, expiration, idempotency.
- Payment intents, charges, invoices and customer invoice history.
- Subscriptions, paid checkout, pending upgrades, preview invoices.
- Subscription schedules: creation, retrieval, phase updates, release.
- Billing portal configurations and sessions, invoice history, cancellation at period end and undo.
- Signed webhook delivery, durable retry with backoff, and manual retry from the dashboard.

Preview amounts are deterministic differences between monthly totals, without tax or time-based proration. Automatic renewal, executing future schedule phases, refunds/dispute creation, actual payment method updates, and invoice PDFs are not simulated. This implements the app's API contract, not the entire Stripe API. The interface is a local test desk without user accounts; keep the published port bound to loopback.

## Verify

Run with PHP's curl and SQLite extensions available, or use the existing application image:

```sh
docker run --rm --network none -v "$PWD:/workspace:ro" -w /workspace studiodeck php fakestripe/test.php
docker run --rm --network none -v "$PWD:/workspace:ro" -w /workspace studiodeck php tests/test_billing_stripe.php
docker run --rm --network none -v "$PWD:/workspace:ro" -w /workspace studiodeck php tests/test_billing.php
```

The integration test starts temporary HTTP services with isolated stores and exercises accepted/declined payments, access grants, extensions, checkout cancellation, upgrades, schedules, portal cancellation, invoice history, idempotency, API authentication, CSRF, and signed webhook processing. It does not alter running app data.
