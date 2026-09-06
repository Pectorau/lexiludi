import { describe, expect, it } from "vitest";
import { generateDailyShareText } from "./dailyShare";

describe("partage du Jeu du jour", () => {
  it("produit un résumé sans mot-réponse ni donnée sensible", () => {
    const result = generateDailyShareText({ mode: "auction", score: 850, attemptsCount: 2, maxAttempts: 3, isSuccess: true });
    expect(result).toContain("Enchères de Lettres");
    expect(result).toContain("850 pts");
    expect(result).not.toMatch(/lemma|réponse/i);
  });
});
