import { and, asc, count, eq, gte, inArray, isNotNull, like, max, ne, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, lexicalDefinitions, lexicalEntries, lexicalForms, lexicalRelations, users } from "../drizzle/schema";
import { ENV } from './_core/env';
import { normalizeLexicalQuery } from "./lexicon";
import { normalizeGameWord } from "./game";
import { definitionLeaksLemma, isDefinitionMatch, makeDefinitionClue, publicDefinitionSafetyPattern } from "./definitionGame";

let _db: ReturnType<typeof drizzle> | null = null;

function shuffle<T>(items: T[]) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const nextIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[nextIndex]] = [result[nextIndex]!, result[index]!];
  }
  return result;
}

const hasCnrtlLink = sql`COALESCE(TRIM(${lexicalEntries.cnrtlUrl}), '') <> ''`;
const contextualQuizCategories = ["Nom commun", "Adjectif qualificatif", "Verbe", "Adverbe"] as const;

export function grammarContext(lemma: string, category: string, gender: string | null) {
  if (category === "Nom commun") {
    const beginsWithVowel = /^[aàâäeéèêëiîïoôöuùûüÿh]/i.test(lemma);
    const article = beginsWithVowel ? "L’" : gender === "feminine" ? "La " : "Le ";
    const examples = [
      `${article}${lemma} apparaît dans la note de jeu.`,
      `${article}${lemma} attire l’attention dans cette phrase.`,
      `${article}${lemma} apporte une nuance au carnet.`,
    ];
    const index = Array.from(lemma).reduce((total, letter) => total + letter.charCodeAt(0), 0) % examples.length;
    return `Contexte : « ${examples[index]} »`;
  }
  if (category === "Adjectif qualificatif") {
    const examples = [`Un détail ${lemma} retient l’attention.`, `Cette tournure paraît ${lemma}.`, `Le mot ${lemma} colore l’exemple.`];
    const index = Array.from(lemma).reduce((total, letter) => total + letter.charCodeAt(0), 0) % examples.length;
    return `Contexte : « ${examples[index]} »`;
  }
  if (category === "Verbe") {
    const examples = [`Nous allons ${lemma} avant de jouer.`, `Il faut ${lemma} la bonne piste.`, `À vous de ${lemma} avec méthode.`];
    const index = Array.from(lemma).reduce((total, letter) => total + letter.charCodeAt(0), 0) % examples.length;
    return `Contexte : « ${examples[index]} »`;
  }
  const examples = [`Le joueur avance ${lemma} dans la grille.`, `Elle répond ${lemma} à la question.`, `La partie se poursuit ${lemma}.`];
  const index = Array.from(lemma).reduce((total, letter) => total + letter.charCodeAt(0), 0) % examples.length;
  return `Contexte : « ${examples[index]} »`;
}

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

/** Invalide tous les JWT déjà émis pour un compte, sans stocker les jetons eux-mêmes. */
export async function revokeUserSessions(openId: string) {
  const db = await getDb();
  if (!db) throw new Error("La révocation de session est indisponible.");
  const user = await getUserByOpenId(openId);
  if (!user) return false;
  await db.update(users).set({ sessionVersion: user.sessionVersion + 1 }).where(eq(users.id, user.id));
  return true;
}

export type LexiconSearchHit = {
  id: number;
  lemma: string;
  category: string | null;
  gender: string | null;
  pronunciation: string | null;
  cnrtlUrl: string;
  matchedForm?: string;
};

