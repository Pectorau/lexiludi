import { describe, expect, it } from "vitest";
import { isTacticalBidValid } from "./multiplayerDb";

describe("enchères tactiques", () => {
  it("exige une amélioration de mise dans la réserve de mana du joueur", () => {
    expect(isTacticalBidValid({ bid: 20, minimumBid: 10, currentHighestBid: 15, availableMana: 40 })).toBe(true);
    expect(isTacticalBidValid({ bid: 15, minimumBid: 10, currentHighestBid: 15, availableMana: 40 })).toBe(false);
    expect(isTacticalBidValid({ bid: 9, minimumBid: 10, currentHighestBid: 0, availableMana: 40 })).toBe(false);
    expect(isTacticalBidValid({ bid: 50, minimumBid: 10, currentHighestBid: 15, availableMana: 40 })).toBe(false);
  });
});
