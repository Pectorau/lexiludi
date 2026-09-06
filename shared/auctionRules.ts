export const AuctionRules = {
  startingBudget: 100,
  minWordLength: 6,
  maxRevealRatio: 0.4,
  costs: {
    revealLength: 10,
    vowelCount: 15,
    consonantPattern: 20,
    letterSlotBase: 20,
    letterSlotCosts: [20, 35, 45],
  },
  penalties: { wrongAttempt: 15 },
  maxAttempts: 3,
} as const;

export type AuctionClue = "length" | "vowel_count" | "pattern";
export type AuctionStatus = "PLAYING" | "BANKRUPT_LAST_CHANCE" | "WON" | "LOST";

export function calculateAuctionSlotCost(alreadyBoughtCount: number): number {
  return AuctionRules.costs.letterSlotCosts[alreadyBoughtCount] ?? Number.POSITIVE_INFINITY;
}

export function getAuctionRevealLimit(wordLength: number): number {
  return Math.max(1, Math.floor(wordLength * AuctionRules.maxRevealRatio));
}
