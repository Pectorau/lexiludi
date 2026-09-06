import { describe, expect, it } from "vitest";
import { getMotusAttemptFeedback } from "./motusAttemptFeedback";

describe("getMotusAttemptFeedback", () => {
  it("explique qu’un mot hors lexique ne consomme pas de tentative", () => {
    expect(getMotusAttemptFeedback("Ce mot n’est pas présent dans le lexique Morphalou.")).toEqual({
      kind: "error",
      message: "Mot non reconnu · essai conservé.",
    });
  });

  it("conserve explicitement le mot lorsque le joueur est temporairement bloqué", () => {
    expect(getMotusAttemptFeedback("Blackout en cours : attendez la fin de la perturbation avant de proposer un mot.")).toEqual({
      kind: "error",
      message: "Blackout en cours · votre proposition est conservée.",
    });
  });
});
