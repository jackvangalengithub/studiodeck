# Pricing and packaging proposal

## Recommendation

Lead with a **€19.00 one-time Project Pass with 150 days of access**, then offer **monthly studio workspaces with bundles of designers and active projects** for ongoing work. Include client guests, presentations, contextual feedback, budgets and revision history in every subscription. Let customers move up as their practice grows. Include all AI features in every plan and the Project Pass; there is no separate AI activation, credit pack or AI surcharge.

The product's strongest reason to buy is the client experience: existing design files become an interactive, branded presentation; feedback stays with the relevant visual; shared iterations preserve their original state; and budgets and scope answers retain source references. Price around this outcome, rather than presenting Studiodeck as a replacement for CAD, accounting, procurement or construction management.

The static site uses these proposed EUR prices, excluding VAT:

| Package | Price | Billing | Designers | Active projects |
| --- | ---: | --- | ---: | ---: |
| Project Pass | €19.00 | One-time payment, 150 days of access | 1 | 1 |
| Solo | €39 | Monthly | 1 | 3 |
| Studio | €199 | Monthly | Up to 5 | 15 |
| Practice | €399 | Monthly | 15 included | 50 |

All subscriptions are monthly only, at the displayed prices. Studio is capped at 5 people. Practice includes 15 people; additional people cost €20 each per month, without increasing included project capacity. For example, 18 people costs €459/month for 50 active projects. Lead with the €19.00 Project Pass as the easiest first purchase: one payment, one project, 150 days of access, no subscription. It appears in the hero and above the monthly plans. The Project Pass access period is limited to 150 days. Buy the pass first; its 150-day access period begins when it is redeemed to create a project. A €15 extension adds 150 days without resetting AI usage; private read-only retention lasts at least 90 days after notice.

These prices remain commercial hypotheses to validate with customers. The application now implements Stripe checkout, recurring billing, access gates, project/seat quotas and a 7-day trial. See [billing deployment](../docs/billing.md) for activation and operational requirements.

## Included project capacity and add-ons

**Solo: 3. Studio: 15. Practice: 50 included active projects. Extra active projects: €10 each/month on any subscription.** Count ongoing design commissions, not individual decks, revisions or uploads. A studio with five people gets room for roughly three concurrent projects per person; Practice has more headroom for parallel teams. These limits are proposals to validate with real usage, not measured industry averages.

Archiving a completed project should free an active slot. Restoring an archive requires an available slot. Define archive retention and storage separately; unlimited client guests does not mean unlimited storage. Do not force a completed project to stay billable merely to preserve its history.

Every monthly plan offers extra active projects at **€10 per project per month**. Extra Practice seats remain €20 per person per month and do not automatically add project capacity. Add-ons must be explicitly selected, not silently billed. For example, Studio with 18 active projects costs €229/month; Practice with 18 people and 55 active projects costs €509/month. The €19 one-time Project Pass remains a separate single-project purchase with 150 days of access. Define when added project capacity can be removed and how proration works before paid launch.

The €19 Project Pass is for one designer, one project and 150 days of access. The recurring studio plans must earn their higher price through shared team access and repeated project use; do not rely on one-person customers buying team plans when Project Pass fits them better.

## What belongs in each package

- **Every plan:** file ingestion, editable presentations, project/studio branding, client guests, contextual feedback, budget tools and preserved shared iterations. All AI-powered capabilities are included in the price, with no separate customer activation or add-on purchase.
- **Solo:** a complete product for one professional; do not weaken presentation quality to force an upgrade.
- **Studio:** the natural team bundle. Up to five people share 15 active projects for €199/month. A sixth person requires the Practice tier. The current product already supports memberships, project teams and access controls.
- **Practice:** 15 included people and 50 active projects for €399/month, with extra people at €20/month each, using the existing project/team model. Do not claim SSO, dedicated hosting, SLAs, native CAD/BIM editing, formal client approvals, procurement, accounting integrations or unlimited storage.
- **Project Pass:** the primary entry offer, at €19.00 for one project, one designer and 150 days of access. No recurring subscription. Extensions cost €15 for another 150 days. Post-expiry private downloads remain available for at least 90 days after notice. Individual share-link expiry remains separate.

Branding currently supports project/studio logos, palettes and typography; presentations retain “Presented by studiodeck.” Do not sell full white labelling or custom domains until those exist.

