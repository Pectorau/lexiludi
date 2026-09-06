import crypto from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { soloGameSessions } from "../drizzle/schema";
import { gradeMotusGuess, normalizeGameWord } from "@shared/motus";
import { checkDefinitionBatchMatches, getDb, getDefinitionMatchRound, getRandomMotusWord, getRandomQuizChallenge, getRelationChoiceRound, getRelationIntruderRound, isMotusAttemptInLexicon, type QuizChallengeMode } from "./db";
import { recordHerbariumDiscovery } from "./herbarium";

type SoloMode = "quiz" | "motus" | "definition" | "relation";
type StoredSession = { id: string; ownerKey: string; mode: SoloMode; status: "active" | "resolved" | "abandoned" | "expired"; publicData: string; secretData: string; attempts: number; maxAttempts: number; score: number; expiresAt: Date; resolvedAt: Date | null };
type QuizPublic = { kind: QuizChallengeMode; term: string; prompt: string; choices: string[]; context: string; statementCategory?: string; source: { name: string; license: string; cnrtlUrl: string } };
type QuizSecret = { answer: string; correction: string; lemma: string };
type MotusPublic = { length: number; source: { name: string; license: string; cnrtlUrl: string }; history: Array<{ guess: string; states: Array<"exact" | "present" | "absent"> }> };
type MotusSecret = { answer: string };
type DefinitionPublic = {
  kind: "match";
  prompt: string;
  words: Array<{ entryId: number; lemma: string; cnrtlUrl: string; category: string | null }>;
  definitions: Array<{ definitionId: number; text: string }>;
  source: { name: string; license: string; url: string };
  matches: Array<{ entryId: number; definitionId: number }>;
  failedEntryIds: number[];
  attemptsByEntry: Record<string, number>;
};
type DefinitionSecret = { answers: Record<string, number> };
type RelationVariant = "synonym" | "antonym" | "intruder";
type RelationPublic = {
  kind: RelationVariant;
  prompt: string;
  sourceLemma: string;
  options: Array<{ entryId: number; lemma: string; cnrtlUrl: string }>;
  source: { name: string; license: string; url: string };
};
type RelationSecret = { answerEntryId: number; explanation: string | null };

function id() { return crypto.randomBytes(24).toString("base64url"); }
function parse<T>(text: string): T { try { return JSON.parse(text) as T; } catch { throw new Error("Session de jeu corrompue."); } }
function expiresIn(hours: number) { return new Date(Date.now() + hours * 60 * 60 * 1000); }
async function getOwnedActiveSession(ownerKey: string, sessionId: string, mode: SoloMode) {
  const db = await getDb(); if (!db) throw new Error("La persistance des sessions solo est indisponible.");
  const [session] = await db.select().from(soloGameSessions).where(and(eq(soloGameSessions.id, sessionId), eq(soloGameSessions.ownerKey, ownerKey), eq(soloGameSessions.mode, mode), gt(soloGameSessions.expiresAt, new Date()))).limit(1);
  if (!session) throw new Error("Cette manche a expiré ou ne vous appartient pas.");
  return session as StoredSession;
}
function publicQuiz(session: StoredSession) { return { sessionId: session.id, status: session.status, attempts: session.attempts, maxAttempts: session.maxAttempts, score: session.score, ...parse<QuizPublic>(session.publicData) }; }
function publicMotus(session: StoredSession) { return { sessionId: session.id, status: session.status, attempts: session.attempts, maxAttempts: session.maxAttempts, score: session.score, ...parse<MotusPublic>(session.publicData) }; }
function publicDefinition(session: StoredSession) {
  const data = parse<DefinitionPublic>(session.publicData);
  const base = { sessionId: session.id, status: session.status, attempts: session.attempts, maxAttempts: session.maxAttempts, score: session.score, ...data };
  if (session.status !== "resolved") return base;
  const secret = parse<DefinitionSecret>(session.secretData);
  return {
    ...base,
    solutions: data.words.map((word) => ({
      entryId: word.entryId,
      definitionId: secret.answers[String(word.entryId)]!,
      lemma: word.lemma,
      cnrtlUrl: word.cnrtlUrl,
    })),
  };
}
function publicRelation(session: StoredSession) {
  const data = parse<RelationPublic>(session.publicData);
  const base = { sessionId: session.id, status: session.status, attempts: session.attempts, maxAttempts: session.maxAttempts, score: session.score, ...data };
  if (session.status !== "resolved") return base;
  const secret = parse<RelationSecret>(session.secretData);
  return { ...base, answerEntryId: secret.answerEntryId, explanation: secret.explanation };
}

