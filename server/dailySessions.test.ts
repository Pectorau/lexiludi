import { describe, expect, it } from "vitest";
import { AuctionRules, calculateAuctionSlotCost, getAuctionRevealLimit } from "../shared/auctionRules";

describe("règles quotidiennes Enchères", () => {
  it("applique les coûts progressifs finançables par le budget de départ", () => {
    expect(AuctionRules.startingBudget).toBe(100);
    expect([0, 1, 2].map(calculateAuctionSlotCost)).toEqual([20, 35, 45]);
    expect([0, 1, 2].map(calculateAuctionSlotCost).reduce((total, cost) => total + cost, 0)).toBe(100);
  });

  it("limite les révélations directes à quarante pour cent du mot", () => {
    expect(getAuctionRevealLimit(8)).toBe(3);
    expect(getAuctionRevealLimit(6)).toBe(2);
  });

  it("conserve une pénalité de tentative indépendante des achats", () => {
    expect(AuctionRules.penalties.wrongAttempt).toBe(15);
    expect(AuctionRules.maxAttempts).toBe(3);
  });
});
