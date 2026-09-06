export const HINT_TYPES = ["vowels", "borders", "theme", "free_consonant"] as const;
export type HintType = (typeof HINT_TYPES)[number];

export type DailyGameStatus = "IDLE" | "PLAYING" | "SUBMITTING" | "FINISHED";

export const MODERN_DAILY_MODES = {
  mystery: {
    id: "mystery",
    label: "Mot Mystère",
    initialScore: 1000,
    penaltyPerSecond: 2,
    penaltyPerWrongGuess: 10,
    manualRevealCost: 25,
    bonusHintCost: 50,
    intuitionBonusThreshold: 0.3,
    intuitionBonusMultiplier: 1.5,
  },
  pyramid: {
    id: "pyramid",
    label: "Pyramide de Lettres",
    minWordLength: 3,
    maxWordLength: 8,
    chainBonusWithoutShuffle: 20,
  },
  auction: {
    id: "auction",
    label: "Mode Enchères",
    startingCapital: 100,
    wordLengthCost: 5,
    letterCosts: { default: 5, rare: 10, elite: 15 },
  },
} as const;

export function getAuctionLetterCost(letter: string): number {
  const upper = letter.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  if (["W", "X", "Y", "Z"].includes(upper)) return MODERN_DAILY_MODES.auction.letterCosts.elite;
  if (["J", "Q", "K", "V", "B", "C", "P"].includes(upper)) return MODERN_DAILY_MODES.auction.letterCosts.rare;
  return MODERN_DAILY_MODES.auction.letterCosts.default;
}
