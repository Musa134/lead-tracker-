# Lead Tracker (Colour X)

Mobile-first lead capture and tracking app for the Colour X retail store sales team.

## Stack
- Vite + React 19
- Tailwind CSS v4 (`@tailwindcss/vite`)
- Supabase (Postgres) — project URL: https://gsxeiwgrstsmztcqexpb.supabase.co
- Vercel for hosting
- PWA — installable on iOS and Android, runs fullscreen

## Key Files
- `src/App.jsx` — router only; all routes defined here
- `src/pages/Hub.jsx` — landing page after login
- `src/pages/LeadTracker.jsx` — lead tracker app
- `src/pages/Login.jsx` — login page
- `src/pages/ChangePassword.jsx` — change password page
- `src/pages/crm/CRMFeed.jsx` — CRM activity feed
- `src/pages/crm/LogCall.jsx` — log a call form
- `src/pages/crm/AllAccounts.jsx` — all accounts view
- `src/contexts/AuthContext.jsx` — Supabase auth + rep name lookup
- `src/lib/constants.js` — CRM reps, rep colors, email-to-rep mapping
- `src/index.css` — Tailwind import only
- `.env.local` — Supabase keys, never commit this

## Supabase Tables
- `leads` — company, name, phone, assigned_to, status, opportunity, reporting_group
- `lead_comments` — id, lead_id, text, author, created_at (cascades on lead delete)
- `crm_calls` — rep_name, company_name, contact_name, phone_number, call_type, objectives, call_notes, whats_next, follow_up_date, logged_at
- `crm_accounts` — company_name
- `crm_contacts` — account_id, contact_name, phone_number, position

## Reps
Unassigned, Ralph, Shane, Rob, Frank, Jeff, Musa

## Rep Emails (for email notifications + CRM login)
- Ralph: ralph@colourx.ca
- Shane: shane@colourx.ca
- Rob: robert@colourx.ca
- Frank: frank@colourx.ca
- Jeff: jeff@colourx.ca
- Musa: musa.nizam@benjaminmoore.com

## Features
- Login (Supabase auth) → Hub → Lead Tracker or CRM
- New lead intake form with email notification to assigned rep via EmailJS
- Filter by rep, leads sorted A→Z
- Expand lead card → view/add comments (formatting preserved), update status, reassign rep, archive, delete
- Archive page — restore or view archived leads
- CRM: log calls, view feed, filter by rep, weekly email summary to Frank

## Rules
- Always test on mobile (this is a mobile-first app)
- Never commit `.env.local`
- Deploy by pushing to GitHub — Vercel auto-redeploys
- Always run `git status` before pushing — new page files must be explicitly staged or Vercel won't have them
