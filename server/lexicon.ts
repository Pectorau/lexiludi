/** Normalisation identique à celle appliquée lors de l’import Morphalou. */
export function normalizeLexicalQuery(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr-FR")
    .replace(/[’']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** L’application consulte les notices CNRTL sans en recopier les définitions. */
export function cnrtlDefinitionUrl(lemma: string) {
  return `https://www.cnrtl.fr/definition/${encodeURIComponent(lemma)}`;
}
