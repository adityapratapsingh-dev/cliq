import type { AchievementBadge, StreakInfo } from "@/types/cliq";

/** A message reduced to just what streak maths needs. */
export interface StreakMessage {
  senderId: string;
  receiverId: string;
  createdAt: string;
}

/** UTC day key, e.g. "2026-10-17". Streaks roll over at UTC midnight. */
function dayKey(value: string | number | Date): string {
  const d = new Date(value);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function shiftDay(key: string, delta: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + delta);
  return dayKey(date);
}

/**
 * Consecutive-day DM streak between two users.
 *
 * A day counts when *both* users sent at least one message to each other that
 * day (an exchange). The streak stays alive while the most recent qualifying day
 * is today or yesterday, so it only breaks after a full missed day.
 */
export function computeStreak(
  messages: StreakMessage[],
  userId: string,
  partnerId: string,
  now: Date = new Date(),
): StreakInfo {
  // For each day, track whether each direction saw a message.
  const sentByMe = new Set<string>();
  const sentByThem = new Set<string>();
  for (const m of messages) {
    const key = dayKey(m.createdAt);
    if (m.senderId === userId && m.receiverId === partnerId) sentByMe.add(key);
    else if (m.senderId === partnerId && m.receiverId === userId) sentByThem.add(key);
  }

  const qualifies = (key: string) => sentByMe.has(key) && sentByThem.has(key);

  const today = dayKey(now);
  const yesterday = shiftDay(today, -1);

  let cursor: string;
  let activeToday: boolean;
  if (qualifies(today)) {
    cursor = today;
    activeToday = true;
  } else if (qualifies(yesterday)) {
    cursor = yesterday;
    activeToday = false;
  } else {
    return { days: 0, activeToday: false };
  }

  let days = 0;
  while (qualifies(cursor)) {
    days += 1;
    cursor = shiftDay(cursor, -1);
  }
  return { days, activeToday };
}

/** The full catalogue of achievement badges, in display order. */
export const BADGE_DEFS: Omit<AchievementBadge, "earned">[] = [
  {
    id: "founding",
    label: "Founding Cliq",
    emoji: "⚡",
    description: "Joined Cliq in the early days",
  },
  {
    id: "streak",
    label: "Active Streak",
    emoji: "🔥",
    description: "Has an active daily chat streak",
  },
  {
    id: "creator",
    label: "Rising Creator",
    emoji: "🚀",
    description: "Earned 5+ likes and upgrades",
  },
  {
    id: "legend",
    label: "Cliq Legend",
    emoji: "👑",
    description: "Earned a Cliq Score of 25+",
  },
];

export interface BadgeInputs {
  /** true when the account is among the first registered members. */
  founding: boolean;
  /** true when the user has at least one active DM streak. */
  hasStreak: boolean;
  /** total likes + upgrades across the user's posts. */
  creatorCount: number;
  /** likes + upgrades − dislikes − downgrades. */
  cliqScore: number;
}

/** Resolve which badges a user has earned from their real stats. */
export function buildBadges(input: BadgeInputs): AchievementBadge[] {
  const earned: Record<string, boolean> = {
    founding: input.founding,
    streak: input.hasStreak,
    creator: input.creatorCount >= 5,
    legend: input.cliqScore >= 25,
  };
  return BADGE_DEFS.map((def) => ({ ...def, earned: earned[def.id] ?? false }));
}
