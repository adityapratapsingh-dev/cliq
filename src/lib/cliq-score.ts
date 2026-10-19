import type { Post } from "@/types/cliq";

/**
 * Cliq Score — a gamified activity score.
 *
 * Weights are intentionally small and legible so the breakdown modal can explain
 * exactly where the number came from:
 *
 *   +10 per post published
 *   +5  per friend (accepted Cliq Up)
 *   +2  per like / upgrade received
 *   +3  for having a live 24-hour Note
 *
 * Points are derived from real data (posts, friendships, note) rather than a
 * stored counter, so the number can never drift out of sync.
 */

export const SCORE_WEIGHTS = {
  post: 10,
  friend: 5,
  engagement: 2,
  note: 3,
} as const;

export interface ScoreTier {
  name: string;
  emoji: string;
  /** Score at which this tier begins. */
  min: number;
  blurb: string;
}

export const SCORE_TIERS: ScoreTier[] = [
  { name: "Newcomer", emoji: "🌱", min: 0, blurb: "Just landed on Cliq" },
  { name: "Spark", emoji: "✨", min: 50, blurb: "Finding your vibe" },
  { name: "Vibe Maker", emoji: "⚡", min: 200, blurb: "People are noticing" },
  { name: "Trend Setter", emoji: "🔥", min: 500, blurb: "Your posts move the feed" },
  { name: "Cliq Legend", emoji: "👑", min: 1200, blurb: "Certified Cliq royalty" },
];

export interface ScoreBreakdown {
  total: number;
  posts: { count: number; points: number };
  friends: { count: number; points: number };
  engagement: { count: number; points: number };
  note: { active: boolean; points: number };
  tier: ScoreTier;
  nextTier: ScoreTier | null;
  /** 0-100 progress toward the next tier. */
  progress: number;
  /** Points still needed for the next tier. */
  toNext: number;
}

export function tierFor(score: number): ScoreTier {
  let current = SCORE_TIERS[0];
  for (const tier of SCORE_TIERS) if (score >= tier.min) current = tier;
  return current;
}

export function computeScore(params: {
  posts: Post[];
  friends: number;
  hasNote: boolean;
}): ScoreBreakdown {
  const { posts, friends, hasNote } = params;

  const postPoints = posts.length * SCORE_WEIGHTS.post;
  const friendPoints = friends * SCORE_WEIGHTS.friend;

  // Engagement received = likes + upgrades - dislikes - downgrades across my posts.
  const engagementCount = posts.reduce(
    (sum, p) => sum + p.likesCount + p.upgradesCount - p.dislikesCount - p.downgradesCount,
    0,
  );
  const engagementPoints = Math.max(0, engagementCount) * SCORE_WEIGHTS.engagement;
  const notePoints = hasNote ? SCORE_WEIGHTS.note : 0;

  const total = postPoints + friendPoints + engagementPoints + notePoints;

  const tier = tierFor(total);
  const nextTier = SCORE_TIERS.find((t) => t.min > total) ?? null;
  const span = nextTier ? nextTier.min - tier.min : 0;
  const progress = nextTier && span > 0 ? Math.min(100, Math.round(((total - tier.min) / span) * 100)) : 100;

  return {
    total,
    posts: { count: posts.length, points: postPoints },
    friends: { count: friends, points: friendPoints },
    engagement: { count: Math.max(0, engagementCount), points: engagementPoints },
    note: { active: hasNote, points: notePoints },
    tier,
    nextTier,
    progress,
    toNext: nextTier ? Math.max(0, nextTier.min - total) : 0,
  };
}
