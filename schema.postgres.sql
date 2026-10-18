-- Cliq database schema (Neon PostgreSQL).
-- Executed automatically at runtime by ensureTablesExist() in src/lib/neon-schema.ts.
-- Safe to run repeatedly: every statement is IF NOT EXISTS.
--
-- You can also apply this manually with:
--   psql "$DATABASE_URL" -f schema.postgres.sql

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  display_name  TEXT NOT NULL,
  email         TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  age           INTEGER,
  bio           TEXT NOT NULL DEFAULT '',
  avatar_url    TEXT,
  banner_url    TEXT,
  interests     JSONB NOT NULL DEFAULT '[]'::jsonb,
  settings      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS posts (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type             TEXT NOT NULL,
  content          TEXT NOT NULL DEFAULT '',
  media_url        TEXT,
  flair            TEXT,
  poll_data        JSONB,
  likes_count      INTEGER NOT NULL DEFAULT 0,
  dislikes_count   INTEGER NOT NULL DEFAULT 0,
  upgrades_count   INTEGER NOT NULL DEFAULT 0,
  downgrades_count INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS post_reactions (
  id            TEXT PRIMARY KEY,
  post_id       TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS comments (
  id                TEXT PRIMARY KEY,
  post_id           TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_comment_id TEXT,
  content           TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS friendships (
  id           TEXT PRIMARY KEY,
  requester_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'pending',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (requester_id, receiver_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id          TEXT PRIMARY KEY,
  sender_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content     TEXT NOT NULL DEFAULT '',
  media_url   TEXT,
  reply_to_id TEXT,
  reactions   JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_read     BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id     TEXT REFERENCES users(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL,
  post_id      TEXT,
  text         TEXT NOT NULL DEFAULT '',
  is_read      BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Post controls: pin-to-profile and quote reposts. Added via ALTER so existing
-- deployments pick the columns up without a manual migration.
ALTER TABLE posts ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS quoted_post_id TEXT;

-- 24-hour Cliq Stories. Rows older than 24h are filtered out on read.
CREATE TABLE IF NOT EXISTS stories (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  media_url   TEXT,
  caption     TEXT NOT NULL DEFAULT '',
  bg_style    TEXT NOT NULL DEFAULT 'indigo',
  views_count INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Who has viewed a story, so rings turn grey once seen.
CREATE TABLE IF NOT EXISTS story_views (
  story_id   TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, user_id)
);

-- Group Cliqs: public interest lounges and custom group chats.
CREATE TABLE IF NOT EXISTS groups (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  icon        TEXT NOT NULL DEFAULT '💬',
  creator_id  TEXT REFERENCES users(id) ON DELETE SET NULL,
  is_public   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS group_members (
  group_id   TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS group_messages (
  id         TEXT PRIMARY KEY,
  group_id   TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  sender_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content    TEXT NOT NULL DEFAULT '',
  media_url  TEXT,
  reactions  JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for the access patterns the API actually uses.
CREATE INDEX IF NOT EXISTS idx_posts_type_created    ON posts (type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_user            ON posts (user_id);
CREATE INDEX IF NOT EXISTS idx_post_reactions_post   ON post_reactions (post_id);
CREATE INDEX IF NOT EXISTS idx_comments_post         ON comments (post_id);
CREATE INDEX IF NOT EXISTS idx_friendships_requester ON friendships (requester_id);
CREATE INDEX IF NOT EXISTS idx_friendships_receiver  ON friendships (receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_pair         ON messages (sender_id, receiver_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_receiver     ON messages (receiver_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_user    ON notifications (user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stories_created       ON stories (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stories_user          ON stories (user_id);
CREATE INDEX IF NOT EXISTS idx_group_messages_group  ON group_messages (group_id, created_at);
CREATE INDEX IF NOT EXISTS idx_group_members_user    ON group_members (user_id);
