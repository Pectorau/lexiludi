export type QuizMode = "category" | "truefalse" | "gender";
export type MotusMode = "classic" | "sprint" | "long";
export type DefinitionMode = "match" | "synonym" | "antonym" | "intruder";

export const quizModes: { id: QuizMode; label: string; detail: string }[] = [
  { id: "category", label: "Catégorie", detail: "4 réponses" },
  { id: "truefalse", label: "Vrai / Faux", detail: "réponse flash" },
  { id: "gender", label: "Genre", detail: "masculin ou féminin" },
];

export const motusModes: { id: MotusMode; label: string; minLength: number; maxLength: number; attempts: number }[] = [
  { id: "classic", label: "Classique", minLength: 4, maxLength: 8, attempts: 6 },
  { id: "sprint", label: "Sprint", minLength: 4, maxLength: 6, attempts: 4 },
  { id: "long", label: "Long", minLength: 7, maxLength: 12, attempts: 8 },
];

export const definitionModes: { id: DefinitionMode; label: string; detail: string }[] = [
  { id: "match", label: "Mot · sens", detail: "Relier 4 mots à 4 définitions" },
  { id: "synonym", label: "Synonymes", detail: "Trouver une proximité de sens" },
  { id: "antonym", label: "Antonymes", detail: "Reconnaître une opposition nette" },
  { id: "intruder", label: "Intrus", detail: "Repérer le mot hors du groupe" },
];

function createRoundId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function queryValue(location: string, name: string) {
  const query = location.includes("?") ? location.slice(location.indexOf("?")) : "";
  return new URLSearchParams(query).get(name);
}

export function readQuizMode(location: string): QuizMode {
  const value = queryValue(location, "mode");
  return value === "truefalse" || value === "gender" ? value : "category";
}

export function readMotusMode(location: string): MotusMode {
  const value = queryValue(location, "mode");
  return value === "sprint" || value === "long" ? value : "classic";
}

export function readDefinitionMode(location: string): DefinitionMode {
  const value = queryValue(location, "mode");
  return value === "synonym" || value === "antonym" || value === "intruder" ? value : "match";
}

export function buildQuizPlayPath(mode: QuizMode, round = createRoundId()) {
  return `/quiz/jouer?mode=${mode}&round=${encodeURIComponent(round)}`;
}

export function buildMotusPlayPath(mode: MotusMode, round = createRoundId()) {
  return `/motus/jouer?mode=${mode}&round=${encodeURIComponent(round)}`;
}

export function buildDefinitionPlayPath(mode: DefinitionMode, round = createRoundId()) {
  return `/definitions/jouer?mode=${mode}&round=${encodeURIComponent(round)}`;
}

export function readRoundId(location: string) {
  return queryValue(location, "round") ?? "initial";
}