export async function searchLexicon(query: string, limit = 6): Promise<LexiconSearchHit[]> {
  const db = await getDb();
  if (!db) return [];
  const normalized = normalizeLexicalQuery(query);
  if (normalized.length < 2) return [];
  const searchPattern = `${normalized}%`;
  const directMatches = await db
    .select({ id: lexicalEntries.id, lemma: lexicalEntries.lemma, category: lexicalEntries.category, gender: lexicalEntries.gender, pronunciation: lexicalEntries.pronunciation, cnrtlUrl: lexicalEntries.cnrtlUrl })
    .from(lexicalEntries)
    .where(like(lexicalEntries.normalizedLemma, searchPattern))
    .orderBy(asc(lexicalEntries.lemma))
    .limit(limit);
  const formMatches = directMatches.length < limit
    ? await db
      .select({ id: lexicalEntries.id, lemma: lexicalEntries.lemma, category: lexicalEntries.category, gender: lexicalEntries.gender, pronunciation: lexicalEntries.pronunciation, cnrtlUrl: lexicalEntries.cnrtlUrl, matchedForm: lexicalForms.form })
      .from(lexicalForms)
      .innerJoin(lexicalEntries, eq(lexicalForms.entryId, lexicalEntries.id))
      .where(like(lexicalForms.normalizedForm, searchPattern))
      .orderBy(asc(lexicalForms.form))
      .limit(limit)
    : [];
  const resultById = new Map<number, LexiconSearchHit>();
  directMatches.forEach((entry) => resultById.set(entry.id, entry));
  formMatches.forEach((entry) => {
    if (!resultById.has(entry.id)) resultById.set(entry.id, entry);
  });
  return Array.from(resultById.values()).slice(0, limit);
}

export async function getLexiconStats() {
  const db = await getDb();
  if (!db) return { entries: 0, forms: 0 };
  const [entryCount] = await db.select({ value: count() }).from(lexicalEntries);
  const [formCount] = await db.select({ value: count() }).from(lexicalForms);
  return { entries: Number(entryCount?.value ?? 0), forms: Number(formCount?.value ?? 0) };
}

export type LexiconGameEntry = {
  id: number;
  lemma: string;
  category: string | null;
  pronunciation: string | null;
  cnrtlUrl: string;
};

const gameFields = {
  id: lexicalEntries.id,
  lemma: lexicalEntries.lemma,
  category: lexicalEntries.category,
  gender: lexicalEntries.gender,
  pronunciation: lexicalEntries.pronunciation,
  cnrtlUrl: lexicalEntries.cnrtlUrl,
};

async function pickRandomEntry(where: ReturnType<typeof and>) {
  const db = await getDb();
  if (!db) return undefined;
  const [bounds] = await db.select({ maxId: max(lexicalEntries.id) }).from(lexicalEntries);
  const maxId = Number(bounds?.maxId ?? 0);
  if (!maxId) return undefined;
  const startId = Math.floor(Math.random() * maxId) + 1;
  const [entry] = await db.select(gameFields).from(lexicalEntries).where(and(where, gte(lexicalEntries.id, startId))).orderBy(asc(lexicalEntries.id)).limit(1);
  if (entry) return entry;
  const [fallback] = await db.select(gameFields).from(lexicalEntries).where(where).orderBy(asc(lexicalEntries.id)).limit(1);
  return fallback;
}

export async function getRandomGrammarQuiz() {
  const db = await getDb();
  if (!db) return null;
  const eligibility = and(hasCnrtlLink, inArray(lexicalEntries.category, contextualQuizCategories), sql`CHAR_LENGTH(${lexicalEntries.lemma}) BETWEEN 4 AND 12`, sql`${lexicalEntries.lemma} REGEXP '^[[:alpha:]]+$'`, or(ne(lexicalEntries.category, "Verbe"), sql`${lexicalEntries.lemma} REGEXP '(er|ir|re|oir)$'`));
  // Les noms communs dominent le corpus : la majorité des tirages fait varier la catégorie,
  // sans cesser de s’appuyer sur l’aléatoire réel du lexique Morphalou.
  const entry = await pickRandomEntry(Math.random() < 0.7 ? and(eligibility, ne(lexicalEntries.category, "Nom commun")) : eligibility);
  if (!entry?.category) return null;

  const distractors = shuffle(contextualQuizCategories.filter((category) => category !== entry.category));
  if (distractors.length < 3) return null;

  return {
    ...entry,
    context: grammarContext(entry.lemma, entry.category, entry.gender),
    prompt: `Selon Morphalou 3, quelle est la catégorie grammaticale de « ${entry.lemma} » ?`,
    choices: shuffle([entry.category, ...distractors]),
    source: { name: "Morphalou 3", license: "LGPL-LR", cnrtlUrl: entry.cnrtlUrl },
  };
}

