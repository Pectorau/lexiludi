export type MotusAttemptFeedback = {
  kind: "error" | "success";
  message: string;
};

export function getMotusAttemptFeedback(errorMessage: string): MotusAttemptFeedback {
  if (errorMessage.includes("lexique Morphalou")) {
    return { kind: "error", message: "Mot non reconnu · essai conservé." };
  }

  if (errorMessage.includes("Blackout en cours")) {
    return { kind: "error", message: "Blackout en cours · votre proposition est conservée." };
  }

  return { kind: "error", message: errorMessage || "Proposition non enregistrée · essai conservé." };
}
