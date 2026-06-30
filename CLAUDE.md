# Lead Tracker (Colour X)

Mobile-first lead capture and tracking app for the Colour X retail store sales team.

## Stack
- Vite + React 19
- Tailwind CSS v4 (`@tailwindcss/vite`)
- Supabase (Postgres) — project URL: https://gsxeiwgrstsmztcqexpb.supabase.co
- Vercel for hosting
- PWA — installable on iOS and Android, runs fullscreen

## Key Files
- `src/App.jsx` — all app logic lives here
- `src/index.css` — Tailwind import only
- `.env.local` — Supabase keys, never commit this

## Supabase Tables
- `leads` — company, name, phone, assigned_to, status, opportunity, reporting_group
- `lead_comments` — id, lead_id, text, author, created_at (cascades on lead delete)

## Reps
Unassigned, Ralph, Shane, Rob, Frank, Musa

## Features
- New lead intake form
- Filter by rep
- Leads sorted A→Z by company name
- Expand lead card → view/add comments, update status, reassign rep, archive, delete
- Archive page — restore or view archived leads

## Rules
- Always test on mobile (this is a mobile-first app)
- Never commit `.env.local`
- Deploy by pushing to GitHub — Vercel auto-redeploys
