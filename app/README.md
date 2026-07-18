# Vetro app

The product itself: the dashboard a contractor's office manager logs into
to see who's cleared to work. Vite + React + TypeScript, styled from the
same tokens as the marketing site (`../src/styles/tokens.css`, imported
directly by `src/styles/app.css` rather than duplicated).

## Local development

```bash
cp .env.example .env
npm install
npm run dev
```

Requires `../backend` running (see `../backend/README.md`). With
`VITE_SKIP_AUTH=true` (the `.env.example` default) the login screen is
skipped entirely, matching the backend's `SKIP_AUTH` — there's no need to
stand up a real Cognito user pool just to develop locally.

## Auth

`src/lib/auth.tsx` uses `amazon-cognito-identity-js` directly (not full
Amplify) against the user pool created in `infra/lib/auth-stack.ts`. Real
login has not been exercised end-to-end in this repo yet — that requires an
actual deployed user pool with a user in it — only the `VITE_SKIP_AUTH` path
has been.

## What's here vs. not yet

- Officer roster, officer detail, adding officers/licences/vetting records,
  and the CSV export all work against the real API.
- Qualifications and document upload have backend routes
  (`backend/src/routes/qualifications.ts`, `documents.ts`) but no UI here
  yet — the next piece of frontend work.
- No contractor switcher: the dashboard uses whichever contractor comes
  back first from `GET /contractors`, which is fine for one contractor per
  login but will need real tenant-to-user mapping (probably a Cognito
  custom attribute) before a single login could ever see more than one.
