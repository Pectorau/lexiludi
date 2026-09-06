import { describe, expect, it } from "vitest";
import { definitionLeaksLemma, isDefinitionMatch, isDefinitionPublicSafe, makeDefinitionClue } from "./definitionGame";
import { areLexicallyTooSimilar } from "./db";

describe("liaison mot-définition", () => {
  it("valide seulement la définition rattachée au même lemme", () => {
    expect(isDefinitionMatch(42, 42)).toBe(true);
    expect(isDefinitionMatch(42, 43)).toBe(false);
  });

  it("transforme une définition longue en indice compact sans ses étiquettes initiales", () => {
    const clue = makeDefinitionClue("(Biologie) Qui vit aux dépens d’un autre organisme et en tire sa substance nutritive, sans le détruire immédiatement.", 9);
    expect(clue).toBe("Qui vit aux dépens d’un autre organisme et en…");
    expect(clue).not.toContain("Biologie");
  });

  it("écarte les entrées inadaptées aux parties grand public", () => {
    expect(isDefinitionPublicSafe("partouzard", "Homme qui s'adonne à une partouze.")).toBe(false);
    expect(isDefinitionPublicSafe("prostitueur", "Personne liée à la prostitution.")).toBe(false);
    expect(isDefinitionPublicSafe("souteneur", "Personne qui tire profit de la prostitution.")).toBe(false);
    expect(isDefinitionPublicSafe("minerval", "Frais d’inscription à l’université.")).toBe(true);
  });

  it("écarte les indices qui donnent directement le terme ou une forme trop transparente", () => {
    expect(definitionLeaksLemma("orangeade", "Boisson préparée avec de l’orangeade et de l’eau.")).toBe(true);
    expect(definitionLeaksLemma("suspendre", "Action de suspendre un objet dans les airs.")).toBe(true);
    expect(definitionLeaksLemma("minerval", "Frais d’inscription à l’université.")).toBe(false);
  });

  it("écarte les variantes et familles trop proches des choix relationnels", () => {
    expect(areLexicallyTooSimilar("commun", "commune")).toBe(true);
    expect(areLexicallyTooSimilar("chanteur", "chanter")).toBe(true);
    expect(areLexicallyTooSimilar("hydratation", "déshydratation")).toBe(true);
    expect(areLexicallyTooSimilar("moral", "immoral")).toBe(true);
    expect(areLexicallyTooSimilar("joie", "tristesse")).toBe(false);
  });
});