export async function startSoloQuiz(ownerKey: string, mode: QuizChallengeMode) {
  const challenge = await getRandomQuizChallenge(mode); if (!challenge) throw new Error("Aucun défi Quiz n’est disponible.");
  const publicData: QuizPublic = { kind: challenge.kind, term: challenge.term, prompt: challenge.prompt, choices: challenge.choices, context: challenge.context, statementCategory: challenge.statementCategory, source: challenge.source };
  const secretData: QuizSecret = { answer: challenge.answer, correction: challenge.correction, lemma: challenge.lemma };
  const db = await getDb(); if (!db) throw new Error("La persistance des sessions solo est indisponible.");
  const sessionId = id(); await db.insert(soloGameSessions).values({ id: sessionId, ownerKey, mode: "quiz", publicData: JSON.stringify(publicData), secretData: JSON.stringify(secretData), maxAttempts: 1, expiresAt: expiresIn(2) });
  return publicQuiz(await getOwnedActiveSession(ownerKey, sessionId, "quiz"));
}
export async function submitSoloQuiz(ownerKey: string, sessionId: string, choice: string) {
  const session = await getOwnedActiveSession(ownerKey, sessionId, "quiz"); if (session.status !== "active") throw new Error("Cette question est déjà résolue.");
  const secret = parse<QuizSecret>(session.secretData); const valid = choice === secret.answer; const score = valid ? 100 : 0;
  const db = await getDb(); if (!db) throw new Error("La persistance des sessions solo est indisponible.");
  const result = await db.update(soloGameSessions).set({ status: "resolved", attempts: 1, score, resolvedAt: new Date() }).where(and(eq(soloGameSessions.id, session.id), eq(soloGameSessions.status, "active")));
  if (Number((result as unknown as { rowsAffected?: number }).rowsAffected ?? 0) !== 1) throw new Error("Cette réponse a déjà été enregistrée.");
  const resolved = await getOwnedActiveSession(ownerKey, sessionId, "quiz"); return { ...publicQuiz(resolved), valid, answer: secret.answer, correction: secret.correction, lemma: secret.lemma };
}
export async function startSoloMotus(ownerKey: string, input: { minLength: number; maxLength: number; maxAttempts: number }) {
  const word = await getRandomMotusWord(input.minLength, input.maxLength); if (!word) throw new Error("Aucun mot Motus n’est disponible.");
  const publicData: MotusPublic = { length: normalizeGameWord(word.lemma).length, source: word.source, history: [] };
  const db = await getDb(); if (!db) throw new Error("La persistance des sessions solo est indisponible.");
  const sessionId = id(); await db.insert(soloGameSessions).values({ id: sessionId, ownerKey, mode: "motus", publicData: JSON.stringify(publicData), secretData: JSON.stringify({ answer: normalizeGameWord(word.lemma) } satisfies MotusSecret), maxAttempts: input.maxAttempts, expiresAt: expiresIn(6) });
  return publicMotus(await getOwnedActiveSession(ownerKey, sessionId, "motus"));
}
export async function submitSoloMotus(ownerKey: string, sessionId: string, word: string) {
  const session = await getOwnedActiveSession(ownerKey, sessionId, "motus"); if (session.status !== "active") throw new Error("Cette grille est déjà résolue.");
  const publicData = parse<MotusPublic>(session.publicData); const secret = parse<MotusSecret>(session.secretData); const guess = normalizeGameWord(word);
  if (guess.length !== publicData.length) throw new Error(`Le mot doit contenir ${publicData.length} lettres.`); if (!await isMotusAttemptInLexicon(guess, publicData.length)) throw new Error("Ce mot n’est pas dans le lexique autorisé.");
  const states = gradeMotusGuess(guess, secret.answer); if (!states) throw new Error("Impossible de corriger cette proposition."); const nextAttempts = session.attempts + 1; const valid = guess === secret.answer; const lost = !valid && nextAttempts >= session.maxAttempts; const status = valid || lost ? "resolved" as const : "active" as const;
  publicData.history.push({ guess, states }); const score = valid ? Math.max(10, (session.maxAttempts - nextAttempts + 1) * 20) : 0;
  const db = await getDb(); if (!db) throw new Error("La persistance des sessions solo est indisponible.");
  const result = await db.update(soloGameSessions).set({ publicData: JSON.stringify(publicData), attempts: nextAttempts, score, status, resolvedAt: status === "resolved" ? new Date() : null }).where(and(eq(soloGameSessions.id, session.id), eq(soloGameSessions.status, "active"), eq(soloGameSessions.attempts, session.attempts)));
  if (Number((result as unknown as { rowsAffected?: number }).rowsAffected ?? 0) !== 1) throw new Error("Cette proposition a déjà été traitée. Actualisez la grille.");
  const updated = await getOwnedActiveSession(ownerKey, sessionId, "motus"); return { ...publicMotus(updated), valid, answer: status === "resolved" ? secret.answer : undefined };
}

