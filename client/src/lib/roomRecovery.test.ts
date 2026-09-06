import { describe, expect, it } from "vitest";
import { getRoomRecoveryPath } from "./roomRecovery";

describe("récupération de code de salon", () => {
  it("revient vers le bon jeu au lieu de rediriger systématiquement vers Motus", () => {
    expect(getRoomRecoveryPath("quiz")).toBe("/quiz/multijoueur");
    expect(getRoomRecoveryPath("motus")).toBe("/motus/multijoueur");
    expect(getRoomRecoveryPath("definition")).toBe("/definitions/multijoueur");
  });

  it("choisit Quiz comme repli lorsqu’aucune origine exploitable n’est connue", () => {
    expect(getRoomRecoveryPath(null)).toBe("/quiz/multijoueur");
    expect(getRoomRecoveryPath("inconnu")).toBe("/quiz/multijoueur");
  });
});
