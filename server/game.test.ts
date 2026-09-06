import { describe, expect, it } from "vitest";
import { getMotusKeyboardStates, gradeMotusGuess, normalizeGameWord } from "./game";
import { grammarContext } from "./db";

describe("règles Motus", () => {
  it("normalise les majuscules et accents pour le contrôle des essais", () => {
    expect(normalizeGameWord("ÉTÉ, CŒUR !")).toBe("etecoeur");
  });

  it("évalue les lettres exactes, présentes et absentes sans surcompter les répétitions", () => {
    expect(gradeMotusGuess("ecole", "cloue")).toEqual(["absent", "present", "exact", "present", "exact"]);
  });

  it("applique les mêmes indices à une manche avec des lettres déplacées", () => {
    expect(gradeMotusGuess("motifs", "sandix")).toEqual(["absent", "absent", "absent", "present", "absent", "present"]);
    expect(gradeMotusGuess("plaine", "sandix")).toEqual(["absent", "absent", "present", "present", "present", "absent"]);
  });

  it("reproduit les retours de la manche sandix signalée en salon", () => {
    expect(gradeMotusGuess("montre", "sandix")).toEqual(["absent", "absent", "exact", "absent", "absent", "absent"]);
    expect(gradeMotusGuess("nature", "sandix")).toEqual(["present", "exact", "absent", "absent", "absent", "absent"]);
    expect(gradeMotusGuess("notant", "sandix")).toEqual(["present", "absent", "absent", "present", "absent", "absent"]);
    expect(gradeMotusGuess("notons", "sandix")).toEqual(["present", "absent", "absent", "absent", "absent", "present"]);
  });

  it("ne colore pas plusieurs fois une lettre dont le mot secret ne contient qu’une occurrence", () => {
    expect(gradeMotusGuess("ananan", "sandix")).toEqual(["present", "present", "absent", "absent", "absent", "absent"]);
  });

  it("ne rétrograde jamais une lettre du clavier après un nouvel essai", () => {
    const keyboard = getMotusKeyboardStates([
      { payload: "montre", feedback: ["absent", "absent", "exact", "absent", "absent", "absent"] },
      { payload: "notons", feedback: ["present", "absent", "absent", "absent", "absent", "present"] },
    ]);
    expect(keyboard.n).toBe("exact");
    expect(keyboard.s).toBe("present");
    expect(keyboard.o).toBe("absent");
  });

  it("refuse un essai de longueur différente", () => {
    expect(gradeMotusGuess("mot", "motus")).toBeNull();
  });

  it("varie les contextes de noms sans répéter la même formule de genre", () => {
    const first = grammarContext("cabane", "Nom commun", "feminine");
    const second = grammarContext("piano", "Nom commun", "masculine");
    expect(first).toMatch(/cabane/);
    expect(second).toMatch(/piano/);
    expect(first).not.toContain("reste au centre de la discussion");
    expect(second).not.toContain("reste au centre de la discussion");
  });
});