export type QuizChallengeMode = "category" | "truefalse" | "gender";

export type QuizChallenge = {
  kind: QuizChallengeMode;
  term: string;
  lemma: string;
  prompt: string;
  choices: string[];
  answer: string;
  correction: string;
  context: string;
  statementCategory?: string;
  source: { name: string; license: string; cnrtlUrl: string };
};

function asQuizSource(cnrtlUrl: string) {
  return { name: "Morphalou 3", license: "LGPL-LR", cnrtlUrl };
}

async function getCategoryChallenge(kind: "category" | "truefalse"): Promise<QuizChallenge | null> {
  const quiz = await getRandomGrammarQuiz();
  if (!quiz?.category) return null;
  if (kind === "category") {
    return {
      kind,
      term: quiz.lemma,
      lemma: quiz.lemma,
      prompt: "Quelle est la catégorie grammaticale de ce mot ?",
      choices: quiz.choices,
      answer: quiz.category,
      correction: `Morphalou associe « ${quiz.lemma} » à la catégorie « ${quiz.category} ».`,
      context: quiz.context,
      source: asQuizSource(quiz.cnrtlUrl),
    };
  }
  const statementCategory = Math.random() < 0.5 ? quiz.category : quiz.choices.find((choice) => choice !== quiz.category) ?? quiz.category;
  const isTrue = statementCategory === quiz.category;
  return {
    kind,
    term: quiz.lemma,
    lemma: quiz.lemma,
    prompt: `Dans cet emploi, « ${quiz.lemma} » est-il bien un ${statementCategory} ?`,
    choices: ["Vrai", "Faux"],
    answer: isTrue ? "Vrai" : "Faux",
    correction: `Morphalou associe « ${quiz.lemma} » à la catégorie « ${quiz.category} ».`,
    context: quiz.context,
    statementCategory,
    source: asQuizSource(quiz.cnrtlUrl),
  };
}

async function getGenderChallenge(): Promise<QuizChallenge | null> {
  const entry = await pickRandomEntry(and(
    hasCnrtlLink,
    eq(lexicalEntries.category, "Nom commun"),
    sql`${lexicalEntries.gender} IN ('masculine', 'feminine')`,
    sql`CHAR_LENGTH(${lexicalEntries.lemma}) BETWEEN 3 AND 18`,
    sql`${lexicalEntries.lemma} REGEXP '^[[:alpha:]]+$'`,
  ));
  if (!entry || (entry.gender !== "masculine" && entry.gender !== "feminine")) return null;
  const answer = entry.gender === "masculine" ? "Masculin" : "Féminin";
  return {
    kind: "gender",
    term: entry.lemma,
    lemma: entry.lemma,
    prompt: "Quel est le genre grammatical du nom en contexte ?",
    choices: ["Masculin", "Féminin"],
    answer,
    correction: `Morphalou indique un genre ${answer.toLocaleLowerCase("fr-FR")} pour « ${entry.lemma} ».`,
    context: grammarContext(entry.lemma, entry.category ?? "Nom commun", entry.gender),
    source: asQuizSource(entry.cnrtlUrl),
  };
}

export async function getRandomQuizChallenge(mode: QuizChallengeMode = "category"): Promise<QuizChallenge | null> {
  if (mode === "category" || mode === "truefalse") return getCategoryChallenge(mode);
  return getGenderChallenge();
}

function motusEligibility(minLength: number, maxLength: number) {
  return and(
    hasCnrtlLink,
    sql`CHAR_LENGTH(${lexicalEntries.lemma}) BETWEEN ${minLength} AND ${maxLength}`,
    sql`${lexicalEntries.lemma} REGEXP '^[[:alpha:]]+$'`,
    sql`${lexicalEntries.lemma} NOT REGEXP '[œŒæÆ]'`,
    sql`(SELECT COUNT(*) FROM ${lexicalForms} WHERE ${lexicalForms.entryId} = ${lexicalEntries.id}) >= 4`,
  );
}

export async function getRandomMotusWord(minLength = 4, maxLength = 12) {
  const entry = await pickRandomEntry(motusEligibility(minLength, maxLength));
  if (!entry) return null;
  return { ...entry, source: { name: "Morphalou 3", license: "LGPL-LR", cnrtlUrl: entry.cnrtlUrl } };
}

