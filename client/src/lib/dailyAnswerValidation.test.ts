import { describe, expect, it } from "vitest";
import { validateDailyAnswer } from "./dailyAnswerValidation";

describe("validation locale des réponses quotidiennes", () => {
  it("bloque une proposition Enchères de moins de quatre lettres avant la mutation", () => {
    expect(validateDailyAnswer("auction", "abc")).toEqual({ valid: false, message: "Le mot à deviner comporte au moins 4 lettres : complétez votre proposition avant de valider." });
  });

  it("bloque aussi un palier Pyramide qui ne contient pas la lettre ajoutée", () => {
    expect(validateDailyAnswer("pyramid", "car")).toEqual({ valid: false, message: "Le prochain palier doit contenir 4 lettres : ajoutez une lettre au mot de départ avant de valider." });
  });

  it("conserve les propositions valides après suppression des espaces", () => {
    expect(validateDailyAnswer("auction", "  abcd ")).toEqual({ valid: true, answer: "abcd" });
  });
});
