export { getMotusKeyboardStates, gradeMotusGuess, normalizeGameWord, type MotusLetterState, type MotusSubmissionFeedback } from "../shared/motus";

export function shuffle<T>(values: T[]) {
  return [...values].sort(() => Math.random() - 0.5);
}
