# VETRO
Brand Profile — v2.0

Verified, not assumed.

---

## 1. Brand Overview

Vetro is the operational system Scottish security contractors run their business on — scheduling, GPS-verified clock-in, patrol and checkpoint verification, incident reporting, and client-facing reporting — with SIA licence status, BS7858 vetting, and qualifications held as a first-class integrated module inside it, checked automatically instead of chased manually. Built by Tide Events Group Scotland, sold as its own product and its own brand.

**What Vetro is:** A security management system — the record of where officers are, when they worked, what they found on patrol, and what happened on shift — with compliance (licences, vetting, qualifications) built into the same system rather than living in a separate tool.

**What Vetro is not:** An enterprise platform priced for 2,000-officer operations — Vetro stays flat-fee and sized for the small-to-mid Scottish contractor. Not a vetting provider itself — Vetro tracks and verifies status, it doesn't carry out BS7858 screening.

## 2. Brand Position

**Verified, not assumed.** Every other option in this space asks a contractor to trust a spreadsheet, a filing cabinet, a text thread, or their own memory. Vetro replaces assumption with a checked, dated, exportable fact — whether that fact is "this licence is active" or "this officer clocked in at this site."

Built for the small-to-mid Scottish security contractor currently running scheduling and compliance manually, and for the independent consultant who needs to check status across contractors they don't employ. No other platform in this category treats vetting/BS7858 as a first-class integrated module rather than a bolted-on licence-expiry alert — that stays Vetro's edge even as the product grows into the full operational system.

---

## 3. Visual Identity

### Logo

The Vetro mark is a two-tone V — two thick angled strokes meeting at a single point, one in Vetro Teal, one in Ink, forming the V that opens the wordmark "etro." The two colours meeting at a point represents two independent checks (licence + vetting) converging into one verified status — a visual echo of what the product actually does.

Set in Sora, a geometric sans-serif, weight 700 for the wordmark. Tagline "VERIFIED, NOT ASSUMED" sits below in Vetro Teal, smaller and letter-spaced.

**File versions** (see `assets/brand/`):
- `vetro-logo-primary.svg` — full lockup with tagline (title pages, formal documents, pitch materials)
- `vetro-logo-horizontal.svg` — mark + wordmark, no tagline (headers, emails, in-product use)
- `vetro-icon.svg` — V mark alone (favicons, app icons, social profile photos)

**Minimum clear space:** Leave space equal to the width of one V-stroke around all sides of the mark. Don't crowd it against other logos, text, or edges.

**Minimum size:** The full lockup should not render below 120px wide — the tagline becomes illegible before the mark does. Below that, use the horizontal version without the tagline, or the icon alone.

### Colour Palette

| Name | Hex | Usage |
|---|---|---|
| Ink | #1F2933 | Primary text, wordmark, right stroke of the V mark |
| Vetro Teal | #0E7C7B | Primary brand colour — left stroke of the V, tagline, links, primary buttons |
| White | #FFFFFF | Background, contrast |
| Slate Grey | #E4E7EB | Cards, borders, secondary backgrounds |
| Status Amber | #FF6633 | Expiring soon (30 days) — the one deliberate link back to Tide's brand orange |
| Status Red | #D64545 | Expired / revoked |
| Status Green | #2E9E5B | Active / compliant |

Status colours are functional only — reserved for licence/vetting state indicators in-product, never used as general design accents.

### Typography

**Primary (digital/product):** Sora — weight 700 for headings and wordmark, weight 500 for UI labels and body emphasis, weight 400 for body text.

**Fallback (documents/print, where Sora may not be licensed or available):** Arial, matching Tide's existing document pipeline.

- Headings: Sora Bold, sentence case
- Body: Sora Regular or Arial Regular, 14–16px in-product / 11pt in documents
- No italics
- Sentence case throughout — never Title Case, never all-caps except the tagline treatment and short UI status labels

---

## 4. Voice and Tone

**Core voice:** Direct, unshowy, evidence-first. Vetro doesn't sell fear or hype automation — it sells certainty and time saved.

**Tone principles**
- **Plain** — "This licence expires in 12 days," not "Stay ahead of compliance risk"
- **Evidence-led** — always show the data, not just a verdict
- **Calm under status changes** — even an "expired" alert is factual, not alarmist
- **Speaks to the person doing the checking** — the office manager or contractor owner, not procurement or a C-suite

## 5. Key Messages

- One system for scheduling, GPS-verified attendance, patrols, incidents, and client reporting — replacing the spreadsheet-and-texting patchwork
- Compliance built in, not bolted on — one record per officer for licence, vetting, qualifications, and documents
- Checked automatically, not chased manually
- Audit-ready by default — export what an ACS inspector or client asks for in seconds
- Built for small and mid-sized Scottish contractors, priced flat-fee — not per-guard enterprise pricing built for a 2,000-person operation
- Verified, not assumed — the standing line, usable as a strapline anywhere the full tagline treatment doesn't fit

## 6. Brand in Practice

**Email signature**
Kyle Robb | Founder, Vetro
Built by Tide Events Group Scotland
[contact once domain/email is set up]

**Client-facing materials**
- Lead with the logo lockup including tagline on cover/title pages
- Use Vetro Teal for headings and key callouts, Status colours only for actual compliance states
- Include "Built by Tide Events Group Scotland" as a small credit line, not the headline

**In-product**
- Horizontal lockup (no tagline) in the app header/navigation
- Icon alone for favicon, mobile home-screen icon, and any small-format placement

---

## 7. Do's and Don'ts

**Do**
- Use "Vetro" on its own — not "Vetro Software," not "the Vetro system"
- Keep the two-tone V mark's colour split exactly as specified — teal left stroke, ink right stroke, meeting at one point
- Use Sora where available; fall back to Arial cleanly rather than substituting a different display font
- Credit "Built by Tide Events Group Scotland" once trust is established, kept secondary to the Vetro brand itself

**Don't**
- Don't claim official SIA integration or endorsement — Vetro checks the public register, and says so
- Don't recolour the V mark, add a gradient, or add a background shape/container around it — it stands on its own
- Don't stretch, skew, or rotate the logo
- Don't use fear-based compliance messaging ("risk," "exposure," "liability") as the lead — lead with certainty and time saved instead
- Don't lead with per-guard enterprise pricing framing or feature lists built for large operations — the whole pitch is a full system sized and priced for small Scottish contractors

---

## 8. Applied examples

**Email/status alert subject line:**
`Vetro: J. Smith's SIA licence expires in 14 days`

**Dashboard empty state (before first roster upload):**
`No officers added yet. Upload a CSV or add your first officer to start automatic checks.`

**One-line pitch for pilot conversations:**
`Vetro schedules your officers, verifies they clocked in at the right site, and checks their SIA licences and BS7858 vetting automatically — one system instead of a spreadsheet, a text thread, and a filing cabinet.`

---

## Implementation

- [`assets/brand/`](../assets/brand/) — the three logo SVGs described above.
- [`src/styles/tokens.css`](../src/styles/tokens.css) — colour, type, spacing, and radius tokens as CSS custom properties.
- [`src/styles/main.css`](../src/styles/main.css) — marketing site styles built on the tokens.
- [`app/src/styles/app.css`](../app/src/styles/app.css) — dashboard app styles, self-contained but sharing the same tokens.
