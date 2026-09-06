export type PlannedGameMode = "mystery" | "pyramid" | "auction";
export type PlannedJoker = "pruning" | "perfect_parade" | "spilled_ink" | "time_freeze" | "double_stake";

export type PlannedModeRule = {
  label: string;
  objective: string;
  roundData: readonly string[];
  scoring: string;
};

export const plannedModeRules: Record<PlannedGameMode, PlannedModeRule> = {
  mystery: {
    label: "Mot Mystère",
    objective: "Identifier un mot à partir d’une définition révélée mot par mot toutes les trois secondes.",
    roundData: ["lemma", "definitionTokens", "revealedTokenCount", "nextRevealAt"],
    scoring: "100 points moins 8 points par mot de définition révélé, sans descendre sous 20 points.",
  },
  pyramid: {
    label: "Pyramide",
    objective: "Partir d’un mot de trois lettres et ajouter une lettre à chaque palier jusqu’à huit lettres, avec un mot valide à chaque rang.",
    roundData: ["steps", "currentLength", "candidateWord", "validatedSteps"],
    scoring: "20 points par palier valide, plus 40 points pour la pyramide complète sans erreur.",
  },
  auction: {
    label: "Enchères",
    objective: "Miser des points pour acheter des indices de lettres avant de tenter le mot final.",
    roundData: ["lemma", "letterHints", "pointsBalance", "purchasedHints"],
    scoring: "Chaque lettre coûte des points ; une réponse correcte conserve le solde restant, une erreur vaut zéro.",
  },
};

export type PlannedJokerRule = {
  label: string;
  target: "self" | "opponent" | "room";
  effect: string;
  serverGuard: string;
};

export const plannedJokerRules: Record<PlannedJoker, PlannedJokerRule> = {
  pruning: {
    label: "Émondage",
    target: "self",
    effect: "Retire au maximum deux propositions incorrectes de l’affichage personnel.",
    serverGuard: "Réservé aux manches à choix, sans supprimer la bonne réponse.",
  },
  perfect_parade: {
    label: "Parade parfaite",
    target: "self",
    effect: "Bloque le prochain effet adverse ciblé pendant six secondes.",
    serverGuard: "Effet expirant, consommé au premier blocage et jamais cumulable.",
  },
  spilled_ink: {
    label: "Encre renversée",
    target: "opponent",
    effect: "Masque temporairement les libellés auxiliaires, sans masquer la consigne ni les contrôles.",
    serverGuard: "Durée courte, accessibilité préservée et annulation par Parade parfaite.",
  },
  time_freeze: {
    label: "Gel temporel",
    target: "self",
    effect: "Suspend le décompte personnel pendant cinq secondes sur une manche chronométrée.",
    serverGuard: "Incompatible avec le mode Libre et plafonné à une activation par manche.",
  },
  double_stake: {
    label: "Double mise",
    target: "self",
    effect: "Double les points d’une réponse correcte ; une réponse incorrecte ne rapporte aucun point.",
    serverGuard: "Doit être déclaré avant soumission et ne se cumule avec aucun multiplicateur.",
  },
};

export function canUsePlannedJoker(input: { joker: PlannedJoker; roundDurationSeconds: number; alreadyUsed: boolean }) {
  if (input.alreadyUsed) return false;
  if (input.joker === "time_freeze" && input.roundDurationSeconds === 0) return false;
  return true;
}
