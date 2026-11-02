# Afterset

Community tracklists for DJ sets. Identify tracks, vote to verify them, and track an unknown ID to get emailed when it's found. Planned home: https://afterset.hrlw.dev

## Stack
Next.js (App Router) · TypeScript · Tailwind · Postgres + Prisma 7 · Auth.js v5 · Resend

## Local dev
```bash
cp .env.example .env      # then set AUTH_SECRET (openssl rand -base64 32)
docker compose up -d      # Postgres on :5433
npx prisma migrate dev
npm run dev
```
Without `AUTH_RESEND_KEY`, emails are printed to the server console. Google/Spotify login appear automatically once their `AUTH_*_ID/SECRET` are set.

## Status (MVP)
- Email+password signup/login; magic link, Google, Spotify when configured
- Add sets via SoundCloud / YouTube / Mixcloud embeds (no audio hosting)
- Timestamped tracklists, "ID this" gaps, suggest an ID, up/down votes (3 net votes = verified)
- Track an unidentified entry; email sent when it is verified/confirmed
- Admin role can confirm entries (set `role = 'ADMIN'` on your user in the DB)

## Roadmap
Sign in with Apple (needs Apple Developer account) · Spotify/Apple Music artist import and new-mix alerts · push notifications · artist pages · reputation-weighted votes · moderation tools · iOS app with ShazamKit
