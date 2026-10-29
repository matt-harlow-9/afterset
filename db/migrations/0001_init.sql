-- Afterset initial schema (PostgreSQL 13+)
-- Timestamps inside sets are integer seconds from set start (position_seconds).

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS citext;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

CREATE TYPE user_role AS ENUM ('user', 'moderator', 'admin');
CREATE TYPE source_platform AS ENUM ('youtube', 'soundcloud');
CREATE TYPE track_artist_role AS ENUM ('main', 'remixer', 'featured');
CREATE TYPE entry_status AS ENUM ('proposed', 'confirmed', 'disputed', 'rejected');
CREATE TYPE flag_status AS ENUM ('open', 'resolved', 'dismissed');

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- Users
-- ---------------------------------------------------------------------------

CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username      citext NOT NULL UNIQUE,
  email         citext NOT NULL UNIQUE,
  display_name  text,
  role          user_role NOT NULL DEFAULT 'user',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Artists and genres
-- ---------------------------------------------------------------------------

CREATE TABLE artists (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  slug            text NOT NULL UNIQUE,
  musicbrainz_id  uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE genres (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text NOT NULL UNIQUE,
  parent_id   uuid REFERENCES genres (id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE artist_genres (
  artist_id  uuid NOT NULL REFERENCES artists (id) ON DELETE CASCADE,
  genre_id   uuid NOT NULL REFERENCES genres (id) ON DELETE CASCADE,
  PRIMARY KEY (artist_id, genre_id)
);

-- ---------------------------------------------------------------------------
-- Festival hierarchy: events -> editions -> stages -> slots -> sets
-- ---------------------------------------------------------------------------

CREATE TABLE events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  slug         text NOT NULL UNIQUE,
  description  text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE editions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  name        text NOT NULL,
  slug        text NOT NULL,
  year        integer NOT NULL CHECK (year BETWEEN 1970 AND 2100),
  start_date  date,
  end_date    date,
  location    text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, slug),
  CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);

CREATE TABLE stages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id  uuid NOT NULL REFERENCES editions (id) ON DELETE CASCADE,
  name        text NOT NULL,
  slug        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (edition_id, slug)
);

CREATE TABLE slots (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id   uuid NOT NULL REFERENCES stages (id) ON DELETE CASCADE,
  starts_at  timestamptz,
  ends_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
);

-- ---------------------------------------------------------------------------
-- Sets and sources
-- ---------------------------------------------------------------------------

