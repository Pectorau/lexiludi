import { describe, expect, it } from "vitest";
import { gameQuickGuides } from "./gameRules";

describe("fiches d’accueil des jeux", () => {
  it("résume les trois jeux en trois étapes claires", () => {
    expect(Object.keys(gameQuickGuides)).toEqual(["quiz", "motus", "definition"]);
    Object.values(gameQuickGuides).forEach((guide) => {
      expect(guide.steps).toHaveLength(3);
      expect(guide.goal.length).toBeGreaterThan(15);
      expect(guide.jokerInstruction).toContain("salon");
    });
  });

  it("présente les jokers qui distinguent chaque mode", () => {
    expect(gameQuickGuides.quiz.jokers.map((joker) => joker.name)).toEqual(expect.arrayContaining(["Tempo", "Brouillard"]));
    expect(gameQuickGuides.motus.jokers.map((joker) => joker.name)).toEqual(expect.arrayContaining(["Lettre placée", "Radar"]));
    expect(gameQuickGuides.definition.jokers.map((joker) => joker.name)).toEqual(expect.arrayContaining(["Boussole", "Aperçu"]));
  });
});
