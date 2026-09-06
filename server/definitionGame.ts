/** Détermine si le mot choisi est bien celui auquel appartient la définition proposée. */
export function isDefinitionMatch(entryId: number, definitionEntryId: number) {
  return entryId === definitionEntryId;
}

export const publicDefinitionSafetyPattern = "partouz|pornograph|masturb|fellation|sodom|prostitu|souteneur|maquerell|prox[eé]n[eé]t|sexe|sexuel|eroti|co[iï]t|vagin|penis|p[eé]nis|vulv|orgasm|inceste|pedophil|p[eé]dophil";

export function isDefinitionPublicSafe(lemma: string, definition: string) {
  const unsafe = new RegExp(publicDefinitionSafetyPattern, "i");
  return !unsafe.test(lemma) && !unsafe.test(definition);
}

export function definitionLeaksLemma(lemma: string, definition: string) {
  const normalizedLemma = lemma
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr-FR")
    .replace(/[^a-z]/g, "");
  if (normalizedLemma.length < 4) return false;
  const tokens = definition
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr-FR")
    .match(/[a-z]{4,}/g) ?? [];
  return tokens.some((token) => token === normalizedLemma || token.startsWith(normalizedLemma) || normalizedLemma.startsWith(token));
}

/**
 * Conserve une formulation sourcée, mais en présente seulement l’amorce pour
 * transformer la définition en indice de jeu plutôt qu’en réponse complète.
 */
export function makeDefinitionClue(definition: string, wordLimit = 14) {
  const withoutLabels = definition
    .replace(/^\s*(?:\([^)]{1,64}\)\s*)+/, "")
    .replace(/\s+/g, " ")
    .trim();
  const words = withoutLabels.split(" ").filter(Boolean);
  if (words.length <= wordLimit) return withoutLabels;
  return `${words.slice(0, wordLimit).join(" ").replace(/[;,:]$/, "")}…`;
}
