/**
 * Runtime copy of schema.postgres.sql.
 *
 * Kept as an array so `ensureTablesExist()` works on Vercel, where only bundled
 * files exist. `schema.postgres.sql` at the repo root is the canonical,
 * human-readable copy — keep the two in sync when changing columns.
 */
export const SCHEMA_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS users (
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
  )`,
  `CREATE TABLE IF NOT EXISTS posts (
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
  )`,
  `CREATE TABLE IF NOT EXISTS post_reactions (
    id            TEXT PRIMARY KEY,
    post_id       TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reaction_type TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (post_id, user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS comments (
    id                TEXT PRIMARY KEY,
    post_id           TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_comment_id TEXT,
    content           TEXT NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS friendships (
    id           TEXT PRIMARY KEY,
    requester_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status       TEXT NOT NULL DEFAULT 'pending',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (requester_id, receiver_id)
  )`,
  `CREATE TABLE IF NOT EXISTS messages (
    id          TEXT PRIMARY KEY,
    sender_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content     TEXT NOT NULL DEFAULT '',
    media_url   TEXT,
    reply_to_id TEXT,
    reactions   JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_read     BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS notifications (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    actor_id   TEXT REFERENCES users(id) ON DELETE CASCADE,
    kind       TEXT NOT NULL,
    post_id    TEXT,
    text       TEXT NOT NULL DEFAULT '',
    is_read    BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_posts_type_created    ON posts (type, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_posts_user            ON posts (user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_post_reactions_post   ON post_reactions (post_id)`,
  `CREATE INDEX IF NOT EXISTS idx_comments_post         ON comments (post_id)`,
  `CREATE INDEX IF NOT EXISTS idx_friendships_requester ON friendships (requester_id)`,
  `CREATE INDEX IF NOT EXISTS idx_friendships_receiver  ON friendships (receiver_id)`,
  `CREATE INDEX IF NOT EXISTS idx_messages_pair         ON messages (sender_id, receiver_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_messages_receiver     ON messages (receiver_id, is_read)`,
  `CREATE INDEX IF NOT EXISTS idx_notifications_user    ON notifications (user_id, is_read, created_at DESC)`,
];