async function buildDefinitionAnswers(data: Pick<DefinitionPublic, "words" | "definitions">) {
  const pairs = data.words.flatMap((word) => data.definitions.map((definition) => ({ entryId: word.entryId, definitionId: definition.definitionId })));
  const checked = await checkDefinitionBatchMatches(pairs);
  const answers = Object.fromEntries(checked.filter((pair) => pair.correct).map((pair) => [String(pair.entryId), pair.definitionId]));
  if (Object.keys(answers).length !== data.words.length) throw new Error("La fiche de définitions ne peut pas être sécurisée.");
  return answers;
}

export async function startSoloDefinitionMatch(ownerKey: string) {
  const round = await getDefinitionMatchRound();
  if (!round) throw new Error("Les définitions ne sont pas disponibles pour le moment.");
  const publicData: DefinitionPublic = { kind: "match", prompt: round.prompt, words: round.words, definitions: round.definitions, source: round.source, matches: [], failedEntryIds: [], attemptsByEntry: {} };
  const secretData: DefinitionSecret = { answers: await buildDefinitionAnswers(publicData) };
  const db = await getDb(); if (!db) throw new Error("La persistance des sessions solo est indisponible.");
  const sessionId = id();
  await db.insert(soloGameSessions).values({ id: sessionId, ownerKey, mode: "definition", publicData: JSON.stringify(publicData), secretData: JSON.stringify(secretData), maxAttempts: publicData.words.length * 2, expiresAt: expiresIn(2) });
  return publicDefinition(await getOwnedActiveSession(ownerKey, sessionId, "definition"));
}

export async function submitSoloDefinitionMatch(ownerKey: string, sessionId: string, input: { entryId: number; definitionId: number }) {
  const session = await getOwnedActiveSession(ownerKey, sessionId, "definition");
  if (session.status !== "active") throw new Error("Cette fiche est déjà résolue.");
  const data = parse<DefinitionPublic>(session.publicData);
  const secret = parse<DefinitionSecret>(session.secretData);
  if (!data.words.some((word) => word.entryId === input.entryId) || !data.definitions.some((definition) => definition.definitionId === input.definitionId)) throw new Error("Cette association ne fait pas partie de la fiche en cours.");
  if (data.matches.some((match) => match.entryId === input.entryId) || data.failedEntryIds.includes(input.entryId)) throw new Error("Ce mot a déjà reçu sa correction.");
  if (data.matches.some((match) => match.definitionId === input.definitionId)) throw new Error("Cet indice est déjà relié.");
  const priorAttempts = data.attemptsByEntry[String(input.entryId)] ?? 0;
  if (priorAttempts >= 2) throw new Error("Les deux tentatives pour ce mot ont déjà été utilisées.");

  const valid = secret.answers[String(input.entryId)] === input.definitionId;
  const nextAttempts = session.attempts + 1;
  data.attemptsByEntry[String(input.entryId)] = priorAttempts + 1;
  if (valid) data.matches.push({ entryId: input.entryId, definitionId: input.definitionId });
  else if (priorAttempts + 1 >= 2) data.failedEntryIds.push(input.entryId);
  const resolved = data.matches.length + data.failedEntryIds.length === data.words.length;
  const score = session.score + (valid ? (priorAttempts === 0 ? 25 : 10) : 0);
  const db = await getDb(); if (!db) throw new Error("La persistance des sessions solo est indisponible.");
  const result = await db.update(soloGameSessions).set({ publicData: JSON.stringify(data), attempts: nextAttempts, score, status: resolved ? "resolved" : "active", resolvedAt: resolved ? new Date() : null }).where(and(eq(soloGameSessions.id, session.id), eq(soloGameSessions.status, "active"), eq(soloGameSessions.attempts, session.attempts)));
  if (Number((result as unknown as { rowsAffected?: number }).rowsAffected ?? 0) !== 1) throw new Error("Cette association a déjà été traitée. Actualisez la fiche.");
  const updated = await getOwnedActiveSession(ownerKey, sessionId, "definition");
  return { ...publicDefinition(updated), valid, canRetry: !valid && !resolved && priorAttempts === 0 };
}

