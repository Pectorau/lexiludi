export const ROUND_COUNTDOWN_DURATION_MS = 3_000;

export function getRoundCountdownRemaining(startedAt: Date | string | null | undefined, now = Date.now()) {
  if (!startedAt) return 0;
  const startedAtMilliseconds = new Date(startedAt).getTime();
  if (!Number.isFinite(startedAtMilliseconds)) return 0;
  return Math.max(0, startedAtMilliseconds - now);
}