## Other viable pricing models

| Model | Example to test | Best fit | Main tradeoff |
| --- | --- | --- | --- |
| Bundled subscription **(recommended)** | The three website plans | Regular solo practices and teams | Predictable bills, but seat and project allowances need validation. |
| Per designer | €25–35 per designer/month, guests free | Firms that think in staff licenses | Simple expansion revenue; can discourage adding occasional contributors. |
| Per project | €19.00 one-time per project, 150 days of access | Side practices, pitches and occasional projects | Easy first purchase; uneven revenue and awkward long-running projects. |
| One main plan + add-ons | €39/month for 1 designer, extra designers at €12/month | A deliberately simple launch | Fewer plan choices; larger teams may find the growing total less predictable. |
| Monthly company agreement | Quoted from usage and support needs | Larger multidisciplinary practices | More sales work and service expectations; offer only capabilities you can deliver. |

Launch with the Project Pass as the entry point and monthly subscriptions for repeat use. Avoid introducing all five models simultaneously. A one-time lifetime license is a poor default while storage, conversion, support and AI carry recurring costs. A paid setup service could be added later, with its deliverables and support boundaries explicitly defined.

## AI and usage economics

Keep client viewing and commenting free. These are part of the value customers are buying, and charging recipients creates friction.

All AI features are included in the displayed prices, including the €19.00 Project Pass. Do not sell separate AI credit packs or require customers to activate AI. **Image alterations include 10 enhancements total per Project Pass, or 10 per project per calendar month (UTC) on monthly plans.** Queued edits reserve capacity; failed edits return it. Originals and all saved variations stay available after the allowance is exhausted or resets. No credits or top-ups are offered.

Keep model, conversion, storage and support cost measurements internal so the bundled plans remain sustainable.

At an illustrative 80% gross-margin target, the €19.00 Project Pass has a €3.80 variable-cost budget per project. This is an internal planning target, not a customer usage charge or an advertised allowance.

For an **illustrative 80% gross-margin target**, a €39/month Solo subscription has a €7.80/month variable-cost budget before fixed operating costs. AI, storage, conversion infrastructure, transaction fees and variable support all draw from that budget. This is a planning example, not an estimate of actual costs.

## Conversion and packaging ideas

- **A client-view demo:** already included in the site. Buyers can experience the presentation, budget context and feedback before making an account.
- **Discipline-specific examples:** already included. Garden designers should see planting/landscape context; architects should see drawings and revisions; interior designers should see material and room stories.
- **One-project onboarding:** once signup exists, help customers import one real project and preview a deck before asking them to set up an entire studio.
- **A trial with limits:** 7 days, one designer, one active project, no card; 3 image enhancements, bounded uploads and question usage. Original files and a project export remain available after expiry during retention.
- **An optional first-deck service:** charge a clear one-time fee only when you can provide a defined human onboarding service.
- **Proof over generic praise:** publish permissioned customer examples, before/after workflows and real case studies when available. The site deliberately avoids invented customer counts, ratings, time savings or testimonials. Its sample feedback is explicitly fictional.

## Decisions before paid launch

Define “active project” as a project the studio is still developing or sharing, and decide whether archived projects retain client access. Set storage, archive retention, project reactivation and deletion rules. Unlimited guests must not be confused with unlimited storage or permanent link access; the current app's share links expire after 90 days and can be revoked.

Confirm extra-seat options, upgrade and downgrade timing, monthly renewal/cancellation, VAT handling, refunds, free/trial access and service availability. Implement actual entitlement checks and usage metering alongside checkout. Establish an owner contact and production privacy/contract terms when the service starts collecting customer data; the preview's privacy text only describes the static website.

Validate willingness to pay with solo designers and several small studios using their own files. Watch activation (first reviewed deck), first client share, repeat-project use, and paid conversion. Review margins and plan limits before discounting the headline price.

## Market reference

Checked 18 September 2026: [Mydoma's published pricing](https://mydomastudio.com/pricing/) advertises **$58/month/user when paid yearly**, with a broader interior-design business-management offering. This provides context for the category, not an apples-to-apples value comparison or a reason to copy its price. Studiodeck's EUR figures above are our proposed positioning and have not been validated by market testing.
