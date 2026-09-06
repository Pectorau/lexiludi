import { describe, expect, it } from "vitest";
import { canOfferSecondChance, canValidateDefinitionChoice } from "./definitionInteraction";

describe("interactions Mots liés", () => {
  it("valide seulement une étiquette sélectionnée et non encore corrigée", () => {
    expect(canValidateDefinitionChoice(null, false)).toBe(false);
    expect(canValidateDefinitionChoice(18, false)).toBe(true);
    expect(canValidateDefinitionChoice(18, true)).toBe(false);
  });

  it("accorde une unique seconde chance seulement si elle est activée", () => {
    expect(canOfferSecondChance(false, true, false)).toBe(true);
    expect(canOfferSecondChance(false, false, false)).toBe(false);
    expect(canOfferSecondChance(false, true, true)).toBe(false);
    expect(canOfferSecondChance(true, true, false)).toBe(false);
  });
});
