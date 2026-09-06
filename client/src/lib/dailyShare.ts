import { getUtcDayKey } from "@/lib/dailyStorage";

export type DailySharePayload = { mode: "mystery" | "pyramid" | "auction"; score: number; attemptsCount: number; maxAttempts: number; isSuccess: boolean };

export function generateDailyShareText(payload: DailySharePayload): string {
  const label = payload.mode === "mystery" ? "Mot Mystère" : payload.mode === "pyramid" ? "Pyramide de Lettres" : "Enchères de Lettres";
  const result = payload.isSuccess ? `${payload.score} pts` : "Défi non terminé";
  const grid = payload.mode === "mystery" ? "■ ■ ■" : payload.mode === "pyramid" ? "▲\n▲ ▲\n▲ ▲ ▲" : "● ● ●";
  return `motif. · ${label}\nDéfi du ${getUtcDayKey()}\nRésultat : ${result} (${payload.attemptsCount}/${payload.maxAttempts})\n\n${grid}`;
}

export async function shareDailyResult(payload: DailySharePayload): Promise<"shared" | "copied" | "unavailable"> {
  const text = generateDailyShareText(payload);
  if (typeof navigator !== "undefined" && navigator.share) {
    try { await navigator.share({ title: "Mon résultat motif.", text }); return "shared"; }
    catch (error) { if (error instanceof DOMException && error.name === "AbortError") return "unavailable"; }
  }
  if (typeof navigator !== "undefined" && navigator.clipboard) { await navigator.clipboard.writeText(text); return "copied"; }
  return "unavailable";
}
