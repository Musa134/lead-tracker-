# HANDOFF — CX Sales Hub

## Session: 2026-06-30

## What was done
- **Note formatting fix** — comments in lead cards now preserve line breaks (`whitespace-pre-wrap`)
- **Jeff added as rep** — lead tracker dropdown, email notifications at jeff@colourx.ca, CRM dark gray badge, Supabase login created
- **Full app committed to git** — Hub, Login, CRM pages, AuthContext, AllAccounts, LogCall were never in git; all committed and pushed this session; git and Vercel now in sync
- **CLAUDE.md + CONTEXT.md updated** — reflect current file structure and all reps
- **Forgot password flow** — "Forgot Password?" link on login page; Supabase sends reset email; lands on /change-password; confirmed working

## Current status
- Live at https://lead-tracker-murex-two.vercel.app/login
- All 6 rep accounts in Supabase: ralph, shane, robert, frank, jeff, musa
- Jeff confirmed working — CRM log call tested and passing
- Git and Vercel fully in sync
- Reps can self-serve reset their own passwords

## Supabase URL config (required for password reset)
- Site URL: https://lead-tracker-murex-two.vercel.app
- Redirect URLs: https://lead-tracker-murex-two.vercel.app/**

## Key lesson this session
Previous deploys went via `vercel --prod` CLI (deployed local files, bypassed git). Today's `git push` triggered a GitHub build from old git HEAD which broke the live app. Fixed by committing all missing files. Going forward: deploy only via `git push`, never `vercel --prod`.

**Rule:** Run `git status` at session start. Untracked page files = Vercel doesn't have them.

## EmailJS config (unchanged)
- Service ID: service_0y3zdv8 / Public Key: b7RJCqZ6O0LTsIFvb
- Lead notification template: template_3drjmb3
- Weekly summary template: template_8r7xnpb

## Supabase schema (current)
- `leads` + `lead_comments` — Lead Tracker
- `crm_accounts` — company_name
- `crm_contacts` — account_id FK, contact_name, phone_number, position
- `crm_calls` — rep_name, company_name, contact_name, phone_number, call_type, objectives, call_notes, whats_next, logged_at, follow_up_date
- `call_attachments` — call_id FK, url, file_name, created_at
- Storage: `call-attachments` bucket (public)
- RLS: enabled on all tables, authenticated role only

## Admin notes
- To disable a departing rep: Supabase dashboard → Authentication → Users → Ban user
- Session persists via localStorage — reps stay logged in until they sign out or get banned

## PWA cache gotcha
After every Vercel deploy, users may need to open in incognito or clear site data to get the fresh version. The service worker caches aggressively.

## Pending / future ideas
- Account notes — sticky note on account level (not tied to a call)
- Account tags — hot/cold/new etc. for filtering
- Targets/goals — Frank sets weekly call target per rep, feed shows progress
- Layer 3 Intelligence — AI reads Supabase data and surfaces patterns (needs 3-6 months of data first)