export async function getMotusPoolStats(minLength = 4, maxLength = 12) {
  const db = await getDb();
  if (!db) return { entries: 0, minLength, maxLength };
  const [result] = await db.select({ entries: count() }).from(lexicalEntries).where(motusEligibility(minLength, maxLength));
  return { entries: Number(result?.entries ?? 0), minLength, maxLength };
}

export async function isMotusAttemptInLexicon(word: string, expectedLength: number) {
  const db = await getDb();
  const normalized = normalizeGameWord(word);
  if (!db || normalized.length !== expectedLength) return false;
  const [lemma] = await db
    .select({ id: lexicalEntries.id })
    .from(lexicalEntries)
    .where(eq(lexicalEntries.normalizedLemma, normalized))
    .limit(1);
  if (lemma) return true;
  const [form] = await db
    .select({ id: lexicalForms.id })
    .from(lexicalForms)
    .where(eq(lexicalForms.normalizedForm, normalized))
    .limit(1);
  return Boolean(form);
}

export async function getDefinitionMatchRound(pairCount = 4) {
  const db = await getDb();
  if (!db) return null;
  const [bounds] = await db.select({ maxId: max(lexicalDefinitions.id) }).from(lexicalDefinitions);
  const maxDefinitionId = Number(bounds?.maxId ?? 0);
  if (!maxDefinitionId) return null;
  const selectDefinitions = (startId: number) => db
    .select({ definitionId: lexicalDefinitions.id, entryId: lexicalDefinitions.lexicalEntryId, lemma: lexicalDefinitions.lemma, definition: lexicalDefinitions.definition, sourceUrl: lexicalDefinitions.sourceUrl, sourceName: lexicalDefinitions.sourceName, sourceLicense: lexicalDefinitions.sourceLicense, cnrtlUrl: lexicalEntries.cnrtlUrl, category: lexicalEntries.category })
    .from(lexicalDefinitions)
    .innerJoin(lexicalEntries, eq(lexicalDefinitions.lexicalEntryId, lexicalEntries.id));
  const publicSafety = sql`LOWER(${lexicalDefinitions.lemma}) NOT REGEXP ${publicDefinitionSafetyPattern} AND LOWER(${lexicalDefinitions.definition}) NOT REGEXP ${publicDefinitionSafetyPattern} AND ${hasCnrtlLink}`;
  const startId = Math.floor(Math.random() * Math.max(1, maxDefinitionId - pairCount * 36)) + 1;
  let definitions = shuffle((await selectDefinitions(startId)
    .where(and(gte(lexicalDefinitions.id, startId), publicSafety, sql`CHAR_LENGTH(${lexicalDefinitions.definition}) BETWEEN 70 AND 360`))
    .orderBy(asc(lexicalDefinitions.id))
    .limit(pairCount * 18)).filter((item) => !definitionLeaksLemma(item.lemma, item.definition))).slice(0, pairCount);
  if (definitions.length < pairCount) {
    definitions = shuffle((await selectDefinitions(1)
      .where(and(publicSafety, sql`CHAR_LENGTH(${lexicalDefinitions.definition}) BETWEEN 70 AND 360`))
      .orderBy(asc(lexicalDefinitions.id))
      .limit(pairCount * 24)).filter((item) => !definitionLeaksLemma(item.lemma, item.definition))).slice(0, pairCount);
  }
  if (definitions.length < pairCount) return null;
  return {
    prompt: "Reliez chaque mot à son indice de sens.",
    words: shuffle(definitions.map((item) => ({ entryId: item.entryId, lemma: item.lemma, cnrtlUrl: item.cnrtlUrl, category: item.category }))),
    definitions: shuffle(definitions.map((item) => ({ definitionId: item.definitionId, text: makeDefinitionClue(item.definition) }))),
    source: {
      name: definitions[0]?.sourceName ?? "DBnary / Wiktionnaire",
      license: definitions[0]?.sourceLicense ?? "CC BY-SA 3.0",
      url: "https://kaiko.getalp.org/about-dbnary/",
    },
  };
}

