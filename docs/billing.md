# Billing deployment and operations

The implementation uses Stripe-hosted Checkout, Stripe subscriptions and invoices, and a Stripe Customer Portal. Studiodeck owns trial eligibility, project coverage, expiration, usage and permissions. No card details pass through the app. The proposed product rules are in [billing-plan.md](billing-plan.md).

## Connect Stripe

1. Configure a Stripe **test** secret key in the server environment as `STRIPE_SECRET_KEY`. Keep it out of source control. PHP needs cURL, SQLite and ZIP (already included in the Docker image).
2. Run `php scripts/setup-stripe.php`. It creates/reuses EUR prices for the €19 pass, €15 extension, €59/€199/€499 monthly plans, €10 extra projects and €20 extra team members, and a portal configuration. Copy the printed price/configuration IDs into the environment. This script does not print or write your secret key.
3. Configure a Stripe webhook endpoint at `APP_URL/stripe-webhook.php`, using API version `2025-06-30.basil` (or deliberately update and test `STRIPE_API_VERSION`). Set its signing secret as `STRIPE_WEBHOOK_SECRET`.
4. Subscribe to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`, `invoice.payment_action_required`, `charge.refunded`, `charge.dispute.created`, `charge.dispute.updated` and `charge.dispute.closed`.
5. Enable Stripe successful-payment receipts/invoice emails and configure business information. One-time checkout explicitly enables paid invoice creation, which Stripe prices separately. Set `STRIPE_AUTOMATIC_TAX=true` only after configuring the business's Stripe Tax setup; prices are exclusive of tax. Configure appropriate Stripe payment methods and subscription payment-recovery emails.
6. Keep the worker running: `php scripts/worker.php`. It processes durable Stripe events, reconciles payment status, sends reminders and checks expiration. Requests independently check access dates, so a late worker cannot extend access accidentally.
7. Test real Stripe test-mode checkout, delayed/failed payment, cancellation and webhook delivery against your publicly reachable test deployment. Then supply the live account's separate keys, price IDs, portal ID and webhook secret. Catalog creation in live mode explicitly requires `php scripts/setup-stripe.php --live`.

The secret key and products are external deployment inputs; without them the Billing page and trial work, but purchasing is visibly unavailable. No real payment has been taken by the automated tests.

Portal plan changes must remain disabled. Package buttons send new purchases directly to Stripe Checkout. Existing subscriptions use `billing_change_checkout`: the app validates capacity, then Stripe calculates prorations with `always_invoice` and handles payment using `pending_if_incomplete`. Both increases and reductions take effect through Stripe; the user opens the hosted invoice (or payment portal for changes without an invoice) without an app confirmation popup. A saved payment method may be charged immediately. Stripe’s hosted portal cannot update subscriptions with multiple line items, so package selection remains in the app. Previously scheduled changes remain supported until completed or cancelled. The portal handles payment methods, invoice history, billing details and cancellation at period end. A pending change is displayed in Billing; retrying confirmation uses the same Stripe idempotency key.

## Signup and coverage

- Email-link sign-in also registers a new studio. Verification is followed by the language/name/business wizard; completing it also finishes billing onboarding and starts the eligible account’s 7-day trial, with no second wizard. Invitations do not create trials.
- Trial: one designer, one project, 3 image enhancements, 30 uploads / 250 MB cumulative, 30 question activities and 10 reprocess attempts. Deleting the trial project or creating another studio does not reset eligibility. Image enhancements used during the trial count toward the purchased pass or the subscription's current calendar month.
- Project Pass: buy first, then redeem one unused paid pass when creating a project. Includes one named designer, 150 days from project creation, and 10 lifetime image enhancements. Unused passes do not start their clock. Each €15 extension of an existing project adds 150 days from the later of payment and the previous expiry. Existing project-bound purchases keep their original expiry. No automatic renewal or AI allowance reset.
- Subscription: Solo 1/3, Studio 5/15, Practice 15/50 designers/active projects. Only subscription-covered projects consume its project capacity. Every studio membership consumes a designer seat; client guests do not.
- Admins select coverage explicitly. Moving a pass project onto a subscription does not pause its original pass clock or refund it. Moving back needs an unexpired pass and its single named designer. Payment never bypasses project membership.
- Expired projects remain privately readable/exportable, but edits, uploads, AI and client access stop. Failed renewals have three days' grace; cancellation lasts through the paid period. Independently paid pass projects continue.
- New projects require an unused trial allocation, an available subscription slot, or an unused paid Project Pass in the same studio. Billing shows Project Pass first in its own bordered group, then the three monthly packages together in a separate bordered group. Every monthly package includes a studio website. No unpaid project draft is created. Pending, failed or refunded orders provide no creation rights. Pass redemption and project creation share one transaction; rollback preserves the pass, and deleting a created project does not return it. Legacy exemptions preserve existing project access only, not permission to create new projects.
- Full pass/extension refunds remove only that access grant. Partial refunds do not change access. Disputes are flagged for review. Subscription refunds require a separate cancellation/access decision in Stripe; refunding an old invoice does not revoke a later paid period.

## Included studio website

Solo (€59/month), Studio (€199/month) and Practice (€499/month) include website publishing, hosting and ZIP export without an extra line item or toggle. The Project Pass and trial allow building and previewing, but do not include publishing. Website does not consume seats or project slots. Paid studio subscription access, including renewal grace and paid-through cancellation, controls website access. Checkout redirects alone never grant access.

Standalone Website checkout is retired. Historical Website payments still reconcile and retain their already-paid access. When deploying the new catalog, run `scripts/setup-stripe.php` and update the returned price IDs; Solo and Practice use new versioned lookup keys. Existing Stripe subscriptions are not automatically repriced or cancelled by deployment. Remove historical Website line items and retire standalone Website subscriptions as part of the billing migration; package changes omit the old Website item.

## Migration and retention

The first database migration explicitly exempts pre-existing studios and their projects. New studios never receive that exemption. Existing studios see **Existing studio** in Billing. Purchasing a subscription converts their legacy projects and removes the exemption after payment. To end an exemption otherwise, communicate a migration date first and assign the intended paid/trial coverage deliberately; do not backdate trials to historical signup.

New expired projects receive a retention notice. Deletion eligibility is the later of the restriction date and delivered notice date, plus 90 days. Reminders are queued 30 and 7 days before deletion. Email failures retry; no deletion deadline begins until a notice has actually been delivered (local development explicitly records `logged` notices).

Cleanup is staged with `BILLING_RETENTION_DELETE=false` by default. Once production delivery and exports are verified and customers have received the policy, set it to `true`. The worker checks current coverage again inside a transaction and skips projects with pending payments, running jobs or active email delivery. Financial order/grant records remain separate from deleted project content. The setting never disables expiry restrictions.

Use **Download project** for a ZIP of original file versions, saved image enhancements and JSON project/iteration, slide, budget, question and comment data. Existing individual file downloads remain available while restricted. The export is an archive of work, not an importer or a promise of a self-contained offline presentation.

## Operations and troubleshooting

- `stripe_events`: durable webhook inbox. `status=pending`, `attempts`, `next_attempt` and `error` show delivery processing failures; retries back off. Duplicate event IDs and duplicate grants are ignored.
- `billing_orders`: pending/paid/expired/cancelled/failed/refunded purchases with Stripe IDs. Pending checkout can be resumed/cancelled in Billing. Purchases are bound to a studio and project on the server.
- `billing_changes`: proration quotes, scheduled reductions and incomplete payments. A network error during confirmation leaves an `applying` record that can be resumed safely.
- `billing_notices`: reminder outbox and per-recipient delivery status. Delivery failures do not masquerade as success.
- **Refresh** in Billing reconciles that studio's Stripe state. The worker also reconciles periodically. API reads use the locally recorded entitlements, not a Stripe call per project.
- Signed webhook receipt returns success only after durable storage; fulfillment is performed by the worker. A checkout success URL never grants access.
- Each studio has a separate Stripe Customer. Only studio admins can access billing, invoices, portal sessions and purchase actions. Billing privileges do not expose private project files.
- If a refund or a payment arrives after a project has been manually deleted, review the order/event error in Stripe. Do not recreate project data automatically.

## Project access and reactivation

- `project_access` returns an authorized project decision (or creation decision without a project ID). Existing active subscription projects remain editable at full capacity. Archived projects need an explicit reactivation confirmation.
- `project_activate` checks membership, selected coverage and capacity within `BEGIN IMMEDIATE`. An explicitly selected replacement project is archived in the same transaction; a failed restore rolls everything back. Creation can also atomically archive the explicitly confirmed project. Competing activations cannot consume the same slot.
- Expired trial projects open directly in private read-only mode. Other access restrictions and explicit reactivation requests use the access dialog. Trial days remaining or expiry appear in a slim fixed full-width bar with an Activate button linking to Billing; there are no automatic trial popups. Members see an admin contact message instead of purchase controls; clients receive neutral unavailable messages.
- Pass extensions cost €15 for 150 additional days. They retain the named designer and lifetime allowance. Pass coverage never consumes a subscription slot, and archiving never pauses its clock.
- Purchase intent is stored for up to 24 hours in the originating browser tab, scoped to the signed-in user and studio. Checkout and portal returns reconcile server state before resuming. An archived project or coverage change is confirmed again with current slot usage. Billing’s **Continue to project** button also handles delayed webhooks and returns from hosted invoices. Closing the tab loses this navigation intent; it does not affect paid coverage.
- A purchase success URL, a stored intent, or a failed/pending payment cannot grant access. Every write retains its server-side guard. Expiry during an open session removes editing controls on refresh; a rejected write opens the contextual access dialog.

## Validation

Run in the application's PHP container (isolated temporary databases, mocked Stripe, no external payments):

```sh
php tests/test_billing.php
php tests/test_billing_stripe.php
php tests/test_billing_website_bundle.php
python3 tests/test_billing.py
python3 tests/test_security.py -q
```

Module state checks: `node tests/test_billing_addons.mjs`. Browser checks: `node tests/test_billing.cjs` and `node tests/test_project_access.cjs`, with `PLAYWRIGHT_MODULE` and `CHROMIUM_EXECUTABLE` if needed. The browser test uses a local static server and fictional API responses.

References: [Checkout](https://docs.stripe.com/payments/checkout), [one-time invoices](https://docs.stripe.com/receipts), [Customer Portal](https://docs.stripe.com/customer-management), [subscription webhooks](https://docs.stripe.com/billing/subscriptions/webhooks), [pending subscription updates](https://docs.stripe.com/billing/subscriptions/pending-updates).
