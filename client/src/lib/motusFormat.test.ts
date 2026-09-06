import { describe, expect, it } from "vitest";
import { canRevealMotusAnswer, describeMotusAttempt, MOTUS_KEYBOARD_LAYOUTS, shouldConfirmMotusRestart } from "./motusFormat";

describe("formats Motus", () => {
  it("propose les dispositions AZERTY, QWERTY et BÉPO sans perdre les lettres françaises", () => {
    expect(MOTUS_KEYBOARD_LAYOUTS.azerty).toContain("A");
    expect(MOTUS_KEYBOARD_LAYOUTS.qwerty[0]).toBe("Q");
    expect(MOTUS_KEYBOARD_LAYOUTS.bepo).toContain("É");
  });

  it("n’autorise la révélation qu’au dernier essai encore jouable", () => {
    expect(canRevealMotusAnswer(2, false, false)).toBe(false);
    expect(canRevealMotusAnswer(1, false, false)).toBe(true);
    expect(canRevealMotusAnswer(1, true, false)).toBe(false);
  });

  it("demande confirmation seulement pour une grille commencée et non terminée", () => {
    expect(shouldConfirmMotusRestart(0, false, false)).toBe(false);
    expect(shouldConfirmMotusRestart(1, false, false)).toBe(true);
    expect(shouldConfirmMotusRestart(1, true, false)).toBe(false);
  });

  it("annonce les trois types d’indices avec leurs occurrences", () => {
    expect(describeMotusAttempt(["exact", "present", "absent", "absent"], 3)).toContain("1 lettre bien placée, 1 présente ailleurs, 2 absentes");
  });
});