export async function getDailyMysteryChallenge() {
  const round = await getDefinitionMatchRound(1);
  const word = round?.words[0];
  const definition = round?.definitions[0];
  if (!word || !definition) return null;
  const tokens = definition.text.split(/\s+/).map((token) => token.trim()).filter(Boolean);
  if (tokens.length < 4) return null;
  return { lemma: word.lemma, definition: definition.text, tokens, cnrtlUrl: word.cnrtlUrl, category: word.category ?? null };
}

export async function getDailyPyramidChallenge() {
  const startingWords = ["car", "vol", "sol", "par", "tir"];
  for (const startWord of shuffle(startingWords)) {
    if (await isMotusAttemptInLexicon(startWord, startWord.length)) return { startWord, finalLength: 8 };
  }
  return null;
}

export function addsExactlyOnePyramidLetter(previousWord: string, nextWord: string) {
  const previous = normalizeGameWord(previousWord);
  const next = normalizeGameWord(nextWord);
  if (next.length !== previous.length + 1) return false;
  const previousLetters = new Map<string, number>();
  for (const letter of previous) previousLetters.set(letter, (previousLetters.get(letter) ?? 0) + 1);
  for (const letter of next) {
    const count = previousLetters.get(letter) ?? 0;
    if (count > 0) previousLetters.set(letter, count - 1);
  }
  if (!Array.from(previousLetters.values()).every((count) => count === 0)) return false;
  const movedLetters = Array.from(previous).filter((letter, index) => next[index] !== letter).length;
  return movedLetters >= 2 && !next.includes(previous);
}

export async function validateDailyPyramidStep(previousWord: string, nextWord: string) {
  const word = normalizeGameWord(nextWord);
  if (!addsExactlyOnePyramidLetter(previousWord, word)) return { valid: false, reason: "Utilisez toutes les lettres précédentes, ajoutez-en une et réorganisez réellement le mot." } as const;
  const valid = await isMotusAttemptInLexicon(word, word.length);
  return valid ? { valid: true, word } as const : { valid: false, reason: "Ce mot n’est pas présent dans le lexique Morphalou." } as const;
}

export async function checkDefinitionBatchMatches(pairs: Array<{ entryId: number; definitionId: number }>) {
  const db = await getDb();
  if (!db || !pairs.length) return [];
  const definitionIds = Array.from(new Set(pairs.map((pair) => pair.definitionId)));
  const rows = await db.select({ definitionId: lexicalDefinitions.id, correctEntryId: lexicalDefinitions.lexicalEntryId, correctLemma: lexicalEntries.lemma, cnrtlUrl: lexicalEntries.cnrtlUrl, sourceUrl: lexicalDefinitions.sourceUrl })
    .from(lexicalDefinitions)
    .innerJoin(lexicalEntries, eq(lexicalDefinitions.lexicalEntryId, lexicalEntries.id))
    .where(inArray(lexicalDefinitions.id, definitionIds));
  const definitions = new Map(rows.map((row) => [row.definitionId, row]));
  return pairs.map((pair) => {
    const definition = definitions.get(pair.definitionId);
    return { entryId: pair.entryId, definitionId: pair.definitionId, correct: isDefinitionMatch(pair.entryId, definition?.correctEntryId ?? -1), correctLemma: definition?.correctLemma ?? null, cnrtlUrl: definition?.cnrtlUrl ?? null, sourceUrl: definition?.sourceUrl ?? null };
  });
}

export async function checkDefinitionMatch(entryId: number, definitionId: number) {
  const [match] = await checkDefinitionBatchMatches([{ entryId, definitionId }]);
  return match ?? { correct: false, correctLemma: null, cnrtlUrl: null, sourceUrl: null };
}

type RelationKind = "synonym" | "antonym";

type RelationWord = {
  entryId: number;
  lemma: string;
  category: string | null;
  cnrtlUrl: string;
};

const relationPrefixes = ["des", "de", "dis", "re", "in", "im", "ir", "il", "anti", "contre", "non", "mal", "hyper", "hypo", "pre", "post", "sur", "sous", "auto"];

