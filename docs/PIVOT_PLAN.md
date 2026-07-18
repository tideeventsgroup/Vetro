# Vetro: Pivot Plan — Security Management System First, Vetting as Add-On

Prepared by Tide Events Group Scotland | July 2026

## 1. Why this pivot makes sense

Current market research across 2026 buyer's guides and product comparisons (Belfry, GuardMetrics, Novagems, GuardTrac, TARGPatrol, Slashdot's platform roundup) is consistent on one point: security guard management software is expected to be a centralised system managing guards, patrols, schedules, incidents, and reporting from one platform — not a single-purpose tool. Buyers evaluating this category in 2026 are shopping for the whole operational picture, not a standalone compliance tracker. A vetting-only product risks being seen as a nice utility rather than the system a contractor actually runs their business on — which limits both price and stickiness.

The core job of this software is tracking where guards are, scheduling shifts, verifying patrols, capturing incident reports, and producing the records used to bill clients — together replacing the patchwork of paper logs, spreadsheets, texting, and separate payroll exports most small and mid-sized firms currently cobble together. That "patchwork replacement" framing is a stronger, higher-value pitch than "we track your licences" alone — and it's the framing every serious competitor in this space leads with.

Repositioning Vetro as the operational system of record first — with vetting/licence compliance as one strong, tightly integrated module inside it, rather than the whole product — is the more defensible long-term position.

## 2. What the market says the core system must include

Pulled from current 2026 buyer's guides and product pages (Belfry, GuardMetrics, Novagems, GuardTrac, TARGPatrol, GuardTrac's own comparison of Silvertrac/TrackTik/GuardsPro):

**Scheduling & workforce**
- Shift/roster scheduling with drag-and-drop and real-time updates
- Multi-site management as the operation grows

**Field verification (the category's actual core)**
- Live GPS location so dispatch can see every active guard, with geofencing tying clock-ins to the physical site so guards can't punch in from off-site — flagged repeatedly as the single feature that matters most, since it eliminates buddy-punching and gives proof-of-presence for client billing
- QR-code checkpoint tours with automated patrol-completion verification, and one-tap GPS-verified clock in/out with geofence validation
- Checkpoint scanning via QR code, barcode, or NFC tag, automatically logging GPS position and timestamp

**Incident reporting**
- Mobile incident reporting with time-stamped photos, audio, and text notes, plus embedded GPS metadata — letting guards log incidents from their phone in real time, attach photos, add GPS coordinates, and categorise the event

**Dispatch & communication**
- In-app messaging and broadcast alerts connecting guards and dispatch in real time

**Client-facing reporting**
- Custom report templates and live client dashboards that clients can check without calling the contractor — repeatedly cited as a contract-retention feature, not just a nice-to-have

**Compliance/HR (Vetro's existing wheelhouse)**
- Certification tracking built directly into the same system as scheduling and payroll, rather than sitting in a separate tool

## 3. Where pricing has to land

Novagems' own 2026 buyer's guide is blunt about the trap smaller operators fall into: avoid enterprise platforms that charge per guard at enterprise rates — a 20-guard operation can end up paying $400–600/month for a feature set actually built for a 2,000-person operation. This directly confirms the gap identified earlier: small Scottish contractors are the underserved segment, and per-guard enterprise pricing is exactly what pushes them out. Vetro's pricing has to stay flat-fee and small-operator-sized, even as the feature set grows to match the full category.

## 4. Revised product structure

**Core: Vetro Security Management**

1. Scheduling — shift builder, multi-site, drag-and-drop, open-shift swaps
2. Patrol & checkpoint verification — QR/NFC checkpoint scanning, GPS-logged tours
3. GPS clock-in/out — geofenced, eliminates buddy-punching, proof-of-presence for billing
4. Incident reporting — mobile-first, photo/audio/text, GPS-tagged, categorised
5. Dispatch/messaging — real-time broadcast and 1:1 messaging between control room and officers
6. Client portal — live view of patrol completion, incident reports, and invoicing-ready records

**Add-on module: Vetro Vetting** (everything already designed in the earlier Phase 1/Phase 2 plans)

1. SIA licence tracking with automated public-register re-checks
2. BS7858 vetting status and expiry tracking
3. Document storage and audit-ready export
4. Officer self-service upload (from the Rightcheck-inspired research)

Structuring it this way keeps the vetting work already planned and researched — it isn't wasted, it becomes the differentiator layered on top of a full system rather than the entire product. No other platform reviewed (Silvertrac, TrackTik, Novagems, GuardTrac, Belfry, SequriX, GuardMetrics, TARGPatrol) treats vetting/BS7858 as a first-class integrated module — they all bolt on basic licence-expiry alerts at best. That remains Vetro's edge even inside a bigger system.

## 5. Revised build sequence

This is a materially bigger build than the vetting-only Phase 1 previously scoped. Recommend sequencing it so something usable ships early rather than building the whole core before launch:

**Stage 1 — Scheduling + GPS clock-in (foundation)**
Shift builder, officer assignment, geofenced clock-in/out. This alone replaces the worst of the spreadsheet-and-texting patchwork and is sellable on its own.

**Stage 2 — Patrol/checkpoint verification + incident reporting**
QR/NFC checkpoint scanning, GPS-logged tours, mobile incident reports with photo/audio/GPS. This is the category's actual core value and where most buyer attention goes.

**Stage 3 — Dispatch messaging + client portal**
Real-time broadcast/messaging, and a client-facing live view — the features that win and retain contracts.

**Stage 4 — Vetro Vetting add-on**
Bring in the SIA/BS7858 tracking work already fully planned and designed — this stage is largely ready to build from existing specs, just re-sequenced to sit after the core rather than before it.

**Effort note:** this is realistically a multi-month build even AI-assisted, not the ~8-week MVP previously scoped for vetting alone. Worth deciding whether to launch Stage 1 alone as an early "scheduling + GPS" product to start getting paying users and feedback before Stages 2–4 are complete, rather than holding everything back for one big launch.

## 6. What carries over unchanged

- Brand identity (Vetro name, logo, colour system, voice) — all still correct for a broader system, no rework needed
- Scotland-first positioning and small-operator flat pricing — still the core differentiator, now applied to a bigger product
- Exception-based dashboard philosophy (from the Timegate research) — even more relevant now with more data types (patrols, incidents, alerts, vetting) all needing to surface only what needs attention
- The three-surface structure from the Rightcheck research (admin portal / officer app / client view) — now maps even better onto a full SMS than it did onto vetting alone

## 7. Where the build already stood when this plan landed

Several Stage 1–3 items were already built into Vetro before this plan was written (see the app's route/task history): shift scheduling and confirmation, basic (non-geofenced) clock-in/out, mobile incident reporting with photo upload and categorisation, manual patrol-checkpoint scanning, a visitor log, and a client portal with reporting rollups. The gaps against this plan, as of July 2026:

- **GPS/geofencing** — clock-in/out and checkpoint scans are currently site-membership-verified (an officer must have a shift at that site), not GPS/geofence-verified. Closing this gap is the first concrete piece of work coming out of this plan.
- **QR/NFC checkpoint scanning** — current implementation is a manual "mark scanned" action, not a QR/NFC tap.
- **Dispatch/broadcast messaging** — not built.

These become the near-term backlog for Stage 1 completion and Stage 2/3 work.