export async function startSoloRelation(ownerKey: string, variant: RelationVariant) {
  const round = variant === "intruder" ? await getRelationIntruderRound() : await getRelationChoiceRound(variant);
  if (!round) throw new Error("Aucune relation lexicale adaptée n’est disponible pour le moment.");
  const publicData: RelationPublic = { kind: round.kind, prompt: round.prompt, sourceLemma: round.sourceLemma, options: round.options, source: round.source };
  const secretData: RelationSecret = { answerEntryId: round.answerEntryId, explanation: "explanation" in round ? round.explanation : null };
  const db = await getDb(); if (!db) throw new Error("La persistance des sessions solo est indisponible.");
  const sessionId = id();
  await db.insert(soloGameSessions).values({ id: sessionId, ownerKey, mode: "relation", publicData: JSON.stringify(publicData), secretData: JSON.stringify(secretData), maxAttempts: 2, expiresAt: expiresIn(2) });
  return publicRelation(await getOwnedActiveSession(ownerKey, sessionId, "relation"));
}

export async function submitSoloRelation(ownerKey: string, sessionId: string, input: { entryId: number; useSecondChance: boolean }) {
  const session = await getOwnedActiveSession(ownerKey, sessionId, "relation");
  if (session.status !== "active") throw new Error("Cette nuance est déjà résolue.");
  const data = parse<RelationPublic>(session.publicData);
  const secret = parse<RelationSecret>(session.secretData);
  if (!data.options.some((option) => option.entryId === input.entryId)) throw new Error("Cette étiquette ne fait pas partie de la nuance en cours.");
  const valid = input.entryId === secret.answerEntryId;
  const nextAttempts = session.attempts + 1;
  const resolved = valid || !input.useSecondChance || nextAttempts >= session.maxAttempts;
  const score = valid ? (session.attempts === 0 ? 100 : 60) : 0;
  const db = await getDb(); if (!db) throw new Error("La persistance des sessions solo est indisponible.");
  const result = await db.update(soloGameSessions).set({ attempts: nextAttempts, score, status: resolved ? "resolved" : "active", resolvedAt: resolved ? new Date() : null }).where(and(eq(soloGameSessions.id, session.id), eq(soloGameSessions.status, "active"), eq(soloGameSessions.attempts, session.attempts)));
  if (Number((result as unknown as { rowsAffected?: number }).rowsAffected ?? 0) !== 1) throw new Error("Cette proposition a déjà été traitée. Actualisez la nuance.");
  const updated = await getOwnedActiveSession(ownerKey, sessionId, "relation");
  const discovery = valid && data.kind === "intruder"
    ? await recordHerbariumDiscovery({ ownerKey, lexicalEntryId: secret.answerEntryId, sourceMode: "intrus" })
    : null;
  return { ...publicRelation(updated), valid, canRetry: !valid && !resolved, discovery };
}

export async function getSoloSession(ownerKey: string, sessionId: string, mode: SoloMode) {
  const session = await getOwnedActiveSession(ownerKey, sessionId, mode);
  if (mode === "quiz") return publicQuiz(session);
  if (mode === "motus") return publicMotus(session);
  if (mode === "definition") return publicDefinition(session);
  return publicRelation(session);
}
