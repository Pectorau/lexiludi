import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";

describe("contrats sécurisés des défis sémantiques solo", () => {
  const procedures = appRouter._def.procedures;

  it("expose les démarrages, corrections et reprises par session propriétaire", () => {
    expect(procedures["solo.startDefinitionMatch"]).toBeDefined();
    expect(procedures["solo.submitDefinitionMatch"]).toBeDefined();
    expect(procedures["solo.getDefinitionMatch"]).toBeDefined();
    expect(procedures["solo.startRelation"]).toBeDefined();
    expect(procedures["solo.submitRelation"]).toBeDefined();
    expect(procedures["solo.getRelation"]).toBeDefined();
  });

  it("retire les endpoints publics qui révélaient ou validaient directement les réponses", () => {
    expect(procedures["games.quizChallenge"]).toBeUndefined();
    expect(procedures["games.grammarQuiz"]).toBeUndefined();
    expect(procedures["games.motusWord"]).toBeUndefined();
    expect(procedures["games.definitionMatch"]).toBeUndefined();
    expect(procedures["games.relationRound"]).toBeUndefined();
    expect(procedures["games.checkDefinitionMatch"]).toBeUndefined();
  });

  it("retire l’écriture publique d’une découverte Herbier arbitraire", () => {
    expect(procedures["herbarium.recordDiscovery"]).toBeUndefined();
    expect(procedures["solo.submitRelation"]).toBeDefined();
  });
});
