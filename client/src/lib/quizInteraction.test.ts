import { describe, expect, it } from "vitest";
import { canSubmitQuizChoice, quizShortcutIndex, shouldConfirmNextQuestion } from "./quizInteraction";

describe("interactions Quiz", () => {
  it("associe les raccourcis A à D aux réponses réellement disponibles", () => {
    expect(quizShortcutIndex("a", 4)).toBe(0);
    expect(quizShortcutIndex("D", 4)).toBe(3);
    expect(quizShortcutIndex("C", 2)).toBeNull();
    expect(quizShortcutIndex("1", 4)).toBeNull();
  });

  it("demande confirmation quand un carnet de révision non lu serait quitté", () => {
    expect(shouldConfirmNextQuestion(1, false)).toBe(true);
    expect(shouldConfirmNextQuestion(2, true)).toBe(false);
    expect(shouldConfirmNextQuestion(0, false)).toBe(false);
  });

  it("autorise la validation seulement après une sélection non encore résolue", () => {
    expect(canSubmitQuizChoice(null, false)).toBe(false);
    expect(canSubmitQuizChoice("Masculin", false)).toBe(true);
    expect(canSubmitQuizChoice("Masculin", true)).toBe(false);
  });
});