CREATE TABLE sets (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title             text NOT NULL,
  slug              text NOT NULL UNIQUE,
  slot_id           uuid REFERENCES slots (id) ON DELETE SET NULL,  -- NULL for club sets, radio shows, etc.
  performed_on      date,
  duration_seconds  integer CHECK (duration_seconds IS NULL OR duration_seconds > 0),
  description       text,
  created_by        uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE set_artists (
  set_id     uuid NOT NULL REFERENCES sets (id) ON DELETE CASCADE,
  artist_id  uuid NOT NULL REFERENCES artists (id) ON DELETE CASCADE,
  position   smallint NOT NULL DEFAULT 0,
  PRIMARY KEY (set_id, artist_id)
);

-- A playable source for a set. Embed only; we never host media.
-- time_offset_seconds shifts the set's tracklist onto this source's timeline:
--   source_time = position_seconds + time_offset_seconds
CREATE TABLE set_sources (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id                uuid NOT NULL REFERENCES sets (id) ON DELETE CASCADE,
  platform              source_platform NOT NULL,
  external_id           text NOT NULL,
  url                   text NOT NULL,
  time_offset_seconds   integer NOT NULL DEFAULT 0,
  is_primary            boolean NOT NULL DEFAULT false,
  added_by              uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (set_id, platform, external_id)
);

-- At most one primary source per set.
CREATE UNIQUE INDEX set_sources_one_primary_idx
  ON set_sources (set_id) WHERE is_primary;

-- ---------------------------------------------------------------------------
-- Tracks
-- ---------------------------------------------------------------------------

CREATE TABLE tracks (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title               text NOT NULL,
  version             text,                       -- 'Original Mix', 'Extended Mix', 'X Remix'
  is_id               boolean NOT NULL DEFAULT false,  -- unreleased / unidentified ("ID")
  canonical_track_id  uuid REFERENCES tracks (id) ON DELETE SET NULL,  -- version dedupe
  label               text,
  release_date        date,
  musicbrainz_id      uuid,
  discogs_id          text,
  beatport_id         text,
  created_by          uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CHECK (canonical_track_id IS NULL OR canonical_track_id <> id)
);

CREATE TABLE track_artists (
  track_id   uuid NOT NULL REFERENCES tracks (id) ON DELETE CASCADE,
  artist_id  uuid NOT NULL REFERENCES artists (id) ON DELETE CASCADE,
  role       track_artist_role NOT NULL DEFAULT 'main',
  position   smallint NOT NULL DEFAULT 0,
  PRIMARY KEY (track_id, artist_id, role)
);

CREATE TABLE track_genres (
  track_id  uuid NOT NULL REFERENCES tracks (id) ON DELETE CASCADE,
  genre_id  uuid NOT NULL REFERENCES genres (id) ON DELETE CASCADE,
  PRIMARY KEY (track_id, genre_id)
);

-- ---------------------------------------------------------------------------
-- Tracklist entries and community voting
-- ---------------------------------------------------------------------------

-- "This track played at this second of this set." Several competing entries
-- may exist for the same moment until the community settles on one.
CREATE TABLE track_entries (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id            uuid NOT NULL REFERENCES sets (id) ON DELETE CASCADE,
  track_id          uuid NOT NULL REFERENCES tracks (id) ON DELETE RESTRICT,
  position_seconds  integer NOT NULL CHECK (position_seconds >= 0),
  status            entry_status NOT NULL DEFAULT 'proposed',
  score             integer NOT NULL DEFAULT 0,   -- denormalized sum of votes
  note              text,
  contributor_id    uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (set_id, position_seconds, track_id)
);

CREATE TABLE track_entry_votes (
  entry_id    uuid NOT NULL REFERENCES track_entries (id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  vote        smallint NOT NULL CHECK (vote IN (-1, 1)),
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (entry_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Moderation
-- ---------------------------------------------------------------------------

CREATE TABLE flags (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type  text NOT NULL CHECK (target_type IN ('set', 'set_source', 'track_entry', 'track', 'artist')),
  target_id    uuid NOT NULL,
  reason       text NOT NULL,
  status       flag_status NOT NULL DEFAULT 'open',
  flagged_by   uuid REFERENCES users (id) ON DELETE SET NULL,
  resolved_by  uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  resolved_at  timestamptz
);

CREATE TABLE edit_log (
  id           bigserial PRIMARY KEY,
  entity_type  text NOT NULL,
  entity_id    uuid NOT NULL,
  user_id      uuid REFERENCES users (id) ON DELETE SET NULL,
  changes      jsonb NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Derived data: genres of a set come from the tracks played in it
-- ---------------------------------------------------------------------------

CREATE VIEW set_genres AS
SELECT te.set_id,
       tg.genre_id,
       count(*) AS track_count
FROM track_entries te
JOIN track_genres tg ON tg.track_id = te.track_id
WHERE te.status <> 'rejected'
GROUP BY te.set_id, tg.genre_id;

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX editions_event_idx        ON editions (event_id);
CREATE INDEX stages_edition_idx        ON stages (edition_id);
CREATE INDEX slots_stage_idx           ON slots (stage_id);
CREATE INDEX sets_slot_idx             ON sets (slot_id);
CREATE INDEX set_artists_artist_idx    ON set_artists (artist_id);
CREATE INDEX set_sources_set_idx       ON set_sources (set_id);
CREATE INDEX track_artists_artist_idx  ON track_artists (artist_id);
CREATE INDEX track_genres_genre_idx    ON track_genres (genre_id);
CREATE INDEX artist_genres_genre_idx   ON artist_genres (genre_id);
CREATE INDEX track_entries_set_pos_idx ON track_entries (set_id, position_seconds);
CREATE INDEX track_entries_track_idx   ON track_entries (track_id);
CREATE INDEX flags_open_idx            ON flags (target_type, target_id) WHERE status = 'open';
CREATE INDEX edit_log_entity_idx       ON edit_log (entity_type, entity_id);

CREATE INDEX artists_name_trgm_idx ON artists USING gin (name gin_trgm_ops);
CREATE INDEX tracks_title_trgm_idx ON tracks  USING gin (title gin_trgm_ops);
CREATE INDEX sets_title_trgm_idx   ON sets    USING gin (title gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

CREATE TRIGGER users_updated_at         BEFORE UPDATE ON users         FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER artists_updated_at       BEFORE UPDATE ON artists       FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER events_updated_at        BEFORE UPDATE ON events        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER editions_updated_at      BEFORE UPDATE ON editions      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER sets_updated_at          BEFORE UPDATE ON sets          FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER tracks_updated_at        BEFORE UPDATE ON tracks        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER track_entries_updated_at BEFORE UPDATE ON track_entries FOR EACH ROW EXECUTE FUNCTION set_updated_at();
