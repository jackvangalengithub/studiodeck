# Signup, trial and Stripe billing — proposal

Status: proposed for review, 18 September 2026. This document does not implement billing or change existing access. Prices follow `www/PRICING.md`; extension and lifecycle rules below are recommendations. The requested 7-day trial replaces that document's earlier 14-day suggestion.

## Product model

- Each studio owns one billing account and one Stripe Customer, created on its first checkout. Users can belong to multiple studios without sharing billing between them.
- A studio can hold one monthly subscription and multiple separately purchased Project Passes.
- Each project has an explicit coverage source: trial, project pass, or studio subscription. Coverage and lifecycle (active, archived, restricted) are separate fields/concepts.
- Access requires both normal project permissions and valid coverage. Paying never grants access to another studio or overrides project membership.
- A subscription includes the following proposed allowances; client guests do not consume designer seats.

| Package | Price, excluding VAT | Designers | Active projects | Duration |
| --- | --- | --- | --- | --- |
| Trial | Free; no card | 1 | 1 | 7 days |
| Project Pass | €19 once | 1 named designer on that project | 1 specific project | 150 days |
| Pass extension | €15 once | Same pass | Same project | Another 150 days |
| Solo | €39/month | 1 | 3 | While paid |
| Studio | €199/month | 5 | 15 | While paid |
| Practice | €399/month | 15 | 50 | While paid |

A pass-only studio starts with one designer account. Buying extra passes adds projects, not team seats. A studio with a subscription can also hold passes, but each pass project still has one named designer; collaboration requires moving that project into subscription coverage. Studio admins may manage billing without gaining access to private project contents. The billing list should expose only the project identification needed to manage purchases, not files or activity.

The existing pricing proposal also offers €10/month extra active-project capacity on any subscription and €20/month extra Practice seats. Implement these as explicitly purchased Stripe subscription quantities; never charge automatically when a limit is exceeded. Include them before publishing the existing add-on promises as live offers.

## First-time journey

1. Website CTA: “Start your 7-day trial — no card required.” Preserve any selected pricing plan as a preference, not an entitlement.
2. Enter email, verify via the existing magic-link flow, then complete name and studio name. Start the trial only after verified onboarding is completed, not when a login email is requested. Existing invitations and client logins retain their current destination and do not silently start a trial.
3. Guide the new admin to create one project, upload files, preview a presentation and invite a client. No package selection is required yet.
4. Show the exact trial end date and a quiet days-remaining banner. Allow purchase at any point. A subscription starts paid access immediately; a prepaid Project Pass starts its 150-day clock when used to create a project. No automatic charge when the trial ends.
5. Remind the admin two days before expiry. At expiry show an upgrade dialog on the next visit or attempted restricted action: “Your trial has ended. Keep working on [project] with a €19 Project Pass, or choose a monthly plan.” Include “View plans” and “Continue in read-only mode.” Avoid repeatedly reopening the dialog on every page.
6. Billing offers three subscription cards and a fourth Project Pass card. Buy a Project Pass before creating a new project; payment adds one unused pass to the studio. Creation consumes one pass atomically and starts its 150-day clock. Existing project-specific pass purchases and extensions remain supported through project access controls; subscription checkout attaches trial projects to the chosen studio plan. Preserve files, IDs, comments and history.
7. Return from Stripe with a processing state until the server confirms successful payment. Cancellation, failure or a pending payment leaves existing access unchanged.

Keep trial state in Studiodeck rather than creating a Stripe trial subscription: the customer has not chosen between a one-time pass and a subscription yet. Record trial eligibility against the verified initiating account and studio so creating another studio or deleting a project does not reset it. Email verification, signup throttling and bounded resource allowances reduce abuse; email alone cannot prevent every repeat signup.

Recommended trial image allowance: 3 enhancements total. Those jobs count toward the purchased pass's 10 lifetime enhancements, or the existing 10 per-project calendar-month subscription allowance. Set storage/upload and AI request budgets before launch; “all AI features included” must not mean unbounded trial costs.

## Pass expiry and extension

