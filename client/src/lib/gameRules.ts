export type RuleGame = "quiz" | "motus" | "definition";

export type QuickJoker = {
  name: string;
  effect: string;
};

export type GameQuickGuide = {
  title: string;
  eyebrow: string;
  goal: string;
  steps: readonly { title: string; text: string }[];
  soloNote: string;
  jokerInstruction: string;
  jokers: readonly QuickJoker[];
};

export const gameQuickGuides: Record<RuleGame, GameQuickGuide> = {
  quiz: {
    title: "Quiz aléatoire",
    eyebrow: "Une réponse, puis une validation.",
    goal: "Identifiez la bonne catégorie, le bon genre ou la bonne affirmation.",
    steps: [
      { title: "1. Lisez", text: "Observez le mot et la consigne." },
      { title: "2. Choisissez", text: "Votre choix reste modifiable." },
      { title: "3. Validez", text: "Confirmez pour recevoir la correction." },
    ],
    soloNote: "Solo : A à D sélectionnent une réponse, puis Entrée la valide. Aucun joker en solo.",
    jokerInstruction: "En salon, cliquez une carte de votre réserve pendant la manche. Trois cartes maximum sont conservées.",
    jokers: [
      { name: "Tempo", effect: "+10 s si un chrono est actif." },
      { name: "Seconde chance", effect: "Après une erreur : reprise à demi-points." },
      { name: "Brouillard", effect: "Masque les indices d’un adversaire pendant 5 s." },
      { name: "Parade", effect: "Protège du prochain Brouillard pendant 6 s." },
    ],
  },
  motus: {
    title: "Motus",
    eyebrow: "Lettres, positions et déduction.",
    goal: "Trouvez le mot secret avant la fin de vos essais.",
    steps: [
      { title: "1. Proposez", text: "Entrez un mot de la bonne longueur." },
      { title: "2. Lisez les cases", text: "Vert : place exacte. Ambre : ailleurs. Gris : absente." },
      { title: "3. Ajustez", text: "Réutilisez les indices et les lettres déjà essayées." },
    ],
    soloNote: "Solo : saisissez au clavier ou avec les touches visuelles. Certaines grilles offrent un coup de pouce.",
    jokerInstruction: "En salon, cliquez une carte reçue pendant la manche. Les cartes sont gagnées aléatoirement et la réserve est limitée à trois.",
    jokers: [
      { name: "Boussole", effect: "Donne la première lettre du mot." },
      { name: "Essai bonus", effect: "Accorde une tentative supplémentaire." },
      { name: "Lettre présente", effect: "Révèle une lettre, sans sa case." },
      { name: "Lettre placée", effect: "Révèle une lettre et sa case exacte." },
      { name: "Aperçu", effect: "Montre le dernier essai adverse pendant 3 s." },
      { name: "Radar", effect: "Indique le progrès d’un adversaire." },
      { name: "Brouillard", effect: "Masque les indices adverses pendant 5 s." },
      { name: "Parade", effect: "Bloque le prochain Brouillard durant 6 s." },
    ],
  },
  definition: {
    title: "Mots liés",
    eyebrow: "Relier les mots à leur sens.",
    goal: "Associez une définition, une nuance ou une relation à la bonne piste.",
    steps: [
      { title: "1. Observez", text: "Lisez les mots, définitions ou options." },
      { title: "2. Reliez", text: "Choisissez une paire ou une piste." },
      { title: "3. Vérifiez", text: "Validez pour découvrir la nuance." },
    ],
    soloNote: "Solo : en Liaison, choisissez un mot puis une définition. Dans les relations, vous pouvez activer une seconde chance avant de répondre.",
    jokerInstruction: "En salon, déclenchez une carte de votre réserve pendant la manche ; pour Brouillard ou Aperçu, choisissez l’adversaire ciblé.",
    jokers: [
      { name: "Boussole", effect: "Révèle une association exacte, en privé." },
      { name: "Seconde chance", effect: "Après une erreur : reprise à demi-points." },
      { name: "Aperçu", effect: "Montre la dernière association adverse pendant 3 s." },
      { name: "Brouillard", effect: "Masque les indices d’un adversaire pendant 5 s." },
      { name: "Parade", effect: "Bloque le prochain Brouillard durant 6 s." },
      { name: "Tempo", effect: "+10 s si un chrono est actif." },
    ],
  },
};

export function getGameQuickGuide(game: RuleGame) {
  return gameQuickGuides[game];
}
