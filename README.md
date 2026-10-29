# Afterset

A community-built archive of electronic music sets. Users post sets from wherever they live (YouTube, SoundCloud, and more later), identify tracks at specific timestamps, and browse by artist, genre, festival, and stage.

> That track at 42:10 in the sunrise set at EDC. What was it? Afterset is where you find out.

## Why

Existing tracklist sites are dated, ad-heavy, weak on mobile, and thin on festival browsing. Afterset aims to be:

- **Festival-first.** Drill from an event edition (e.g. EDC Las Vegas 2026) to a stage, then filter by genre, and see what was played.
- **Timestamp-native.** Every track is pinned to a moment in the set, and you can jump to it while the set plays.
- **Easy to contribute to.** A "tag this moment" button while you listen, so identifying a track takes seconds.
- **Source-agnostic.** One set can have several playable sources (YouTube rip, SoundCloud upload, livestream), each aligned to the same tracklist by a time offset.

## MVP scope

In:
- Sets with YouTube and SoundCloud sources (embedded players only)
- Manual timestamp entry and a player-synced "tag this moment" flow
- Track identification with confidence and voting, including unreleased "ID" tracks
- Filters: artist, genre, event, edition, stage
- Basic moderation (flagging, edit history)
- Accounts and contributor attribution

Out for now:
- User-uploaded audio or video (copyright and DMCA risk)
- Apple Music / Spotify sources
- Audio fingerprinting
- Native mobile apps (the web app should be mobile-first instead)

## Stack

- **Web:** Next.js (App Router) + TypeScript
- **Database:** PostgreSQL
- **Search:** Postgres full-text and trigram search at first; Meilisearch if and when it is needed
- **Players:** YouTube IFrame API, SoundCloud Widget API

## Repo layout

```
apps/web/           Next.js application
db/migrations/      Numbered SQL migrations
db/schema.sql       Current full schema snapshot
docker-compose.yml  Local Postgres
docs/               Design notes
```

## Getting started

```
docker compose up -d
cd apps/web
cp ../../.env.example .env.local
npm install
npm run dev
```

Then open http://localhost:3000. `/api/health` reports whether the app can reach the database.

## Status

Early development. The app is a placeholder page plus a health check; the data model lives in `db/schema.sql` and is described in `CLAUDE.md`.
