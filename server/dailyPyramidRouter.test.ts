import { describe, expect, it } from "vitest";
import { validateDailyPyramidStep } from "./db";

describe("contrat tRPC Pyramide quotidienne", () => {
  it("renvoie un refus pédagogique pour un palier qui ne réorganise pas le mot précédent", async () => {
    const result = await validateDailyPyramidStep("car", "car");
    expect(result).toEqual({ valid: false, reason: "Utilisez toutes les lettres précédentes, ajoutez-en une et réorganisez réellement le mot." });
  });
});
