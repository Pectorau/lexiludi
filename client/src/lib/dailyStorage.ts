import { z } from "zod";
import type { DailyGameStatus } from "@shared/dailyModes";

const gameStatusSchema = z.enum(["IDLE", "PLAYING", "SUBMITTING", "FINISHED"]);

export const MysteryStateSchema = z.object({
  revealedIndices: z.array(z.number().int().nonnegative()),
  revealedBonusHints: z.array(z.string()),
  attempts: z.array(z.object({ word: z.string(), outcome: z.enum(["incorrect", "correct"]), timestamp: z.number() })),
  elapsedSeconds: z.number().int().nonnegative(),
  status: gameStatusSchema,
  score: z.number().nonnegative(),
  isSuccess: z.boolean().optional(),
});

export const PyramidStateSchema = z.object({
  currentLevel: z.number().int().nonnegative(),
  solvedWords: z.array(z.string()),
  rerollUsed: z.boolean(),
  usedShuffleAid: z.boolean(),
  status: gameStatusSchema,
  score: z.number().nonnegative(),
});

export const AuctionStateSchema = z.object({
  budget: z.number().nonnegative(),
  revealedPositions: z.record(z.string(), z.string()),
  isLengthRevealed: z.boolean(),
  attemptsRemaining: z.number().int().nonnegative(),
  isBankrupt: z.boolean(),
  status: gameStatusSchema,
  score: z.number().nonnegative(),
});

export type MysteryPersistedState = z.infer<typeof MysteryStateSchema>;
export type PyramidPersistedState = z.infer<typeof PyramidStateSchema>;
export type AuctionPersistedState = z.infer<typeof AuctionStateSchema>;
export type PersistedDailyStatus = DailyGameStatus;
export type DailyStorageScope = "daily" | "practice";

export function getUtcDayKey(date: Date = new Date()): string {
  return [date.getUTCFullYear(), String(date.getUTCMonth() + 1).padStart(2, "0"), String(date.getUTCDate()).padStart(2, "0")].join("-");
}

export function getDailyModeStorageKey(mode: "mystery" | "pyramid" | "auction", scope: DailyStorageScope = "daily", date: Date = new Date()): string {
  return `motif-daily-${scope}-${mode}-${getUtcDayKey(date)}`;
}

export function cleanOldStorageEntries(maxAgeDays = 30): void {
  if (typeof window === "undefined") return;
  const cutoff = Date.now() - maxAgeDays * 86_400_000;
  const staleKeys = Array.from({ length: window.localStorage.length }, (_, index) => window.localStorage.key(index)).filter((key): key is string => Boolean(key && key.startsWith("motif-daily-"))).filter((key) => {
    const date = key.match(/(\d{4}-\d{2}-\d{2})/)?.[1];
    return Boolean(date && Date.parse(`${date}T00:00:00Z`) < cutoff);
  });
  staleKeys.forEach((key) => window.localStorage.removeItem(key));
}
