import { describe, expect, it } from "vitest";
import { getAuctionLetterCost, MODERN_DAILY_MODES } from "./dailyModes";

describe("coûts du mode Enchères", () => {
  it("distingue les lettres ordinaires, rares et élites", () => {
    expect(getAuctionLetterCost("A")).toBe(MODERN_DAILY_MODES.auction.letterCosts.default);
    expect(getAuctionLetterCost("Q")).toBe(MODERN_DAILY_MODES.auction.letterCosts.rare);
    expect(getAuctionLetterCost("Z")).toBe(MODERN_DAILY_MODES.auction.letterCosts.elite);
  });
});
