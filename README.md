# IA Management Platform

Next.js internal audit workflow app with optional live-data mode backed by Supabase.

## Deploy To Vercel

1. Import this GitHub repository into Vercel as a `Next.js` project.
2. In Vercel project settings, add these environment variables for `Production` and `Preview`:
   - `SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Do not set `SUPABASE_TLS_INSECURE` in Vercel. That flag is for local development only and the app now rejects it in production.
4. Deploy after the hosted Supabase project is ready and your schema has been applied.

## Configure Supabase

Use a dedicated hosted Supabase project for the deployed app.

Required setup outside this repo:
- Create the hosted project.
- Apply the SQL migrations in `supabase/migrations`.
- Load only demo or otherwise low-risk data if you plan to share the URL without user login.
- Keep the `service role` key only in Vercel server-side environment variables.

If you later enable Supabase Auth:
- Set the Supabase Auth `Site URL` to your Vercel production domain.
- Add Vercel preview and production callback URLs to the allowed redirect list.

## Current Access Model

Important: the current live-data implementation is server-driven and uses the Supabase `service role` key for many reads and writes.

That means:
- the app does not yet enforce end-user sign-in for live mode
- live API routes should be treated as privileged server operations
- anyone you share the live URL with should be treated as having broad access to the demo dataset exposed by the app

This is acceptable only for low-risk demo data. It is not a production-grade authorization model for sensitive audit data.

## Verify After Deploy

Before sharing the Vercel URL:
- confirm the site builds successfully on Vercel
- open a live-mode URL with a valid `auditId`
- verify reads succeed from hosted Supabase
- perform a write action and refresh to confirm persistence
- confirm no client-side code exposes `SUPABASE_SERVICE_ROLE_KEY`

## Local Development

Create `.env.local` with the same keys shown in `.env.example`.

`SUPABASE_TLS_INSECURE=true` is allowed only for local development when required by a corporate TLS interception setup.