- Activate a prepaid pass for 150 × 24 hours when its project is created, after confirmed payment; show the exact local end date/time. Existing project-bound purchases retain their original activation time. Passes are not transferable to another project, and copying or restoring a project does not create coverage.
- Remind admins 14 days and 3 days before expiry, and once on expiry. Members see a neutral access message; clients never see a billing demand.
- Offer “Extend this project for 150 days — €15” through a new one-time Stripe Checkout purchase. Repeat extensions are allowed; no automatic renewal.
- New expiry is `max(current_expiry, confirmed_payment_time) + 150 days`. Early extension preserves remaining days; late extension does not charge for the inactive gap.
- Extension purchases add time only. They do not reset the 10 lifetime image enhancements, add seats or create another project. State this before payment.
- Archive actions do not pause a pass clock. Reactivation of an archived pass project requires that its pass remains valid.
- Expiry blocks edits, uploads, new iterations, AI, new client shares, and client comments. Existing client presentations show “This presentation is temporarily unavailable. Please contact the studio.” Normal studio permissions still allow viewing and downloading during retention.
- Extending restores the same project and any share link whose own expiry and revocation checks still pass. Payment does not revive an expired or revoked link. Current share links have their own 90-day expiry, independent of a 150-day pass.

Recommended retention: 90 days of private read-only access and downloads after paid coverage or trial access ends. Display a scheduled deletion date, send reminders 30 and 7 days beforehand, and allow renewal until deletion. Product records and uploads can be removed after that disclosed period; Stripe financial records follow a separate retention policy. Build and verify export/download completeness before promising data export. Do not enable deletion for existing projects until users have received the policy and migration notice.

This is a proposed retention policy, not an existing promise or an instruction to delete data now. Active subscribed studios retain archived subscription projects while paid; archived content is frozen, and existing client links can remain viewable under their normal link expiry. Archived projects cannot accept new comments, AI requests or edits and do not use active project capacity. Restoring requires a free slot. Pass expiry still applies to pass projects inside an otherwise paid studio.

## Subscriptions and switching coverage

- Active means a subscription-covered project available for ongoing edits or collaboration. Trial/pass projects do not consume subscription project capacity.
- Count studio designer memberships against paid seats; client guests are excluded. Check project capacity during creation, restoration, duplication and coverage changes; check seats when adding memberships.
- An admin can move a pass project onto the subscription when capacity is available. Show the change explicitly. Preserve its paid pass history and original expiry; the clock keeps running. Do not issue an automatic refund or credit in the first version.
- A project moved onto subscription coverage uses its monthly image allowance without erasing past jobs. Switching back to a valid pass uses the lifetime allowance including historical enhancements; changing coverage never resets usage.
- When leaving subscription coverage, an admin can choose an existing unexpired pass, buy a new pass for a project that has never had one, or extend an expired historical pass. The one-designer rule must be satisfied. Do not silently change funding or grant a free extension.
- Cancellation takes effect at the paid period end. Subscription projects remain usable until then, then become restricted; separately covered pass projects continue normally.
- Recommended renewal-failure grace: 3 days after the paid period ends, with reminders and a payment-method action. Initial failed or incomplete payments do not grant access or grace. After grace, use the same restricted/retention state; successful recovery restores access.
- Upgrades and added capacity take effect after confirmed payment, with Stripe proration previewed before confirmation. Downgrades and capacity reductions take effect at renewal and must fit the chosen project and seat limits. Block incompatible changes and ask admins to choose projects to archive or memberships to remove; never delete projects or arbitrarily choose who loses access.
- Restrict Stripe Portal plan switching if it cannot enforce those application constraints; use an app-initiated Stripe flow for validated plan changes. Portal cancellation and payment-method updates remain available.
- Full pass refunds revoke the refunded grant and recompute remaining coverage. Extension refunds remove that extension's grant rather than resetting all access. Subscription refunds and disputes require an explicit audited policy; a historical invoice refund should not accidentally cancel an unrelated current paid period.

## Admin billing page

Add **Studio settings → Billing**, available only to studio admins. Enforce that role and selected-studio membership on every billing endpoint, not only in navigation. Members may see project access status and “Contact your studio admin”; invoices and payment details stay private.

Show:

1. **Current package:** trial / passes only / Solo / Studio / Practice; paid status; price and recurrence; next renewal or cancellation date; trial deadline; failed-payment status where relevant.
2. **Usage:** designers used/included, subscription projects used/included, purchased extra capacity, and separate pass count. A subscription and passes can coexist, so a single plan label is insufficient.
3. **Project coverage list:** project identifier/name permitted for billing administration, coverage source, active/archive/restricted status, exact pass expiry, and Extend / Move to subscription / Buy pass actions where applicable. Never expose project content through billing privileges.
4. **Payment management:** an authenticated, short-lived link to the correct Stripe Customer Portal for payment methods, billing details and cancellation.
5. **Invoices:** Stripe-issued invoice history with date, description, amount, currency, status and invoice/PDF links; include passes, extensions and subscriptions.

