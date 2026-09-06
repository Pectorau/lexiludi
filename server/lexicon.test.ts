import { describe, expect, it } from "vitest";
import { cnrtlDefinitionUrl, normalizeLexicalQuery } from "./lexicon";

describe("normalisation lexicale", () => {
  it("supprime les accents et homogénéise les apostrophes", () => {
    expect(normalizeLexicalQuery("  L’ÂME  d'Œuvre ")).toBe("l ame d œuvre");
  });

  it("produit une URL CNRTL encodée pour un lemme accentué", () => {
    expect(cnrtlDefinitionUrl("vétilleux")).toBe("https://www.cnrtl.fr/definition/v%C3%A9tilleux");
  });
});
