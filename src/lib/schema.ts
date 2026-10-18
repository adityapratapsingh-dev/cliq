/**
 * Runtime copy of schema.sql.
 *
 * Kept as a string array so `ensureTablesExist()` works identically on Vercel
 * (where only bundled files exist) and in tests. `schema.sql` at the repo root
 * is the canonical, human-readable copy — keep the two in sync.
 */
export const SCHEMA_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    email TEXT,
    password_hash TEXT NOT NULL,
    age INTEGER,
    bio TEXT NOT NULL DEFAULT '',
    avatar_url TEXT,
    banner_url TEXT,
    interests TEXT NOT NULL DEFAULT '[]',
    settings TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    media_url TEXT,
    flair TEXT,
    poll_data TEXT,
    pinned INTEGER NOT NULL DEFAULT 0,
    quoted_post_id TEXT,
    likes_count INTEGER NOT NULL DEFAULT 0,
    dislikes_count INTEGER NOT NULL DEFAULT 0,
    upgrades_count INTEGER NOT NULL DEFAULT 0,
    downgrades_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS post_reactions (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    reaction_type TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE (post_id, user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    parent_comment_id TEXT,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS friendships (
    id TEXT PRIMARY KEY,
    requester_id TEXT NOT NULL,
    receiver_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL,
    UNIQUE (requester_id, receiver_id)
  )`,
  `CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    sender_id TEXT NOT NULL,
    receiver_id TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    media_url TEXT,
    reply_to_id TEXT,
    reactions TEXT NOT NULL DEFAULT '[]',
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    actor_id TEXT,
    kind TEXT NOT NULL,
    post_id TEXT,
    text TEXT NOT NULL DEFAULT '',
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS stories (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    media_url TEXT,
    caption TEXT NOT NULL DEFAULT '',
    bg_style TEXT NOT NULL DEFAULT 'indigo',
    views_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS story_views (
    story_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (story_id, user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    icon TEXT NOT NULL DEFAULT '💬',
    creator_id TEXT,
    is_public INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS group_members (
    group_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (group_id, user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS group_messages (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    media_url TEXT,
    reactions TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_posts_type_created ON posts (type, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_posts_user ON posts (user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_post_reactions_post ON post_reactions (post_id)`,
  `CREATE INDEX IF NOT EXISTS idx_comments_post ON comments (post_id)`,
  `CREATE INDEX IF NOT EXISTS idx_friendships_requester ON friendships (requester_id)`,
  `CREATE INDEX IF NOT EXISTS idx_friendships_receiver ON friendships (receiver_id)`,
  `CREATE INDEX IF NOT EXISTS idx_messages_pair ON messages (sender_id, receiver_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages (receiver_id, is_read)`,
  `CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id, is_read, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_stories_created ON stories (created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_group_messages_group ON group_messages (group_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members (user_id)`,
];