Example: “Solo · €39/month · Renews 18 October”; “1/1 designers · 2/3 subscription projects”; “Villa Auren · Project Pass · Expires 15 February · Extend for €15”. Dates are illustrative.

## Stripe integration and application data

Use Stripe-hosted Checkout for one-time and subscription purchases, Stripe Billing for recurring billing, and Stripe Customer Portal for supported management actions. Enable invoice creation for one-time pass/extension Checkout purchases; subscription invoices are automatic. Collect billing address and relevant tax details in Stripe, and configure tax handling for the business before launch. Stripe manages monetary documents; Studiodeck manages project access and expiry.

Suggested application records:

- `studio_billing`: studio/customer mapping, trial start/end and eligibility origin, subscribed plan/status, paid-through/grace dates, purchased seat/project quantities.
- `project_coverage`: selected coverage source, pass designer, restriction and retention dates, references to studio subscription or project pass.
- `project_access_grants`: immutable purchase/extension history, project, purchased duration, Stripe checkout/payment/invoice IDs, confirmation and revocation timestamps. Derive pass expiry from valid grants.
- `billing_orders`: server-approved plan/price/project, initiating admin, checkout ID, pending/paid/failed/refunded state; deduplicate repeated checkout submissions.
- `stripe_events`: unique event ID, durable payload/processing state, retry/error information and audit linkage.
- Notification delivery records so deadline jobs do not send repeated notices.

Stripe product prices must come from a server-controlled catalog. Bind every purchase to the authenticated studio and selected project; clients cannot submit an arbitrary price, customer or access duration. Recheck coverage/capacity before fulfillment to handle concurrent admins and stale checkouts.

Create a dedicated signature-verified webhook endpoint, independent of browser session authentication and CSRF. Activate one-time grants only after verified payment success, including delayed-payment success/failure; sync subscription invoices, subscription changes/cancellation, refunds and disputes. Do not unlock access merely because the success URL was opened or Checkout completed with payment still pending.

Persist and process events idempotently, tolerate retries and out-of-order delivery, and ensure each paid order grants access once even when multiple event types describe it. Retrieve current Stripe subscription state when reconciling older events. Use reconciliation to repair missed updates without requiring Stripe calls on every app request. A worker handles deadlines and reminders, while request-time entitlement checks ensure expiry remains effective if the worker is late.

Centralize capability checks for edit, upload, AI, share, comment, project creation/restore and seat additions. Cover every API path, client route and background job; UI disabling is only an explanation. Permit read/download, billing recovery, account access, member removal and data-management operations as appropriate during restriction. Recheck queued jobs before expensive work and do not charge quota for jobs rejected due to expiry. Preserve already completed outputs and safely finish storing in-flight results.

Replace `app/enhancements.php`'s implicit monthly default with the actual effective entitlement and trial policy. Keep image usage accounting separate from time-based project access.

## Delivery sequence and checks

1. Agree the proposed commercial rules: extension price/duration, trial limits, retention/client-link behavior and migration terms.
2. Add billing records, centralized permissions, verified signup/onboarding and the 7-day trial. Existing studios receive an explicit migration exemption until a communicated date; never infer their trial began at historical account creation. Keep demos/test fixtures explicit and isolated from production exemptions.
3. Integrate Stripe products, hosted checkout, one-time invoices, webhook processing and reconciliation in test mode.
4. Add the admin Billing page, project badges, usage limits, trial/expiry dialogs and Stripe Portal entry. Add proration/plan change validation and the published capacity add-ons.
5. Add reminders, expiry/recovery, refunds handling, retention/export and the carefully staged cleanup process. Update website pricing/signup links and terms to the implemented rules.
6. Verify signup and invitation paths; trial boundaries; payment success/pending/failure/cancel; signature rejection; duplicate/out-of-order events; early/late/repeated extensions; renewal grace/cancellation; cross-studio and member denial; project/seat races; coverage switching without quota resets; client-link expiry/revocation; restricted exports and queued jobs; migration without unexpected lockouts; and recovery after missed events.

No application or Stripe account changes are included in this planning task.

## Stripe references

- [Checkout: one-time and recurring payments](https://docs.stripe.com/payments/checkout)
- [Receipts and paid invoices, including enabling one-time invoices](https://docs.stripe.com/receipts)
- [Customer Portal](https://docs.stripe.com/customer-management)
- [Subscription webhook lifecycle](https://docs.stripe.com/billing/subscriptions/webhooks)
- [Webhook signature verification and event delivery](https://docs.stripe.com/webhooks)