function sharedPrefixLength(a: string, b: string) {
  let length = 0;
  while (length < a.length && length < b.length && a[length] === b[length]) length += 1;
  return length;
}

export function areLexicallyTooSimilar(a: string, b: string) {
  const normalizedA = normalizeLexicalQuery(a).replace(/[^a-z]/g, "");
  const normalizedB = normalizeLexicalQuery(b).replace(/[^a-z]/g, "");
  if (!normalizedA || !normalizedB || normalizedA === normalizedB) return true;
  if (normalizedA.startsWith(normalizedB) || normalizedB.startsWith(normalizedA)) return true;
  const stems = (word: string) => new Set([word, ...relationPrefixes
    .filter((prefix) => word.startsWith(prefix) && word.length - prefix.length >= 5)
    .map((prefix) => word.slice(prefix.length))]);
  const stemsA = stems(normalizedA);
  const stemsB = stems(normalizedB);
  if (Array.from(stemsA).some((stem) => stemsB.has(stem))) return true;
  const shortest = Math.min(normalizedA.length, normalizedB.length);
  return shortest >= 5 && sharedPrefixLength(normalizedA, normalizedB) >= Math.max(4, Math.floor(shortest * 0.72));
}

function relationLabel(relation: RelationKind) {
  return relation === "synonym" ? "synonyme" : "antonyme";
}

function oppositeRelation(relation: RelationKind): RelationKind {
  return relation === "synonym" ? "antonym" : "synonym";
}

function isUsableRelationWord(word: RelationWord, sourceLemma: string, selected: RelationWord[] = []) {
  if (!word.category || word.lemma.includes(" ") || areLexicallyTooSimilar(sourceLemma, word.lemma)) return false;
  return selected.every((candidate) => !areLexicallyTooSimilar(candidate.lemma, word.lemma));
}

async function getRelationTargets(sourceEntryId: number, relation: RelationKind, category: string, sourceLemma: string) {
  const db = await getDb();
  if (!db) return [];
  const safety = sql`LOWER(${lexicalEntries.lemma}) NOT REGEXP ${publicDefinitionSafetyPattern} AND ${hasCnrtlLink}`;
  const rows = await db.select({ entryId: lexicalEntries.id, lemma: lexicalEntries.lemma, category: lexicalEntries.category, cnrtlUrl: lexicalEntries.cnrtlUrl })
    .from(lexicalRelations)
    .innerJoin(lexicalEntries, eq(lexicalRelations.targetEntryId, lexicalEntries.id))
    .where(and(eq(lexicalRelations.sourceEntryId, sourceEntryId), eq(lexicalRelations.relation, relation), eq(lexicalEntries.category, category), safety))
    .orderBy(sql`RAND()`)
    .limit(40);
  return rows
    .filter((row, index, values) => values.findIndex((candidate) => candidate.entryId === row.entryId) === index)
    .filter((row) => isUsableRelationWord(row, sourceLemma));
}

async function getCategoryRelationPool(relation: RelationKind, category: string, sourceLemma: string, selected: RelationWord[] = []) {
  const db = await getDb();
  if (!db) return [];
  const safety = sql`LOWER(${lexicalEntries.lemma}) NOT REGEXP ${publicDefinitionSafetyPattern} AND ${hasCnrtlLink}`;
  const rows = await db.select({ entryId: lexicalEntries.id, lemma: lexicalEntries.lemma, category: lexicalEntries.category, cnrtlUrl: lexicalEntries.cnrtlUrl })
    .from(lexicalRelations)
    .innerJoin(lexicalEntries, eq(lexicalRelations.targetEntryId, lexicalEntries.id))
    .where(and(eq(lexicalRelations.relation, relation), eq(lexicalEntries.category, category), safety))
    .orderBy(sql`RAND()`)
    .limit(180);
  return rows
    .filter((row, index, values) => values.findIndex((candidate) => candidate.entryId === row.entryId) === index)
    .filter((row) => isUsableRelationWord(row, sourceLemma, selected));
}

