export type DailyAnswerMode = "mystery" | "pyramid" | "auction";

export function validateDailyAnswer(mode: DailyAnswerMode, rawAnswer: string) {
  const answer = rawAnswer.trim();
  if (!answer) return { valid: false, message: "Saisissez une proposition avant de la valider." } as const;
  if (mode === "pyramid" && answer.length < 4) {
    return { valid: false, message: "Le prochain palier doit contenir 4 lettres : ajoutez une lettre au mot de départ avant de valider." } as const;
  }
  if (mode === "auction" && answer.length < 4) {
    return { valid: false, message: "Le mot à deviner comporte au moins 4 lettres : complétez votre proposition avant de valider." } as const;
  }
  return { valid: true, answer } as const;
}
