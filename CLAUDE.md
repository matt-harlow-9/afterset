# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

Afterset is a community-curated archive of electronic music sets with timestamped tracklists. See `README.md` for the vision and MVP scope.

## Hard rules

1. **Embed, never host.** Play sets only through official embeds (YouTube IFrame API, SoundCloud Widget API). Do not store, proxy, or re-serve third-party audio or video.
2. **No user-uploaded media in v1.** It is a copyright risk and is explicitly out of MVP scope.
3. **Do not scrape other tracklist sites.** No scraping of 1001Tracklists or similar. Data comes from our own contributors and from licensed or open metadata sources (MusicBrainz, Discogs).
4. **Do not add features outside MVP scope** without asking first.

## Data model

Two hierarchies meet at `sets`.

**Festival hierarchy** (powers "EDC Las Vegas 2026 -> Kinetic Field -> house"):

```
events -> editions -> stages -> slots -> sets
```

- `events`: the recurring brand (EDC Las Vegas, Ultra Miami).
- `editions`: one year or instance of an event (EDC Las Vegas 2026).
- `stages`: a stage within an edition.
- `slots`: a scheduled performance window on a stage.
- `sets`: a recorded performance, which may or may not be tied to a slot (club sets and radio shows have no slot).

**Tracklist hierarchy:**

```
sets -> set_sources (each with time_offset_seconds)
sets -> track_entries -> tracks -> artists
```

- `set_sources`: a playable source (YouTube, SoundCloud) for a set. `time_offset_seconds` shifts the tracklist onto that source's timeline, since a rip or livestream may have a different intro length. Track entry timestamps are stored relative to the set itself, never relative to a source.
- `track_entries`: "this track played at this second of this set", with contributor, status, and confidence.
- `track_entry_votes`: community confirmation or dispute of an entry.
- `tracks`: canonical tracks. Dedupe versions ("Original Mix" vs "Extended Mix") using `version` and `canonical_track_id`, not duplicate rows. An unreleased track is a track with `is_id = true` until identified.

**Genre** attaches to tracks and artists, not to sets. A set's genres are derived from the tracks played, because DJ-level genre tags are too coarse for filtering.

## Conventions

- Timestamps are integer seconds from set start (`position_seconds`).
- Primary keys are UUIDs. Every table has `created_at`; mutable tables have `updated_at`.
- Slugs are unique within their parent and used in URLs (`/e/edc-las-vegas/2026/kinetic-field`).
- Schema changes go in `db/migrations/` as numbered SQL files. `db/schema.sql` is the current full snapshot.
- TypeScript strict mode. Prefer server components; keep player logic in client components.

## Commands

Local database (from the repo root):

```
docker compose up -d        # Postgres 16; loads db/migrations on first start
docker compose down -v      # wipe the volume so the schema is re-applied
```

Web app (from `apps/web`):

```
cp ../../.env.example .env.local
npm install
npm run dev                 # http://localhost:3000, health check at /api/health
npm run lint
npm run build
```

## Next.js notes

`apps/web` uses Next.js 16 (App Router, Turbopack, Cache Components enabled), which differs from older versions. Check the bundled docs in `apps/web/node_modules/next/dist/docs/` before writing framework-level code.

`next/font/google` fetches fonts at build time, so `npm run build` needs outbound network access to fonts.googleapis.com.
