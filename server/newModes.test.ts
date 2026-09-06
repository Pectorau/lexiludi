import { describe, expect, it } from "vitest";
import { canUsePlannedJoker, plannedJokerRules, plannedModeRules } from "./newModes";

describe("cadrage des nouveaux modes", () => {
  it("décrit les données et le score de chaque mode sans ambiguïté", () => {
    expect(Object.keys(plannedModeRules)).toEqual(["mystery", "pyramid", "auction"]);
    expect(plannedModeRules.mystery.roundData).toContain("definitionTokens");
    expect(plannedModeRules.pyramid.roundData).toContain("validatedSteps");
    expect(plannedModeRules.auction.roundData).toContain("purchasedHints");
  });

  it("protège les règles serveur des nouveaux jokers", () => {
    expect(canUsePlannedJoker({ joker: "time_freeze", roundDurationSeconds: 0, alreadyUsed: false })).toBe(false);
    expect(canUsePlannedJoker({ joker: "double_stake", roundDurationSeconds: 75, alreadyUsed: true })).toBe(false);
    expect(canUsePlannedJoker({ joker: "pruning", roundDurationSeconds: 75, alreadyUsed: false })).toBe(true);
    expect(plannedJokerRules.perfect_parade.effect).toContain("six secondes");
  });
});
