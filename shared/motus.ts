export type MotusLetterState = "exact" | "present" | "absent";

export type MotusSubmissionFeedback = {
  payload: string;
  feedback: readonly MotusLetterState[] | null | undefined;
};

export const MOTUS_KEYBOARD = ["A", "Z", "E", "R", "T", "Y", "U", "I", "O", "P", "Q", "S", "D", "F", "G", "H", "J", "K", "L", "M", "W", "X", "C", "V", "B", "N"] as const;

const statePriority: Record<MotusLetterState, number> = {
  absent: 1,
  present: 2,
  exact: 3,
};

export function normalizeGameWord(value: string) {
  return value
    .replace(/œ/gi, "oe")
    .replace(/æ/gi, "ae")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr-FR")
    .replace(/[^a-z]/g, "");
}

/**
 * Évalue une proposition en deux passages : les positions exactes sont retirées
 * avant les lettres présentes ailleurs. Ainsi, une lettre répétée ne peut pas
 * obtenir davantage d’indices que son nombre d’occurrences dans le mot secret.
 */
export function gradeMotusGuess(guess: string, answer: string): MotusLetterState[] | null {
  const normalizedGuess = normalizeGameWord(guess);
  const normalizedAnswer = normalizeGameWord(answer);
  if (!normalizedGuess || normalizedGuess.length !== normalizedAnswer.length) return null;

  const states: MotusLetterState[] = Array.from({ length: normalizedAnswer.length }, () => "absent");
  const remainingLetters = normalizedAnswer.split("");
  const guessLetters = normalizedGuess.split("");

  guessLetters.forEach((letter, index) => {
    if (letter === normalizedAnswer[index]) {
      states[index] = "exact";
      remainingLetters[index] = "";
    }
  });

  guessLetters.forEach((letter, index) => {
    if (states[index] === "exact") return;
    const remainingIndex = remainingLetters.indexOf(letter);
    if (remainingIndex >= 0) {
      states[index] = "present";
      remainingLetters[remainingIndex] = "";
    }
  });

  return states;
}

/**
 * Conserve l’indice le plus fort sur le clavier : exact > présent > absent.
 * Une lettre déjà reconnue ne peut donc jamais être rétrogradée par un essai
 * ultérieur effectué dans une position différente.
 */
export function getMotusKeyboardStates(submissions: readonly MotusSubmissionFeedback[]): Record<string, MotusLetterState> {
  return submissions.reduce<Record<string, MotusLetterState>>((states, submission) => {
    submission.payload.split("").forEach((letter, index) => {
      const feedback = submission.feedback?.[index];
      const normalizedLetter = normalizeGameWord(letter);
      if (!feedback || normalizedLetter.length !== 1) return;
      const current = states[normalizedLetter];
      if (!current || statePriority[feedback] > statePriority[current]) states[normalizedLetter] = feedback;
    });
    return states;
  }, {});
}
