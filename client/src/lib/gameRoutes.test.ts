import { describe, expect, it } from "vitest";
import { buildDefinitionPlayPath, buildMotusPlayPath, buildQuizPlayPath, readDefinitionMode, readMotusMode, readQuizMode, readRoundId } from "./gameRoutes";

describe("routes de jeu", () => {
  it("construit des URLs de partie distinctes avec le mode choisi", () => {
    expect(buildQuizPlayPath("truefalse", "quiz-a")).toBe("/quiz/jouer?mode=truefalse&round=quiz-a");
    expect(buildQuizPlayPath("gender", "quiz-genre")).toBe("/quiz/jouer?mode=gender&round=quiz-genre");
    expect(buildMotusPlayPath("long", "motus-b")).toBe("/motus/jouer?mode=long&round=motus-b");
    expect(buildDefinitionPlayPath("intruder", "liaison-c")).toBe("/definitions/jouer?mode=intruder&round=liaison-c");
  });

  it("applique un format sûr quand une URL contient un mode invalide", () => {
    expect(readQuizMode("/quiz/jouer?mode=unknown")).toBe("category");
    expect(readQuizMode("/quiz/jouer?mode=gender")).toBe("gender");
    expect(readQuizMode("/quiz/jouer?mode=mixed")).toBe("category");
    expect(readMotusMode("/motus/jouer?mode=unknown")).toBe("classic");
    expect(readDefinitionMode("/definitions/jouer?mode=antonym")).toBe("antonym");
    expect(readDefinitionMode("/definitions/jouer?mode=unknown")).toBe("match");
    expect(readRoundId("/motus/jouer?mode=sprint&round=nouveau-tour")).toBe("nouveau-tour");
  });
});
