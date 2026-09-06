import { describe, expect, it } from "vitest";
import { ROUND_COUNTDOWN_DURATION_MS, getRoundCountdownRemaining } from "./roundCountdown";

describe("décompte de manche", () => {
  it("compte les trois secondes de préparation définies par le départ futur du serveur", () => {
    expect(getRoundCountdownRemaining(new Date(10_000 + ROUND_COUNTDOWN_DURATION_MS), 10_000)).toBe(ROUND_COUNTDOWN_DURATION_MS);
    expect(getRoundCountdownRemaining(new Date(10_000 + ROUND_COUNTDOWN_DURATION_MS), 11_750)).toBe(1_250);
  });

  it("ne renvoie jamais une durée négative ni une valeur pour une date invalide", () => {
    expect(getRoundCountdownRemaining(new Date(10_000), 14_000)).toBe(0);
    expect(getRoundCountdownRemaining("invalide", 10_000)).toBe(0);
  });
});
