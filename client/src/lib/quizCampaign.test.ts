import { describe, expect, it } from "vitest";
import { initialQuizCampaign, quizCampaignReducer, QUIZ_CAMPAIGN } from "./quizCampaign";

describe("campagne Quiz intensif", () => {
  it("enlève une vie et remet la série à zéro après une erreur", () => {
    const seeded = { ...initialQuizCampaign, hearts: 3, streak: 4 };
    expect(quizCampaignReducer(seeded, { type: "SUBMIT_ANSWER", correct: false })).toMatchObject({ hearts: 2, streak: 0, status: "PLAYING" });
  });
  it("régénère une vie au cinquième succès consécutif", () => {
    const seeded = { ...initialQuizCampaign, hearts: 2, streak: 4 };
    expect(quizCampaignReducer(seeded, { type: "SUBMIT_ANSWER", correct: true })).toMatchObject({ hearts: 3, streak: 5 });
  });
  it("bascule vers l’épreuve finale après neuf questions", () => {
    const seeded = { ...initialQuizCampaign, questionIndex: QUIZ_CAMPAIGN.totalQuestions - 2 };
    expect(quizCampaignReducer(seeded, { type: "SUBMIT_ANSWER", correct: true }).status).toBe("BOSS_TRANSITION");
  });
  it("permet une nouvelle question finale après une erreur si une vie reste", () => {
    const seeded = { ...initialQuizCampaign, status: "BOSS_PLAYING" as const, questionIndex: 9, hearts: 2, timeLeft: 5 };
    const next = quizCampaignReducer(seeded, { type: "SUBMIT_ANSWER", correct: false });
    expect(next).toMatchObject({ status: "BOSS_PLAYING", hearts: 1, timeLeft: null });
  });
});
