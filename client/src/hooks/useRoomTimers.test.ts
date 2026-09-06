import { describe, expect, it } from "vitest";
import { getRoomTimerSnapshot } from "./useRoomTimers";

describe("getRoomTimerSnapshot", () => {
  it("n’affiche jamais de minuterie négative après une échéance", () => {
    const now = Date.UTC(2026, 7, 21, 12, 0, 0);
    const snapshot = getRoomTimerSnapshot({ status: "active", endsAt: new Date(now - 1_000) }, now);
    expect(snapshot.timerMilliseconds).toBe(0);
  });

  it("conserve la durée de jeu complète après le décompte de préparation", () => {
    const now = Date.UTC(2026, 7, 21, 12, 0, 0);
    const snapshot = getRoomTimerSnapshot({ status: "active", startedAt: new Date(now + 3_000), endsAt: new Date(now + 63_000) }, now);
    expect(snapshot.countdownMilliseconds).toBe(3_000);
    expect(snapshot.timerMilliseconds).toBe(60_000);
  });
});
