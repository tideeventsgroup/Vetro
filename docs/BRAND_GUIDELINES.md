# VETRO
Brand Guidelines — v1.0

Scotland's Security Workforce, Verified.

---

## Brand Overview

Vetro is a compliance record for Scottish security contractors — SIA licence status, BS7858 vetting, and qualifications held in one auditable place, checked automatically instead of chased manually. Built by Tide Events Group Scotland, sold as its own product.

## Brand Position

**Provable, not promised.** Vetro doesn't manage guards, patrols, or rotas — it answers one question with certainty: is this person legally allowed to work today? Everything else is a spreadsheet problem Vetro makes obsolete.

Independent of any single security contractor. Built for the operator who has to answer to an ACS audit, a client due-diligence request, or their own conscience at 6am before a shift starts.

---

## Visual Identity

### Relationship to Tide
Vetro is a Tide Events Group Scotland product but reads as its own brand — same disciplined, professional system, different accent colour, so it's immediately clear this is software, not a consultancy deliverable.

### Colour Palette

| Name | Hex | Usage |
|---|---|---|
| Ink | #1F2933 | Primary text, structure, authority (near-black, softer than pure black on screen) |
| Vetro Teal | #0E7C7B | Primary brand colour — logo, headings, primary buttons, links |
| White | #FFFFFF | Background, contrast |
| Slate Grey | #E4E7EB | Cards, borders, secondary backgrounds |
| Status Amber | #FF6633 | Expiring soon (30 days) — deliberately the Tide orange, ties Vetro back to Tide visually and functionally |
| Status Red | #D64545 | Expired / revoked — hard stop, cannot be ignored |
| Status Green | #2E9E5B | Active / compliant |

Status colours are functional, not decorative — they only appear on licence/vetting state indicators, never as general design accents. This keeps the compliance dashboard legible at a glance.

### Typography
**Font:** Inter or system sans-serif (Arial as fallback for document exports, matching Tide's document pipeline)
- Headings: Bold, teal or ink
- Body: Regular, ink, 14–16px in-product
- Status labels: Semibold, uppercase, small — colour-coded per table above
- No italics, consistent with Tide's house style

### Logo direction
Wordmark-first, not icon-first, at least for v1 — "VETRO" in a tight, slightly geometric sans-serif, teal on white. A simple mark can follow later (a stylised checkmark-in-a-shield or a single V built from a check-shape is the natural direction, echoing "verified" without copying any existing security-industry shield).

---

## Voice and Tone

**Core voice:** Direct, unshowy, evidence-first. Vetro doesn't sell fear or hype automation — it sells certainty and time saved.

**Tone principles**
- **Plain** — "This licence expires in 12 days," not "Stay ahead of compliance risk"
- **Evidence-led** — always show the data, not just a verdict
- **Calm under status changes** — even an "expired" alert is factual, not alarmist
- **Built for the person doing the checking**, not procurement — speaks to the office manager or contractor owner, not a C-suite

## Key Messages

- One record per officer — licence, vetting, qualifications, documents, in one place
- Checked automatically, not chased manually
- Audit-ready by default — export what an ACS inspector or client asks for in seconds
- Built for small and mid-sized Scottish contractors, priced like it
- Not another guard-tracking platform — Vetro does one job and does it properly

## Do's and Don'ts

**Do**
- Say "Vetro" on its own — avoid "Vetro Software" or "the Vetro system," keep it clean
- Use teal for anything active/brand; reserve amber/red/green strictly for compliance status
- Keep screenshots and marketing honest — real data shapes, real expiry windows, no fake "100% compliant" green-everything screens
- Credit "Built by Tide Events Group Scotland" in the footer/about, once trust is established

**Don't**
- Don't claim official SIA integration or endorsement — Vetro checks the public register, and says so
- Don't let Vetro's marketing borrow Tide's "we don't supply guards" language — different product, different claim (Vetro doesn't vet either; it tracks vetting)
- Don't use fear-based compliance messaging ("risk," "exposure," "liability") as the lead — lead with time saved and certainty instead
- Don't add scheduling/rota features to the brand story until Phase 2 is actually built

---

## Applied examples

**Email/status alert subject line:**
`Vetro: J. Smith's SIA licence expires in 14 days`

**Dashboard empty state (before first roster upload):**
`No officers added yet. Upload a CSV or add your first officer to start automatic checks.`

**One-line pitch for pilot conversations:**
`Vetro checks your officers' SIA licences and BS7858 vetting automatically, so you always know who's actually cleared to work — no more spreadsheets, no more chasing.`

---

## Implementation

- [`src/styles/tokens.css`](../src/styles/tokens.css) — colour, type, spacing, and radius tokens as CSS custom properties, generated directly from the palette and type rules above.
- [`src/styles/main.css`](../src/styles/main.css) — base styles and components (buttons, status badges, cards) built on top of the tokens.
- [`index.html`](../index.html) — brand-accurate landing page applying the voice, tone, and visual identity defined here.
