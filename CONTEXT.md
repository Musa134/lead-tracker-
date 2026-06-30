# Colour X — Client Context

## Who they are
Colour X is a paint retail store. Frank is the owner and primary contact. He reviews activity on desktop. The reps log their calls and leads on their phones.

## What's been built
Two tools in one app, live on Vercel:

**Lead Tracker** — Reps log new customer leads, add comments, update status, and filter by rep. Mobile-first, installable as a PWA on iOS and Android.

**CRM** — Reps log their sales calls daily. Frank gets a weekly email summary of all rep activity. Frank reviews the CRM feed on desktop.

## Reps
| Name  | Email                        |
|-------|------------------------------|
| Ralph | ralph@colourx.ca             |
| Shane | shane@colourx.ca             |
| Rob   | robert@colourx.ca            |
| Frank | frank@colourx.ca             |
| Jeff  | jeff@colourx.ca              |
| Musa  | musa.nizam@benjaminmoore.com |

## Current status
Live and actively used. Frank is the main reviewer. Jeff added 2026-06-30.

## What good work looks like
- Reps log on mobile — that experience must stay fast and simple
- Frank reviews on desktop — tables and summaries need to be readable on a bigger screen
- Changes go live by pushing to GitHub (Vercel auto-deploys)

## What to avoid
- Don't add features that weren't asked for
- Don't break the mobile logging flow for desktop improvements
- Don't touch .env.local or commit Supabase keys
