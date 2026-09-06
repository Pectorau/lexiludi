export type QuizCampaignStatus = "PLAYING" | "BOSS_TRANSITION" | "BOSS_PLAYING" | "GAME_OVER" | "VICTORY";

export type QuizCampaignState = {
  status: QuizCampaignStatus;
  questionIndex: number;
  hearts: number;
  streak: number;
  timeLeft: number | null;
};

export const QUIZ_CAMPAIGN = { maxHearts: 3, totalQuestions: 10, bossTime: 10, heartRecoveryStreak: 5 } as const;
export const initialQuizCampaign: QuizCampaignState = { status: "PLAYING", questionIndex: 0, hearts: QUIZ_CAMPAIGN.maxHearts, streak: 0, timeLeft: null };

export type QuizCampaignAction =
  | { type: "SUBMIT_ANSWER"; correct: boolean }
  | { type: "START_BOSS" }
  | { type: "PREPARE_BOSS_RETRY" }
  | { type: "TICK" }
  | { type: "TIME_OUT" }
  | { type: "RESET" };

function applyAnswer(state: QuizCampaignState, correct: boolean) {
  const hearts = correct ? Math.min(QUIZ_CAMPAIGN.maxHearts, state.hearts + (state.streak + 1 >= QUIZ_CAMPAIGN.heartRecoveryStreak && (state.streak + 1) % QUIZ_CAMPAIGN.heartRecoveryStreak === 0 ? 1 : 0)) : state.hearts - 1;
  return { hearts, streak: correct ? state.streak + 1 : 0 };
}

export function quizCampaignReducer(state: QuizCampaignState, action: QuizCampaignAction): QuizCampaignState {
  if (action.type === "RESET") return initialQuizCampaign;
  if (action.type === "START_BOSS") return { ...state, status: "BOSS_PLAYING", questionIndex: QUIZ_CAMPAIGN.totalQuestions - 1, timeLeft: QUIZ_CAMPAIGN.bossTime };
  if (action.type === "PREPARE_BOSS_RETRY") return state.status === "BOSS_PLAYING" ? { ...state, timeLeft: QUIZ_CAMPAIGN.bossTime } : state;
  if (action.type === "TICK") return state.status === "BOSS_PLAYING" && state.timeLeft && state.timeLeft > 0 ? { ...state, timeLeft: state.timeLeft - 1 } : state;
  if (action.type === "TIME_OUT") {
    if (state.status !== "BOSS_PLAYING" || state.timeLeft !== 0) return state;
    const hearts = state.hearts - 1;
    return hearts <= 0 ? { ...state, hearts: 0, status: "GAME_OVER", timeLeft: null } : { ...state, hearts, streak: 0, timeLeft: null };
  }
  if (action.type !== "SUBMIT_ANSWER" || state.status === "GAME_OVER" || state.status === "VICTORY" || state.status === "BOSS_TRANSITION") return state;
  const next = applyAnswer(state, action.correct);
  if (next.hearts <= 0) return { ...state, ...next, hearts: 0, status: "GAME_OVER", timeLeft: null };
  if (state.status === "BOSS_PLAYING") return action.correct ? { ...state, ...next, status: "VICTORY", timeLeft: null } : { ...state, ...next, timeLeft: null };
  if (state.questionIndex === QUIZ_CAMPAIGN.totalQuestions - 2) return { ...state, ...next, status: "BOSS_TRANSITION", timeLeft: null };
  return { ...state, ...next, questionIndex: state.questionIndex + 1 };
}
