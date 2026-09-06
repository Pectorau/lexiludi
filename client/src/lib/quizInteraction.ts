export function quizShortcutIndex(key: string, choiceCount: number) {
  const index = key.toLocaleUpperCase("fr-FR").charCodeAt(0) - 65;
  return index >= 0 && index < choiceCount ? index : null;
}

export function shouldConfirmNextQuestion(reviewCount: number, isReviewOpen: boolean) {
  return reviewCount > 0 && !isReviewOpen;
}

export function canSubmitQuizChoice(choice: string | null, isResolved: boolean) {
  return Boolean(choice) && !isResolved;
}
