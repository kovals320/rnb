# Rose&Bloom — gardening team app

Mobile-first Hebrew (RTL) web app for scheduling the gardening team, replacing the Base44 version.

- **Managers** schedule jobs (garden + date + workers + extra tasks), manage client files with fixed tasks, and manage workers.
- **Workers** see only their own jobs, tick a shared checklist, add notes and photos, and finish the job by sending a PDF report on WhatsApp (this marks the job as submitted).

## Stack
- React + TypeScript + Vite + Tailwind, deployed on Vercel (`rnb.dorh.fyi`)
- Supabase (shared project "home"): Postgres with row-level security, auth (email + password), storage, one edge function
- All database objects are prefixed `rnb_` — see `supabase/schema.sql`

## Develop
```bash
npm install
npm run dev
```
Optional env vars (defaults point at the production project): `VITE_SUPABASE_URL`, `VITE_SUPABASE_KEY` (publishable key).

## Accounts
Managers add workers from the Workers screen and set their initial password there. There is no self sign-up.