async function getRelationSources(relation: RelationKind) {
  const db = await getDb();
  if (!db) return [];
  const safety = sql`LOWER(${lexicalEntries.lemma}) NOT REGEXP ${publicDefinitionSafetyPattern} AND ${hasCnrtlLink}`;
  const rows = await db.select({ entryId: lexicalEntries.id, lemma: lexicalEntries.lemma, category: lexicalEntries.category, cnrtlUrl: lexicalEntries.cnrtlUrl })
    .from(lexicalRelations)
    .innerJoin(lexicalEntries, eq(lexicalRelations.sourceEntryId, lexicalEntries.id))
    .where(and(eq(lexicalRelations.relation, relation), isNotNull(lexicalEntries.category), safety, sql`${lexicalEntries.lemma} NOT REGEXP '[[:space:]]'`))
    .orderBy(sql`RAND()`)
    .limit(260);
  return rows
    .filter((row, index, values) => values.findIndex((candidate) => candidate.entryId === row.entryId) === index)
    .filter((row) => Boolean(row.category) && !row.lemma.includes(" "));
}

export async function getRelationChoiceRound(relation: RelationKind) {
  const sources = await getRelationSources(relation);
  for (const source of sources) {
    if (!source.category) continue;
    const correctCandidates = await getRelationTargets(source.entryId, relation, source.category, source.lemma);
    if (!correctCandidates.length) continue;
    const correct = correctCandidates[0];
    let distractors = (await getRelationTargets(source.entryId, oppositeRelation(relation), source.category, source.lemma))
      .filter((candidate) => !areLexicallyTooSimilar(correct.lemma, candidate.lemma))
      .filter((candidate, index, values) => isUsableRelationWord(candidate, source.lemma, values.slice(0, index)))
      .slice(0, 3);
    if (distractors.length < 3) {
      distractors = (await getCategoryRelationPool(oppositeRelation(relation), source.category, source.lemma, [correct]))
        .filter((candidate) => candidate.entryId !== correct.entryId)
        .slice(0, 3);
    }
    if (distractors.length < 3) continue;
    return {
      kind: relation,
      prompt: `Quel mot est un ${relationLabel(relation)} de « ${source.lemma} » ?`,
      sourceLemma: source.lemma,
      answerEntryId: correct.entryId,
      options: shuffle([correct, ...distractors].map((choice) => ({ entryId: choice.entryId, lemma: choice.lemma, cnrtlUrl: choice.cnrtlUrl }))),
      source: { name: "DBnary / Wiktionnaire", license: "CC BY-SA 3.0", url: "https://kaiko.getalp.org/about-dbnary/" },
    };
  }
  return null;
}

export async function getRelationIntruderRound() {
  const sources = await getRelationSources("synonym");
  for (const source of sources) {
    if (!source.category) continue;
    let selected = (await getRelationTargets(source.entryId, "synonym", source.category, source.lemma))
      .filter((member, index, values) => isUsableRelationWord(member, source.lemma, values.slice(0, index)))
      .slice(0, 8);
    if (selected.length < 8) {
      selected = (await getCategoryRelationPool("synonym", source.category, source.lemma, selected))
        .reduce<RelationWord[]>((accumulator, candidate) => accumulator.length >= 8 || accumulator.some((item) => item.entryId === candidate.entryId) ? accumulator : [...accumulator, candidate], selected)
        .slice(0, 8);
    }
    if (selected.length < 8) continue;
    let [intruder] = (await getRelationTargets(source.entryId, "antonym", source.category, source.lemma))
      .filter((candidate) => isUsableRelationWord(candidate, source.lemma, selected));
    if (!intruder) [intruder] = (await getCategoryRelationPool("antonym", source.category, source.lemma, selected));
    if (!intruder) continue;
    return {
      kind: "intruder" as const,
      prompt: `Quel mot rompt la série sémantique formée autour de « ${source.lemma} » ?`,
      sourceLemma: source.lemma,
      explanation: `« ${intruder.lemma} » est relié à « ${source.lemma} » comme antonyme ; les autres pistes ont été retenues parmi ses synonymes vérifiés.`,
      answerEntryId: intruder.entryId,
      options: shuffle([...selected, intruder]),
      source: { name: "DBnary / Wiktionnaire", license: "CC BY-SA 3.0", url: "https://kaiko.getalp.org/about-dbnary/" },
    };
  }
  return null;
}
