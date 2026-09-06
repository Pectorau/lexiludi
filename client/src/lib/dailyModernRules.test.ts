import { describe, expect, it } from "vitest";
import { getAuctionLetterCost, MODERN_DAILY_MODES } from "@shared/dailyModes";
import { validateSubWordAddition } from "@/hooks/usePyramidGame";
import { getUtcDayKey } from "./dailyStorage";

describe("règles quotidiennes modernisées", () => {
  it("classe les coûts de lettres sans les révéler au préalable", () => {
    expect(getAuctionLetterCost("e")).toBe(MODERN_DAILY_MODES.auction.letterCosts.default);
    expect(getAuctionLetterCost("Q")).toBe(MODERN_DAILY_MODES.auction.letterCosts.rare);
    expect(getAuctionLetterCost("Z")).toBe(MODERN_DAILY_MODES.auction.letterCosts.elite);
  });

  it("valide une seule lettre ajoutée même après réorganisation", () => {
    expect(validateSubWordAddition("PAR", "PARE")).toBe(true);
    expect(validateSubWordAddition("PAR", "RAPE")).toBe(true);
    expect(validateSubWordAddition("PAR", "RUES")).toBe(false);
  });

  it("conserve une clé de jour UTC indépendante du fuseau local", () => {
    expect(getUtcDayKey(new Date(Date.UTC(2026, 7, 19, 23, 30, 0)))).toBe("2026-08-19");
  });
});
