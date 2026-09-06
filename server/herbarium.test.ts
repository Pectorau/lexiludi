import { describe, expect, it } from "vitest";
import { GRIMOIRE_ACCENTS, normalizeHerbariumLemma, rootMatchesLemma } from "./herbarium";

describe("Herbier des racines", () => {
  it("normalise les lemmes français avant la comparaison", () => {
    expect(normalizeHerbariumLemma("BIO-logie")).toBe("biologie");
    expect(normalizeHerbariumLemma("graphô-moteur")).toBe("graphomoteur");
  });

  it("associe une entrée à une racine par préfixe normalisé", () => {
    expect(rootMatchesLemma("chrono", "chronobiologie")).toBe(true);
    expect(rootMatchesLemma("bio", "biologie")).toBe(true);
    expect(rootMatchesLemma("grapho", "biologie")).toBe(false);
  });

  it("expose uniquement les encres de thèmes acceptées par le Grimoire", () => {
    expect(GRIMOIRE_ACCENTS).toEqual(["violet", "carmin", "safran", "sapin", "bleu"]);
    expect(new Set(GRIMOIRE_ACCENTS).size).toBe(GRIMOIRE_ACCENTS.length);
  });
});
