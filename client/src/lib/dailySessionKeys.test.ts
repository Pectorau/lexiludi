import { describe, expect, it } from "vitest";
import { getDailyModeStorageKey } from "./dailyStorage";

describe("clés des sessions du Jeu du jour", () => {
  it("isole une partie quotidienne de son entraînement du même jour", () => {
    const day = new Date(Date.UTC(2026, 7, 19));
    const daily = getDailyModeStorageKey("auction", "daily", day);
    const practice = getDailyModeStorageKey("auction", "practice", day);
    expect(daily).toBe("motif-daily-daily-auction-2026-08-19");
    expect(practice).toBe("motif-daily-practice-auction-2026-08-19");
    expect(practice).not.toBe(daily);
  });
});
