export const semanticSources = {
  intensity: {
    label: "Intensité",
    dataset: "MULTI-SCALE",
    url: "https://github.com/ainagari/scalar_adjs",
    description: "Échelles d’adjectifs traduites en français et annotées par rang.",
    status: "source-verifiee-a-importer",
  },
  roots: {
    label: "Racines",
    dataset: "EtymDB",
    url: "https://github.com/droher/etymology-db",
    description: "Relations étymologiques structurées issues de Wiktionary, dont root et derived_from.",
    license: "CC BY-SA 3.0",
    status: "source-verifiee-a-importer",
  },
} as const;

export type SemanticSourceKey = keyof typeof semanticSources;
