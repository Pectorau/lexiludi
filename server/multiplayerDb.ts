import { randomUUID } from "crypto";
import { and, asc, count, desc, eq, gt, isNull, lt, sql } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import { multiplayerJokerUses, multiplayerPlayerRewards, multiplayerPlayers, multiplayerRoomEvents, multiplayerRooms, multiplayerRounds, multiplayerSubmissions, multiplayerTacticalBids, multiplayerTacticalContracts, multiplayerTradeOffers } from "../drizzle/schema";
import { gradeMotusGuess, normalizeGameWord } from "./game";
import { checkDefinitionMatch, getDb, getDefinitionMatchRound, getRandomGrammarQuiz, getRandomMotusWord, getRandomQuizChallenge, getRelationChoiceRound, getRelationIntruderRound, isMotusAttemptInLexicon, type QuizChallenge } from "./db";
import { isDefinitionPublicSafe } from "./definitionGame";
import { createFogEffect, defaultJokerDeck, fogDurationMilliseconds, getMotusPoints, getQuizPoints, isDefinitionVariant, isFogEffectActive, isJokerCompatibleWithGame, isMotusVariant, isMultiplayerRoundDuration, isMultiplayerRoundLimit, isPeekEffectActive, isQuizVariant, isRoomVisibility, isShieldEffectActive, makeRoomCode, motusMultiplayerFormats, normalizeJokerDeck, peekDurationMilliseconds, shieldDurationMilliseconds, type MultiplayerGameMode, type MultiplayerJoker, type RoomVisibility } from "./multiplayer";

type RoomRecord = typeof multiplayerRooms.$inferSelect;
type PlayerRecord = typeof multiplayerPlayers.$inferSelect;
type RoundRecord = typeof multiplayerRounds.$inferSelect;
type JokerUseRecord = typeof multiplayerJokerUses.$inferSelect;
type TradeOfferRecord = typeof multiplayerTradeOffers.$inferSelect;
type TacticalContractRecord = typeof multiplayerTacticalContracts.$inferSelect;

const TRADE_TIMEOUT_MS = 8_000;
const TRADE_COOLDOWN_MS = 5_000;
const TACTICAL_CONTRACT_TIMEOUT_MS = 15_000;
const RESUME_TOKEN_TTL_MS = 1000 * 60 * 60 * 24;

function hashResumeToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function createResumeToken() {
  return randomBytes(32).toString("base64url");
}

export const multiplayerArchetypes = ["cryptographer", "berserker", "banker", "necromancer"] as const;
export type MultiplayerArchetype = (typeof multiplayerArchetypes)[number];

export function getMultiplayerManaCap(archetype: MultiplayerArchetype) {
  return archetype === "banker" ? 120 : 100;
}

async function refreshPlayerMana(player: PlayerRecord) {
  if (player.archetype !== "banker" || player.mana >= getMultiplayerManaCap(player.archetype)) return player;
  const elapsedSeconds = Math.floor((Date.now() - player.manaUpdatedAt.getTime()) / 1_000);
  if (elapsedSeconds < 1) return player;
  const mana = Math.min(getMultiplayerManaCap(player.archetype), player.mana + elapsedSeconds * 2);
  const manaUpdatedAt = new Date();
  const db = await getDb();
  if (!db) return player;
  await db.update(multiplayerPlayers).set({ mana, manaUpdatedAt }).where(eq(multiplayerPlayers.id, player.id));
  return { ...player, mana, manaUpdatedAt };
}

function asInsertId(result: unknown) {
  return Number((result as [{ insertId?: number }])[0]?.insertId ?? 0);
}

function asAffectedRows(result: unknown) {
  return Number((result as [{ affectedRows?: number }])[0]?.affectedRows ?? 0);
}

function parseData(value: string) {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export const tacticalContractTypes = ["letter", "cryptohint", "mana"] as const;
export type TacticalContractType = (typeof tacticalContractTypes)[number];

export function isTacticalBidValid(input: { bid: number; minimumBid: number; currentHighestBid: number; availableMana: number }) {
  return Number.isInteger(input.bid) && input.bid >= input.minimumBid && input.bid > input.currentHighestBid && input.bid <= input.availableMana;
}

function buildCryptoHint(letter: string) {
  const upper = normalizeTradeLetter(letter);
  if (!upper) return null;
  const vowels = new Set(["A", "E", "I", "O", "U", "Y"]);
  const elite = new Set(["J", "Q", "K", "W", "X", "Y", "Z"]);
  const rare = new Set(["B", "C", "D", "F", "G", "H", "M", "P", "V"]);
  return { isVowel: vowels.has(upper), alphabetHalf: upper <= "M" ? "A-M" : "N-Z", scrabbleTier: elite.has(upper) ? "élite" : rare.has(upper) ? "rare" : "commune" };
}

export function normalizeTradeLetter(value: string) {
  const normalized = normalizeGameWord(value);
  return /^[a-z]$/.test(normalized) ? normalized.toLocaleUpperCase("fr-FR") : null;
}

function cleanNickname(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 30) || "Joueur";
}

function cleanRoomTitle(value: string, fallbackNickname: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 60) || `Salon de ${cleanNickname(fallbackNickname)}`;
}

export function isHardcoreCompatible(input: { isHardcore: boolean; roundDurationSeconds: number }) {
  return !input.isHardcore || input.roundDurationSeconds > 0;
}

export function canJoinMultiplayerLobby(input: { status: RoomRecord["status"]; playerCount: number }) {
  return input.status === "lobby" && input.playerCount >= 0 && input.playerCount < 8;
}

export function canStartMultiplayerRound(input: { isHost: boolean; playerCount: number }) {
  return input.isHost && input.playerCount >= 2;
}

export function canAdvanceMultiplayerRound(input: { status: RoomRecord["status"]; currentRoundIndex: number; roundLimit: number }) {
  return input.status === "active" && input.currentRoundIndex >= 1 && input.currentRoundIndex <= input.roundLimit;
}

export function canContinueMultiplayerRound(input: {
  room: Pick<RoomRecord, "status" | "currentRoundIndex" | "roundLimit">;
  expectedRoundId: number;
  latestRound: Pick<RoundRecord, "id" | "position" | "status"> | null;
}) {
  return canAdvanceMultiplayerRound(input.room)
    && input.latestRound?.id === input.expectedRoundId
    && input.latestRound.position === input.room.currentRoundIndex
    && (input.latestRound.status === "active" || input.latestRound.status === "resolved");
}

/** La contrainte SQL est unique par manche, joueur et tentative : l'index ne peut donc jamais rester à 1 après le premier essai. */
export function getNextMultiplayerAttemptIndex(playerId: number, submissions: Array<{ playerId: number }>) {
  return submissions.filter((submission) => submission.playerId === playerId).length + 1;
}

async function requireHost(room: RoomRecord, resumeToken: string) {
  const { player } = await requirePlayer(room.id, resumeToken);
  if (!player.isHost) throw new Error("Seul l’hôte peut modifier ce salon.");
  return player;
}

async function requireRoom(code: string) {
  const db = await getDb();
  if (!db) throw new Error("La base de données est indisponible.");
  const [room] = await db.select().from(multiplayerRooms).where(eq(multiplayerRooms.code, code.toUpperCase())).limit(1);
  if (!room) throw new Error("Code de salon introuvable ou expiré.");
  return { db, room };
}

async function requirePlayer(roomId: number, token: string) {
  const db = await getDb();
  if (!db) throw new Error("La base de données est indisponible.");
  const [player] = await db.select().from(multiplayerPlayers).where(and(eq(multiplayerPlayers.roomId, roomId), eq(multiplayerPlayers.resumeTokenHash, hashResumeToken(token)), gt(multiplayerPlayers.resumeTokenExpiresAt, new Date()))).limit(1);
  if (!player) throw new Error("Votre accès à ce salon n’est plus valide.");
  return { db, player };
}

async function recordRoomEvent(input: { roomId: number; roundId?: number | null; playerId?: number | null; eventType: string; summary: string; effect?: Record<string, unknown> | null }) {
  const db = await getDb();
  if (!db) return;
  await db.insert(multiplayerRoomEvents).values({ roomId: input.roomId, roundId: input.roundId ?? null, playerId: input.playerId ?? null, eventType: input.eventType, summary: input.summary.slice(0, 240), effect: input.effect ? JSON.stringify(input.effect) : null });
}

export async function getMultiplayerRoomPreview(code: string) {
  const db = await getDb();
  if (!db) throw new Error("La base de données est indisponible.");
  const [room] = await db.select().from(multiplayerRooms).where(eq(multiplayerRooms.code, code.toUpperCase())).limit(1);
  if (!room) return { exists: false as const, code: code.toUpperCase(), reason: "Code de salon introuvable ou expiré." };
  const [total] = await db.select({ value: count() }).from(multiplayerPlayers).where(eq(multiplayerPlayers.roomId, room.id));
  const players = Number(total?.value ?? 0);
  const reason = room.status === "finished" ? "Cette table est terminée." : room.status !== "lobby" ? "La partie a déjà commencé : demandez une nouvelle invitation." : players >= 8 ? "Cette table a déjà atteint sa capacité de 8 joueurs." : null;
  return { exists: true as const, code: room.code, title: room.title, gameMode: room.gameMode, variant: room.variant, visibility: room.visibility, status: room.status, players, capacity: 8, roundLimit: room.roundLimit, roundDurationSeconds: room.roundDurationSeconds, showSubmissions: Boolean(room.showSubmissions), canJoin: !reason, reason };
}

async function getLatestRound(roomId: number) {
  const db = await getDb();
  if (!db) throw new Error("La base de données est indisponible.");
  const [round] = await db.select().from(multiplayerRounds).where(eq(multiplayerRounds.roomId, roomId)).orderBy(desc(multiplayerRounds.startedAt), desc(multiplayerRounds.id)).limit(1);
  return round;
}

async function getActiveRound(roomId: number) {
  const db = await getDb();
  if (!db) throw new Error("La base de données est indisponible.");
  const [round] = await db.select().from(multiplayerRounds).where(and(eq(multiplayerRounds.roomId, roomId), eq(multiplayerRounds.status, "active"))).orderBy(desc(multiplayerRounds.position)).limit(1);
  if (!round) throw new Error("Aucune manche active dans ce salon.");
  if (round.endsAt && round.endsAt.getTime() <= Date.now()) {
    await db.update(multiplayerRounds).set({ status: "resolved", resolvedAt: new Date() })
      .where(and(eq(multiplayerRounds.id, round.id), eq(multiplayerRounds.status, "active")));
    throw new Error("Le temps de cette manche est écoulé.");
  }
  return round;
}

function parseJokerEffect(value: string | null) {
  return value ? parseData(value) : null;
}

const jokerLabels: Record<MultiplayerJoker, string> = {
  compass: "Boussole", tempo: "Tempo", second_chance: "Seconde chance", fog: "Brouillard", shield: "Parade",
  bonus_attempt: "Essai bonus", random_letter: "Lettre au hasard", peek: "Aperçu", opponent_progress: "Radar adverse",
  exact_letter: "Lettre placée", mana_siphon: "Siphon énergétique", blackout: "Blackout", overclock: "Overclock", curse_trap: "Piège maudit", trade_letter: "Échange de lettres",
};

function roomJokerDeck(_room: RoomRecord) {
  // Les jokers tactiques sont retirés du multijoueur : aucun nouveau tirage ni effet.
  return [] as MultiplayerJoker[];
}

async function grantRandomJoker(roomId: number, playerId: number, deck: MultiplayerJoker[]) {
  const db = await getDb();
  if (!db || !deck.length) return;
  const joker = deck[Math.floor(Math.random() * deck.length)]!;
  const available = await db.select({ id: multiplayerPlayerRewards.id, joker: multiplayerPlayerRewards.joker })
    .from(multiplayerPlayerRewards)
    .where(and(eq(multiplayerPlayerRewards.roomId, roomId), eq(multiplayerPlayerRewards.playerId, playerId), isNull(multiplayerPlayerRewards.consumedRoundId)))
    .orderBy(asc(multiplayerPlayerRewards.grantedAt));
  const replaced = available.length >= 3 ? available[0] : null;
  if (replaced) {
    await db.update(multiplayerPlayerRewards).set({ joker, grantedAt: new Date(), consumedRoundId: null }).where(eq(multiplayerPlayerRewards.id, replaced.id));
  } else {
    await db.insert(multiplayerPlayerRewards).values({ roomId, playerId, joker });
  }
  const message = replaced
    ? `Le dé vous donne « ${jokerLabels[joker]} » : il remplace « ${jokerLabels[replaced.joker]} » dans votre réserve (3 maximum).`
    : `Le dé vous donne « ${jokerLabels[joker]} ». Votre réserve compte maintenant ${available.length + 1}/3 joker${available.length ? "s" : ""}.`;
  await db.update(multiplayerPlayers).set({ lastRewardMessage: message }).where(eq(multiplayerPlayers.id, playerId));
}

async function expireTradeOffers(roundId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(multiplayerTradeOffers)
    .set({ status: "expired", respondedAt: new Date() })
    .where(and(eq(multiplayerTradeOffers.roundId, roundId), eq(multiplayerTradeOffers.status, "pending"), lt(multiplayerTradeOffers.expiresAt, new Date())));
}

async function getKnownMotusLetters(roundId: number, playerId: number) {
  const db = await getDb();
  if (!db) return new Set<string>();
  const known = new Set<string>();
  const submissions = await db.select({ payload: multiplayerSubmissions.payload, feedback: multiplayerSubmissions.feedback })
    .from(multiplayerSubmissions)
    .where(and(eq(multiplayerSubmissions.roundId, roundId), eq(multiplayerSubmissions.playerId, playerId)));
  submissions.forEach((submission) => {
    const feedback = submission.feedback ? parseData(submission.feedback) : [];
    if (!Array.isArray(feedback)) return;
    Array.from(submission.payload).forEach((letter, index) => {
      if (feedback[index] === "exact" || feedback[index] === "present") known.add(letter.toLocaleUpperCase("fr-FR"));
    });
  });
  const ownJokers = await db.select({ joker: multiplayerJokerUses.joker, effect: multiplayerJokerUses.effect })
    .from(multiplayerJokerUses)
    .where(and(eq(multiplayerJokerUses.roundId, roundId), eq(multiplayerJokerUses.playerId, playerId)));
  ownJokers.forEach((jokerUse) => {
    const effect = parseJokerEffect(jokerUse.effect);
    if (jokerUse.joker === "random_letter" || jokerUse.joker === "exact_letter") {
      const letter = normalizeTradeLetter(String(effect?.letter ?? ""));
      if (letter) known.add(letter);
    }
  });
  const acceptedTrades = await db.select().from(multiplayerTradeOffers)
    .where(and(eq(multiplayerTradeOffers.roundId, roundId), eq(multiplayerTradeOffers.status, "accepted")));
  acceptedTrades.forEach((offer) => {
    if (offer.fromPlayerId === playerId && offer.requestedLetter && offer.requestedLetter !== "?") known.add(offer.requestedLetter);
    if (offer.toPlayerId === playerId && offer.offeredLetter) known.add(offer.offeredLetter);
  });
  return known;
}

async function publicRound(
  round: RoundRecord,
  submissions: Array<typeof multiplayerSubmissions.$inferSelect>,
  jokerUses: JokerUseRecord[],
  tradeOffers: TradeOfferRecord[],
  viewerId: number,
  playerNames: Map<number, string>,
  showSubmissions: boolean,
) {
  const data = parseData(round.publicData);
  const mySubmissions = submissions
    .filter((submission) => submission.playerId === viewerId)
    .map((submission) => ({ payload: submission.payload, feedback: submission.feedback ? parseData(submission.feedback) : null, isCorrect: Boolean(submission.isCorrect), points: submission.points, attemptIndex: submission.attemptIndex }));
  const solvedCount = new Set(submissions.filter((submission) => submission.isCorrect).map((submission) => submission.playerId)).size;
  const isMotus = "attempts" in data;
  const canReveal = round.status === "resolved";
  const solvedPlayerIds = new Set(submissions.filter((submission) => submission.isCorrect).map((submission) => submission.playerId));
  const canWatchOpponents = isMotus && !canReveal && solvedPlayerIds.has(viewerId);
  const otherSubmissions = showSubmissions
    || canWatchOpponents
    ? submissions
      .filter((submission) => submission.playerId !== viewerId && (showSubmissions || !solvedPlayerIds.has(submission.playerId)))
      .map((submission) => ({
        playerId: submission.playerId,
        nickname: playerNames.get(submission.playerId) ?? "Joueur",
        payload: submission.payload,
        feedback: submission.feedback ? parseData(submission.feedback) : null,
        isCorrect: Boolean(submission.isCorrect),
        points: submission.points,
        attemptIndex: submission.attemptIndex,
      }))
    : [];
  const myJokers = jokerUses
    .filter((use) => use.playerId === viewerId)
    .map((use) => ({ joker: use.joker, effect: parseJokerEffect(use.effect), createdAt: use.createdAt }));
  const activePeek = myJokers.find((use) => use.joker === "peek" && isPeekEffectActive(use.effect));
  const peekTargetId = Number(activePeek?.effect?.targetPlayerId ?? 0);
  const peekSubmission = peekTargetId > 0
    ? submissions.filter((submission) => submission.playerId === peekTargetId).at(-1)
    : null;
  const incomingFog = jokerUses
    .map((use) => ({ use, effect: parseJokerEffect(use.effect) }))
    .find(({ effect }) => isFogEffectActive(effect, viewerId));
  const incomingTrade = round.status === "active"
    ? tradeOffers.find((offer) => offer.toPlayerId === viewerId && offer.status === "pending" && offer.expiresAt.getTime() > Date.now()) ?? null
    : null;
  const outgoingTrade = round.status === "active"
    ? tradeOffers.find((offer) => offer.fromPlayerId === viewerId && offer.status === "pending" && offer.expiresAt.getTime() > Date.now()) ?? null
    : null;
  const tradeLetters = tradeOffers
    .filter((offer) => offer.status === "accepted" && (offer.fromPlayerId === viewerId || offer.toPlayerId === viewerId))
    .map((offer) => offer.fromPlayerId === viewerId ? offer.requestedLetter : offer.offeredLetter)
    .filter((letter, index, values) => values.indexOf(letter) === index);
  const tempoUses = jokerUses
    .filter((use) => use.joker === "tempo")
    .map((use) => ({ playerId: use.playerId, nickname: playerNames.get(use.playerId) ?? "Joueur", createdAt: use.createdAt }));
  const revealedDefinitionSolutions: Array<{ entryId: number; definitionId: number; lemma: string; text: string; cnrtlUrl?: string }> = [];
  if (canReveal && Array.isArray(data.words) && Array.isArray(data.definitions)) {
    const words = data.words as Array<{ entryId?: number; lemma?: string; cnrtlUrl?: string }>;
    const definitions = data.definitions as Array<{ definitionId?: number; text?: string }>;
    for (const word of words) {
      if (!word.entryId || !word.lemma) continue;
      for (const definition of definitions) {
        if (!definition.definitionId || !definition.text) continue;
        const match = await checkDefinitionMatch(word.entryId, definition.definitionId);
        if (!match.correct) continue;
        const solution = buildRevealedDefinitionSolution({ entryId: word.entryId, lemma: word.lemma, cnrtlUrl: word.cnrtlUrl }, { definitionId: definition.definitionId, text: definition.text });
        if (solution) revealedDefinitionSolutions.push(solution);
        break;
      }
    }
  }
  const relationAnswer = data.kind === "relation" && Array.isArray(data.options)
    ? (data.options as Array<{ entryId?: number; lemma?: string }>).find((option) => option.entryId === Number(round.answerKey))?.lemma ?? null
    : null;
  const mayConsultCnrtl = canReveal || (Array.isArray(data.choices) && mySubmissions.length > 0);

  return {
    id: round.id,
    position: round.position,
    status: round.status,
    prompt: round.prompt,
    data,
    sourceCnrtlUrl: mayConsultCnrtl ? round.sourceCnrtlUrl : null,
    revealedAnswer: canReveal ? relationAnswer ?? round.answerKey : null,
    submissionsCount: submissions.length,
    solvedCount,
    mySubmissions,
    otherSubmissions,
    canWatchOpponents,
    myJokers,
    peek: activePeek && peekSubmission ? {
      endsAt: String(activePeek.effect?.endsAt),
      targetPlayerId: peekTargetId,
      targetNickname: String(activePeek.effect?.targetNickname ?? "Un adversaire"),
      payload: peekSubmission.payload,
      feedback: peekSubmission.feedback ? parseData(peekSubmission.feedback) : null,
      isCorrect: Boolean(peekSubmission.isCorrect),
    } : null,
    incomingFog: incomingFog ? {
      endsAt: String(incomingFog.effect?.endsAt),
      sourceNickname: playerNames.get(incomingFog.use.playerId) ?? "Un adversaire",
    } : null,
    incomingTrade: incomingTrade ? {
      id: incomingTrade.id,
      fromPlayerId: incomingTrade.fromPlayerId,
      fromNickname: playerNames.get(incomingTrade.fromPlayerId) ?? "Un adversaire",
      offeredLetter: incomingTrade.offeredLetter,
      requestedLetter: incomingTrade.requestedLetter,
      expiresAt: incomingTrade.expiresAt.toISOString(),
    } : null,
    outgoingTrade: outgoingTrade ? {
      id: outgoingTrade.id,
      toPlayerId: outgoingTrade.toPlayerId,
      toNickname: playerNames.get(outgoingTrade.toPlayerId) ?? "Un adversaire",
      offeredLetter: outgoingTrade.offeredLetter,
      expiresAt: outgoingTrade.expiresAt.toISOString(),
    } : null,
    tradeLetters,
    tempoUses,
    definitionSolutions: revealedDefinitionSolutions,
    startedAt: round.startedAt,
    endsAt: round.endsAt,
  };
}

function roomSettings(room: RoomRecord) {
  return {
    roundLimit: room.roundLimit,
    roundDurationSeconds: room.roundDurationSeconds,
    showSubmissions: Boolean(room.showSubmissions),
    isHardcore: Boolean(room.isHardcore),
    allowedJokers: roomJokerDeck(room),
  };
}

function validateRoomSettings(input: { roundLimit: number; roundDurationSeconds: number; isHardcore?: boolean }) {
  if (!isMultiplayerRoundLimit(input.roundLimit)) throw new Error("Le nombre de manches choisi est invalide.");
  if (!isMultiplayerRoundDuration(input.roundDurationSeconds)) throw new Error("La durée de manche choisie est invalide.");
  if (!isHardcoreCompatible({ isHardcore: Boolean(input.isHardcore), roundDurationSeconds: input.roundDurationSeconds })) throw new Error("Le mode hardcore nécessite une durée de manche.");
}

export function buildMultiplayerGenderRound(quiz: QuizChallenge) {
  if (quiz.kind !== "gender") throw new Error("Une manche Genre requiert une question de genre grammatical.");
  return {
    prompt: quiz.prompt,
    publicData: { variant: "gender", lemma: quiz.lemma, context: quiz.context, choices: quiz.choices },
    answerKey: quiz.answer,
    sourceCnrtlUrl: quiz.source.cnrtlUrl,
  };
}

export function buildRevealedDefinitionSolution(word: { entryId: number; lemma: string; cnrtlUrl?: string }, definition: { definitionId: number; text: string }) {
  if (!isDefinitionPublicSafe(word.lemma, definition.text)) return null;
  return { entryId: word.entryId, definitionId: definition.definitionId, lemma: word.lemma, text: definition.text, cnrtlUrl: word.cnrtlUrl };
}

async function resolveExpiredRound(roomId: number) {
  const db = await getDb();
  if (!db) throw new Error("La base de données est indisponible.");
  const [round] = await db.select().from(multiplayerRounds)
    .where(and(eq(multiplayerRounds.roomId, roomId), eq(multiplayerRounds.status, "active")))
    .orderBy(desc(multiplayerRounds.position), desc(multiplayerRounds.id)).limit(1);
  if (round?.endsAt && round.endsAt.getTime() <= Date.now()) {
    const resolved = await db.update(multiplayerRounds).set({ status: "resolved", resolvedAt: new Date() })
      .where(and(eq(multiplayerRounds.id, round.id), eq(multiplayerRounds.status, "active")));
    if (asAffectedRows(resolved)) {
      await recordRoomEvent({ roomId, roundId: round.id, eventType: "round_expired", summary: `Manche ${round.position} terminée : le temps est écoulé.` });
      return true;
    }
  }
  return false;
}

export async function createMultiplayerRoom(input: { gameMode: MultiplayerGameMode; variant: string; nickname: string; title: string; visibility: RoomVisibility; roundLimit: number; roundDurationSeconds: number; showSubmissions: boolean; isHardcore: boolean; allowedJokers?: string[] }) {
  const db = await getDb();
  if (!db) throw new Error("La base de données est indisponible.");
  const validVariant = input.gameMode === "quiz" ? isQuizVariant(input.variant) : input.gameMode === "motus" ? isMotusVariant(input.variant) : isDefinitionVariant(input.variant);
  if (!validVariant) throw new Error("Cette variante de jeu est invalide.");
  validateRoomSettings(input);
  if (!isRoomVisibility(input.visibility)) throw new Error("La visibilité choisie est invalide.");
  const allowedJokers: MultiplayerJoker[] = [];

  let roomId = 0;
  let code = "";
  for (let attempt = 0; attempt < 8; attempt += 1) {
    code = makeRoomCode();
    try {
      const result = await db.insert(multiplayerRooms).values({
        code,
        title: cleanRoomTitle(input.title, input.nickname),
        visibility: input.visibility,
        gameMode: input.gameMode,
        variant: input.variant,
        roundLimit: input.roundLimit,
        roundDurationSeconds: input.roundDurationSeconds,
        isHardcore: input.isHardcore ? 1 : 0,
        showSubmissions: input.showSubmissions ? 1 : 0,
        allowedJokers: JSON.stringify(allowedJokers),
        playerCount: 1,
      });
      roomId = asInsertId(result);
      if (roomId) break;
    } catch {
      // Une collision de code est improbable : le prochain essai génère un nouveau code.
    }
  }
  if (!roomId) throw new Error("Impossible de créer un code de salon. Réessayez.");

  const resumeToken = createResumeToken();
  const playerId = await db.transaction(async (tx) => {
    const playerResult = await tx.insert(multiplayerPlayers).values({ roomId, nickname: cleanNickname(input.nickname), resumeTokenHash: hashResumeToken(resumeToken), resumeTokenExpiresAt: new Date(Date.now() + RESUME_TOKEN_TTL_MS), isHost: 1 });
    const createdPlayerId = asInsertId(playerResult);
    await tx.update(multiplayerRooms).set({ hostPlayerId: createdPlayerId }).where(eq(multiplayerRooms.id, roomId));
    return createdPlayerId;
  });
  return { code, resumeToken, playerId };
}

export async function joinMultiplayerRoom(input: { code: string; nickname: string }) {
  const { db, room } = await requireRoom(input.code);
  const nickname = cleanNickname(input.nickname);
  const resumeToken = createResumeToken();
  let playerId = 0;
  try {
    playerId = await db.transaction(async (tx) => {
      const claimed = await tx.update(multiplayerRooms)
        .set({ playerCount: sql`${multiplayerRooms.playerCount} + 1` })
        .where(and(eq(multiplayerRooms.id, room.id), eq(multiplayerRooms.status, "lobby"), lt(multiplayerRooms.playerCount, 8)));
      if (!asAffectedRows(claimed)) throw new Error("JOIN_NOT_AVAILABLE");
      const result = await tx.insert(multiplayerPlayers).values({ roomId: room.id, nickname, resumeTokenHash: hashResumeToken(resumeToken), resumeTokenExpiresAt: new Date(Date.now() + RESUME_TOKEN_TTL_MS) });
      return asInsertId(result);
    });
  } catch (error) {
    if (error instanceof Error && error.message === "JOIN_NOT_AVAILABLE") {
      const { room: currentRoom } = await requireRoom(input.code);
      throw new Error(currentRoom.status === "finished" ? "Ce salon est terminé." : currentRoom.status !== "lobby" ? "La partie a déjà commencé : rejoignez la prochaine partie." : "Ce salon est complet.");
    }
    const code = (error as { code?: string } | null)?.code;
    if (code === "ER_DUP_ENTRY") throw new Error("Cette signature est déjà utilisée dans cette table. Choisissez-en une autre.");
    throw error;
  }
  await recordRoomEvent({ roomId: room.id, playerId, eventType: "player_joined", summary: `${nickname} a rejoint le salon.` });
  return { code: room.code, resumeToken, playerId };
}

export async function listPublicMultiplayerRooms(gameMode: MultiplayerGameMode) {
  const db = await getDb();
  if (!db) return [];
  const rooms = await db.select().from(multiplayerRooms)
    .where(and(eq(multiplayerRooms.visibility, "public"), eq(multiplayerRooms.status, "lobby"), eq(multiplayerRooms.gameMode, gameMode)))
    .orderBy(desc(multiplayerRooms.updatedAt), desc(multiplayerRooms.id))
    .limit(16);
  const listed = [] as Array<{ code: string; title: string; gameMode: MultiplayerGameMode; variant: string; players: number; roundLimit: number; roundDurationSeconds: number; isHardcore: boolean }>;
  for (const room of rooms) {
    listed.push({ code: room.code, title: room.title, gameMode: room.gameMode, variant: room.variant, players: room.playerCount, roundLimit: room.roundLimit, roundDurationSeconds: room.roundDurationSeconds, isHardcore: Boolean(room.isHardcore) });
  }
  return listed;
}

export async function updateMultiplayerRoom(input: { code: string; resumeToken: string; title: string; visibility: RoomVisibility; roundLimit: number; roundDurationSeconds: number; showSubmissions: boolean; isHardcore: boolean; allowedJokers?: string[] }) {
  const { db, room } = await requireRoom(input.code);
  const { player: host } = await requirePlayer(room.id, input.resumeToken);
  if (!host.isHost) return getMultiplayerRoomState(input);
  if (room.status !== "lobby") throw new Error("Les règles sont verrouillées depuis le lancement de la partie.");
  validateRoomSettings(input);
  if (input.roundLimit < room.currentRoundIndex) throw new Error("Le nombre de manches ne peut pas être inférieur aux manches déjà jouées.");
  if (!isRoomVisibility(input.visibility)) throw new Error("La visibilité choisie est invalide.");
  const allowedJokers: MultiplayerJoker[] = [];
  await db.update(multiplayerRooms).set({ title: cleanRoomTitle(input.title, host.nickname), visibility: input.visibility, roundLimit: input.roundLimit, roundDurationSeconds: input.roundDurationSeconds, showSubmissions: input.showSubmissions ? 1 : 0, isHardcore: input.isHardcore ? 1 : 0, allowedJokers: JSON.stringify(allowedJokers) }).where(eq(multiplayerRooms.id, room.id));
  await recordRoomEvent({ roomId: room.id, playerId: host.id, eventType: "rules_updated", summary: "L’hôte a mis à jour les règles du salon." });
  return getMultiplayerRoomState(input);
}

export async function renameMultiplayerPlayer(input: { code: string; resumeToken: string; nickname: string }) {
  const { db, room } = await requireRoom(input.code);
  const { player } = await requirePlayer(room.id, input.resumeToken);
  await db.update(multiplayerPlayers).set({ nickname: cleanNickname(input.nickname) }).where(eq(multiplayerPlayers.id, player.id));
  return getMultiplayerRoomState(input);
}

export async function setMultiplayerReady(input: { code: string; resumeToken: string; isReady: boolean }) {
  const { db, room } = await requireRoom(input.code);
  const { player } = await requirePlayer(room.id, input.resumeToken);
  if (room.status !== "lobby") throw new Error("La préparation est terminée : la partie a déjà commencé.");
  await db.update(multiplayerPlayers).set({ isReady: input.isReady ? 1 : 0 }).where(eq(multiplayerPlayers.id, player.id));
  await recordRoomEvent({ roomId: room.id, playerId: player.id, eventType: input.isReady ? "player_ready" : "player_unready", summary: `${player.nickname} est ${input.isReady ? "prêt" : "en attente"}.` });
  return getMultiplayerRoomState(input);
}

export async function selectMultiplayerArchetype(input: { code: string; resumeToken: string; archetype: MultiplayerArchetype }) {
  const { db, room } = await requireRoom(input.code);
  const { player } = await requirePlayer(room.id, input.resumeToken);
  if (room.status !== "lobby") throw new Error("L’archétype est verrouillé dès le lancement de la partie.");
  if (player.isReady) throw new Error("Retirez l’état prêt avant de modifier votre archétype.");
  await db.update(multiplayerPlayers).set({ archetype: input.archetype, mana: getMultiplayerManaCap(input.archetype), manaUpdatedAt: new Date() }).where(eq(multiplayerPlayers.id, player.id));
  await recordRoomEvent({ roomId: room.id, playerId: player.id, eventType: "archetype_selected", summary: `${player.nickname} adopte l’archétype ${input.archetype}.` });
  return getMultiplayerRoomState(input);
}

async function selectHostSuccessor(room: RoomRecord, departingPlayerId: number, preferredPlayerId?: number) {
  const db = await getDb();
  if (!db) throw new Error("La base de données est indisponible.");
  const candidates = await db.select({ id: multiplayerPlayers.id, nickname: multiplayerPlayers.nickname })
    .from(multiplayerPlayers)
    .where(and(eq(multiplayerPlayers.roomId, room.id), sql`${multiplayerPlayers.id} <> ${departingPlayerId}`))
    .orderBy(asc(multiplayerPlayers.id));
  const successor = preferredPlayerId ? candidates.find((player) => player.id === preferredPlayerId) : candidates[Math.floor(Math.random() * candidates.length)];
  if (!successor) return null;
  await db.update(multiplayerPlayers).set({ isHost: 0 }).where(eq(multiplayerPlayers.roomId, room.id));
  await db.update(multiplayerPlayers).set({ isHost: 1 }).where(eq(multiplayerPlayers.id, successor.id));
  await db.update(multiplayerRooms).set({ hostPlayerId: successor.id }).where(eq(multiplayerRooms.id, room.id));
  return successor;
}

export async function transferMultiplayerHost(input: { code: string; resumeToken: string; playerId: number }) {
  const { room } = await requireRoom(input.code);
  const host = await requireHost(room, input.resumeToken);
  if (input.playerId === host.id) throw new Error("Vous êtes déjà l’hôte de ce salon.");
  const successor = await selectHostSuccessor(room, host.id, input.playerId);
  if (!successor) throw new Error("Choisissez un joueur encore présent dans le salon.");
  await recordRoomEvent({ roomId: room.id, playerId: host.id, eventType: "host_transferred", summary: `${host.nickname} confie l’hôte à ${successor.nickname}.` });
  return getMultiplayerRoomState(input);
}

export async function closeMultiplayerRoom(input: { code: string; resumeToken: string }) {
  const { db, room } = await requireRoom(input.code);
  const host = await requireHost(room, input.resumeToken);
  await db.update(multiplayerRounds).set({ status: "resolved", resolvedAt: new Date() }).where(and(eq(multiplayerRounds.roomId, room.id), eq(multiplayerRounds.status, "active")));
  await db.update(multiplayerRooms).set({ status: "finished" }).where(eq(multiplayerRooms.id, room.id));
  await recordRoomEvent({ roomId: room.id, playerId: host.id, eventType: "room_closed", summary: `${host.nickname} a fermé la session.` });
  return getMultiplayerRoomState(input);
}

export async function leaveMultiplayerRoom(input: { code: string; resumeToken: string }) {
  const { db, room } = await requireRoom(input.code);
  const { player } = await requirePlayer(room.id, input.resumeToken);
  const deleted = await db.delete(multiplayerPlayers).where(eq(multiplayerPlayers.id, player.id));
  if (!asAffectedRows(deleted)) throw new Error("Votre départ a déjà été pris en compte. Actualisez la feuille.");
  await db.update(multiplayerRooms).set({ playerCount: sql`GREATEST(${multiplayerRooms.playerCount} - 1, 0)` }).where(eq(multiplayerRooms.id, room.id));
  const successor = player.isHost ? await selectHostSuccessor(room, player.id) : null;
  if (!successor && player.isHost) await db.update(multiplayerRooms).set({ hostPlayerId: null, status: "finished" }).where(eq(multiplayerRooms.id, room.id));
  await recordRoomEvent({ roomId: room.id, playerId: null, eventType: "player_left", summary: successor ? `${player.nickname} a quitté le salon ; ${successor.nickname} devient hôte.` : `${player.nickname} a quitté le salon.` });
  return { left: true, successorNickname: successor?.nickname ?? null, roomClosed: !successor && Boolean(player.isHost) };
}

export async function kickMultiplayerPlayer(input: { code: string; resumeToken: string; playerId: number }) {
  const { db, room } = await requireRoom(input.code);
  await requireHost(room, input.resumeToken);
  if (input.playerId === room.hostPlayerId) throw new Error("L’hôte ne peut pas s’exclure lui-même.");
  const [target] = await db.select({ id: multiplayerPlayers.id }).from(multiplayerPlayers).where(and(eq(multiplayerPlayers.id, input.playerId), eq(multiplayerPlayers.roomId, room.id))).limit(1);
  if (!target) throw new Error("Ce joueur ne fait pas partie du salon.");
  const deleted = await db.delete(multiplayerPlayers).where(eq(multiplayerPlayers.id, target.id));
  if (!asAffectedRows(deleted)) throw new Error("Ce joueur a déjà quitté le salon. Actualisez la feuille.");
  await db.update(multiplayerRooms).set({ playerCount: sql`GREATEST(${multiplayerRooms.playerCount} - 1, 0)` }).where(eq(multiplayerRooms.id, room.id));
  const [activeRound] = await db.select().from(multiplayerRounds).where(and(eq(multiplayerRounds.roomId, room.id), eq(multiplayerRounds.status, "active"))).orderBy(desc(multiplayerRounds.position)).limit(1);
  if (activeRound) {
    const [remaining] = await db.select({ value: count() }).from(multiplayerPlayers).where(eq(multiplayerPlayers.roomId, room.id));
    const playerCount = Number(remaining?.value ?? 0);
    if (room.gameMode === "definition") await resolveDefinitionWhenEveryoneIsDone(room.id, activeRound, playerCount);
    else await resolveWhenEveryoneIsDone(room.id, activeRound, playerCount, room.gameMode === "motus" ? Number(parseData(activeRound.publicData).attempts ?? 0) : undefined);
  }
  return getMultiplayerRoomState(input);
}

export async function getMultiplayerRoomState(input: { code: string; resumeToken: string }) {
  const { db, room } = await requireRoom(input.code);
  let { player } = await requirePlayer(room.id, input.resumeToken);
  player = await refreshPlayerMana(player);
  await resolveExpiredRound(room.id);
  if (Date.now() - player.lastSeenAt.getTime() > 30_000) {
    await recordRoomEvent({ roomId: room.id, playerId: player.id, eventType: "player_reconnected", summary: `${player.nickname} est reconnecté.` });
  }
  await db.update(multiplayerPlayers).set({ lastSeenAt: new Date() }).where(eq(multiplayerPlayers.id, player.id));
  const players = await db.select().from(multiplayerPlayers).where(eq(multiplayerPlayers.roomId, room.id)).orderBy(desc(multiplayerPlayers.score), asc(multiplayerPlayers.id));
  const rewards = await db.select({ id: multiplayerPlayerRewards.id, joker: multiplayerPlayerRewards.joker }).from(multiplayerPlayerRewards)
    .where(and(eq(multiplayerPlayerRewards.roomId, room.id), eq(multiplayerPlayerRewards.playerId, player.id), isNull(multiplayerPlayerRewards.consumedRoundId)))
    .orderBy(asc(multiplayerPlayerRewards.grantedAt));
  const latestRound = await getLatestRound(room.id);
  if (latestRound) await expireTradeOffers(latestRound.id);
  const submissions = latestRound ? await db.select().from(multiplayerSubmissions).where(eq(multiplayerSubmissions.roundId, latestRound.id)).orderBy(asc(multiplayerSubmissions.createdAt), asc(multiplayerSubmissions.id)) : [];
  const jokerUses = latestRound ? await db.select().from(multiplayerJokerUses).where(eq(multiplayerJokerUses.roundId, latestRound.id)).orderBy(asc(multiplayerJokerUses.createdAt), asc(multiplayerJokerUses.id)) : [];
  const tradeOffers = latestRound ? await db.select().from(multiplayerTradeOffers).where(eq(multiplayerTradeOffers.roundId, latestRound.id)).orderBy(desc(multiplayerTradeOffers.createdAt), desc(multiplayerTradeOffers.id)) : [];
  if (latestRound) {
    await db.update(multiplayerTacticalContracts).set({ status: "expired", resolvedAt: new Date() })
      .where(and(eq(multiplayerTacticalContracts.roundId, latestRound.id), eq(multiplayerTacticalContracts.status, "open"), lt(multiplayerTacticalContracts.expiresAt, new Date())));
  }
  const tacticalContracts = latestRound ? await db.select().from(multiplayerTacticalContracts).where(eq(multiplayerTacticalContracts.roundId, latestRound.id)).orderBy(desc(multiplayerTacticalContracts.createdAt), desc(multiplayerTacticalContracts.id)) : [];
  const tacticalBids = [] as Array<typeof multiplayerTacticalBids.$inferSelect>;
  for (const contract of tacticalContracts) {
    const bids = await db.select().from(multiplayerTacticalBids).where(eq(multiplayerTacticalBids.contractId, contract.id));
    tacticalBids.push(...bids);
  }
  const playerNames = new Map(players.map((item) => [item.id, item.nickname]));
  const events = await db.select().from(multiplayerRoomEvents).where(eq(multiplayerRoomEvents.roomId, room.id)).orderBy(desc(multiplayerRoomEvents.createdAt), desc(multiplayerRoomEvents.id)).limit(8);
  const now = Date.now();

  return {
    code: room.code,
    title: room.title,
    visibility: room.visibility,
    gameMode: room.gameMode,
    variant: room.variant,
    status: room.status,
    currentRoundIndex: room.currentRoundIndex,
    settings: roomSettings(room),
    viewer: { id: player.id, nickname: player.nickname, isHost: Boolean(player.isHost), isReady: Boolean(player.isReady), score: player.score, archetype: player.archetype, mana: player.mana, manaCap: getMultiplayerManaCap(player.archetype), lastRewardMessage: player.lastRewardMessage },
    players: players.map((item) => ({ id: item.id, nickname: item.nickname, score: item.score, archetype: item.archetype, mana: item.mana, manaCap: getMultiplayerManaCap(item.archetype), isHost: Boolean(item.isHost), isReady: Boolean(item.isReady), presence: now - item.lastSeenAt.getTime() <= 5_000 ? "connecté" : now - item.lastSeenAt.getTime() <= 30_000 ? "inactif" : "hors ligne" })),
    rewards: rewards.map((reward) => ({ id: reward.id, joker: reward.joker })),
    tacticalContracts: tacticalContracts.map((contract) => {
      const bids = tacticalBids.filter((bid) => bid.contractId === contract.id).sort((left, right) => right.manaAmount - left.manaAmount || right.id - left.id);
      const highestBid = bids[0] ?? null;
      const isOwner = contract.fromPlayerId === player.id;
      return { id: contract.id, type: contract.contractType, fromPlayerId: contract.fromPlayerId, fromNickname: playerNames.get(contract.fromPlayerId) ?? "Joueur", targetPlayerId: contract.targetPlayerId, offeredLetter: contract.contractType === "letter" || isOwner ? contract.offeredLetter : null, hint: contract.hint ? parseData(contract.hint) : null, minimumBid: contract.minimumBid, status: contract.status, expiresAt: contract.expiresAt, highestBid: highestBid ? { playerId: highestBid.playerId, nickname: playerNames.get(highestBid.playerId) ?? "Joueur", manaAmount: highestBid.manaAmount } : null };
    }),
    events: events.map((event) => ({ id: event.id, type: event.eventType, summary: event.summary, createdAt: event.createdAt })),
    round: latestRound ? await publicRound(latestRound, submissions, jokerUses, tradeOffers, player.id, playerNames, Boolean(room.showSubmissions)) : null,
  };
}

async function createRound(room: RoomRecord) {
  const db = await getDb();
  if (!db) throw new Error("La base de données est indisponible.");
  const position = room.currentRoundIndex + 1;
  const startedAt = new Date();
  const endsAt = room.roundDurationSeconds > 0 ? new Date(startedAt.getTime() + room.roundDurationSeconds * 1000) : undefined;

  if (room.gameMode === "quiz") {
    if (room.variant === "gender") {
      const quiz = await getRandomQuizChallenge("gender");
      if (!quiz) throw new Error("Aucune question de genre Morphalou n’est disponible.");
      const genderRound = buildMultiplayerGenderRound(quiz);
      const result = await db.insert(multiplayerRounds).values({
        roomId: room.id,
        startedAt,
        position,
        prompt: genderRound.prompt,
        publicData: JSON.stringify(genderRound.publicData),
        answerKey: genderRound.answerKey,
        sourceCnrtlUrl: genderRound.sourceCnrtlUrl,
        endsAt,
      });
      await db.update(multiplayerRooms).set({ status: "active", currentRoundIndex: position }).where(eq(multiplayerRooms.id, room.id));
      return asInsertId(result);
    }
    const quiz = await getRandomGrammarQuiz();
    if (!quiz) throw new Error("Aucune question Morphalou n’est disponible.");
    const category = quiz.category;
    if (!category) throw new Error("La catégorie grammaticale de cette question est indisponible.");
    const trueFalse = room.variant === "truefalse";
    const statementCategory = Number(quiz.id) % 2 === 0 ? category : quiz.choices.find((choice) => choice !== category) ?? category;
    const answer = trueFalse ? (statementCategory === category ? "Vrai" : "Faux") : category;
    const publicData = trueFalse
      ? { variant: "truefalse", lemma: quiz.lemma, context: quiz.context, statementCategory, choices: ["Vrai", "Faux"] }
      : { variant: "category", lemma: quiz.lemma, context: quiz.context, choices: quiz.choices };
    const result = await db.insert(multiplayerRounds).values({
      roomId: room.id,
      startedAt,
      position,
      prompt: trueFalse ? `Dans cet emploi, « ${quiz.lemma} » est-il bien un ${statementCategory} ?` : `Quelle est la catégorie grammaticale de « ${quiz.lemma} » ?`,
      publicData: JSON.stringify(publicData),
      answerKey: answer,
      sourceCnrtlUrl: quiz.source.cnrtlUrl ?? undefined,
      endsAt,
    });
    await db.update(multiplayerRooms).set({ status: "active", currentRoundIndex: position }).where(eq(multiplayerRooms.id, room.id));
    return asInsertId(result);
  }

  if (room.gameMode === "definition") {
    if (!isDefinitionVariant(room.variant)) throw new Error("Le format de liaison est invalide.");
    if (room.variant !== "match") {
      const relationRound = room.variant === "intruder" ? await getRelationIntruderRound() : await getRelationChoiceRound(room.variant);
      if (!relationRound) throw new Error("Aucune relation lexicale DBnary adaptée n’est disponible.");
      const result = await db.insert(multiplayerRounds).values({
        roomId: room.id,
        startedAt,
        position,
        prompt: relationRound.prompt,
        publicData: JSON.stringify({ kind: "relation", variant: relationRound.kind, sourceLemma: "sourceLemma" in relationRound ? relationRound.sourceLemma : null, options: relationRound.options, source: relationRound.source }),
        answerKey: String(relationRound.answerEntryId),
        sourceCnrtlUrl: relationRound.options.find((option) => option.entryId === relationRound.answerEntryId)?.cnrtlUrl ?? undefined,
        endsAt,
      });
      await db.update(multiplayerRooms).set({ status: "active", currentRoundIndex: position }).where(eq(multiplayerRooms.id, room.id));
      return asInsertId(result);
    }
    const match = await getDefinitionMatchRound();
    if (!match) throw new Error("Aucune définition n’est disponible.");
    const result = await db.insert(multiplayerRounds).values({
      roomId: room.id,
      startedAt,
      position,
      prompt: match.prompt,
      publicData: JSON.stringify({ kind: "definition", words: match.words, definitions: match.definitions, source: match.source }),
      answerKey: "",
      endsAt,
    });
    await db.update(multiplayerRooms).set({ status: "active", currentRoundIndex: position }).where(eq(multiplayerRooms.id, room.id));
    return asInsertId(result);
  }

  const variant = room.variant;
  if (!isMotusVariant(variant)) throw new Error("Le format Motus est invalide.");
  const format = motusMultiplayerFormats[variant];
  const word = await getRandomMotusWord(format.minLength, format.maxLength);
  if (!word) throw new Error("Aucun mot Motus n’est disponible.");
  const answer = normalizeGameWord(word.lemma);
  const result = await db.insert(multiplayerRounds).values({
    roomId: room.id,
    startedAt,
    position,
    prompt: `Trouvez le mot de ${answer.length} lettres.`,
    publicData: JSON.stringify({ variant, attempts: format.attempts, length: answer.length }),
    answerKey: answer,
    sourceCnrtlUrl: word.source.cnrtlUrl ?? undefined,
    endsAt,
  });
  await db.update(multiplayerRooms).set({ status: "active", currentRoundIndex: position }).where(eq(multiplayerRooms.id, room.id));
  return asInsertId(result);
}

export async function startMultiplayerRound(input: { code: string; resumeToken: string }) {
  const { db, room } = await requireRoom(input.code);
  const { player } = await requirePlayer(room.id, input.resumeToken);
  if (!player.isHost) throw new Error("Seul l’hôte peut lancer une manche.");
  if (room.status !== "lobby") throw new Error("La manche est déjà en cours ou les règles sont verrouillées.");
  if (room.currentRoundIndex >= room.roundLimit) throw new Error("Le nombre de manches prévu pour ce salon est déjà atteint.");
  const [active] = await db.select({ id: multiplayerRounds.id }).from(multiplayerRounds).where(and(eq(multiplayerRounds.roomId, room.id), eq(multiplayerRounds.status, "active"))).limit(1);
  if (active) throw new Error("La manche actuelle doit être terminée avant d’en lancer une autre.");
  const players = await db.select({ id: multiplayerPlayers.id }).from(multiplayerPlayers).where(eq(multiplayerPlayers.roomId, room.id));
  if (!canStartMultiplayerRound({ isHost: Boolean(player.isHost), playerCount: players.length })) throw new Error("Attendez au moins un invité avant de lancer la manche.");
  const claimed = await db.update(multiplayerRooms).set({ status: "active" })
    .where(and(eq(multiplayerRooms.id, room.id), eq(multiplayerRooms.status, "lobby"), eq(multiplayerRooms.currentRoundIndex, room.currentRoundIndex)));
  if (!asAffectedRows(claimed)) throw new Error("Le lancement a déjà été demandé par la table. Actualisez la feuille.");
  if (room.currentRoundIndex === 0) {
    const deck = roomJokerDeck(room);
    for (const participant of players) await grantRandomJoker(room.id, participant.id, deck);
    await recordRoomEvent({ roomId: room.id, playerId: player.id, eventType: "joker_used", summary: "La table reçoit son premier tirage de joker." });
  }
  const roundId = await createRound(room);
  await db.update(multiplayerPlayers).set({ isReady: 0 }).where(eq(multiplayerPlayers.roomId, room.id));
  await recordRoomEvent({ roomId: room.id, roundId, playerId: player.id, eventType: "round_started", summary: `Manche ${room.currentRoundIndex + 1} lancée : les règles sont verrouillées.` });
  return getMultiplayerRoomState(input);
}

export async function resolveAndStartNextRound(input: { code: string; resumeToken: string; expectedRoundId: number }) {
  const { db, room } = await requireRoom(input.code);
  const { player } = await requirePlayer(room.id, input.resumeToken);
  if (!player.isHost) throw new Error("Seul l’hôte peut passer à la manche suivante.");
  const latestRound = await getLatestRound(room.id);
  if (!canContinueMultiplayerRound({ room, expectedRoundId: input.expectedRoundId, latestRound })) {
    throw new Error("La manche a déjà changé. Actualisez la feuille avant de continuer.");
  }
  if (latestRound.status === "active") {
    const closed = await db.update(multiplayerRounds).set({ status: "resolved", resolvedAt: new Date() })
      .where(and(eq(multiplayerRounds.id, latestRound.id), eq(multiplayerRounds.status, "active")));
    if (!asAffectedRows(closed)) throw new Error("La manche vient d’être terminée. Actualisez la feuille avant de continuer.");
    await recordRoomEvent({ roomId: room.id, roundId: latestRound.id, playerId: player.id, eventType: "round_resolved", summary: `L’hôte a clôturé la manche ${room.currentRoundIndex}.` });
  }
  if (room.currentRoundIndex >= room.roundLimit) {
    await db.update(multiplayerRooms).set({ status: "finished" }).where(and(eq(multiplayerRooms.id, room.id), eq(multiplayerRooms.status, "active"), eq(multiplayerRooms.currentRoundIndex, room.currentRoundIndex)));
    await recordRoomEvent({ roomId: room.id, playerId: player.id, eventType: "room_finished", summary: "La partie est terminée : le classement final est disponible." });
    return getMultiplayerRoomState(input);
  }
  const refreshed = { ...room, currentRoundIndex: room.currentRoundIndex };
  const roundId = await createRound(refreshed);
  await recordRoomEvent({ roomId: room.id, roundId, playerId: player.id, eventType: "round_started", summary: `Manche ${room.currentRoundIndex + 1} lancée.` });
  return getMultiplayerRoomState(input);
}

async function resolveWhenEveryoneIsDone(roomId: number, round: RoundRecord, playerCount: number, maxAttempts = 1) {
  const db = await getDb();
  if (!db) return;
  const submissions = await db.select({ playerId: multiplayerSubmissions.playerId, isCorrect: multiplayerSubmissions.isCorrect, attemptIndex: multiplayerSubmissions.attemptIndex }).from(multiplayerSubmissions).where(eq(multiplayerSubmissions.roundId, round.id));
  const jokerUses = await db.select({ playerId: multiplayerJokerUses.playerId, joker: multiplayerJokerUses.joker }).from(multiplayerJokerUses).where(eq(multiplayerJokerUses.roundId, round.id));
  const extraAttempts = new Set(jokerUses.filter((use) => use.joker === "second_chance" || use.joker === "bonus_attempt").map((use) => use.playerId));
  const done = new Set<number>();
  submissions.forEach((submission) => {
    const allowedAttempts = maxAttempts + (extraAttempts.has(submission.playerId) ? 1 : 0);
    if (submission.isCorrect || submission.attemptIndex >= allowedAttempts) done.add(submission.playerId);
  });
  if (done.size >= playerCount) await db.update(multiplayerRounds).set({ status: "resolved", resolvedAt: new Date() }).where(eq(multiplayerRounds.id, round.id));
}

async function resolveDefinitionWhenEveryoneIsDone(roomId: number, round: RoundRecord, playerCount: number) {
  const db = await getDb();
  if (!db) return;
  const data = parseData(round.publicData);
  if (data.kind === "relation") {
    await resolveWhenEveryoneIsDone(roomId, round, playerCount);
    return;
  }
  const target = Array.isArray(data.words) ? data.words.length : 4;
  const submissions = await db.select().from(multiplayerSubmissions).where(eq(multiplayerSubmissions.roundId, round.id));
  const correctByPlayer = new Map<number, Set<number>>();
  const attemptedByPlayer = new Map<number, Set<number>>();
  submissions.forEach((submission) => {
    try {
      const payload = JSON.parse(submission.payload) as { entryId?: number };
      if (!payload.entryId) return;
      const attempts = attemptedByPlayer.get(submission.playerId) ?? new Set<number>();
      attempts.add(payload.entryId);
      attemptedByPlayer.set(submission.playerId, attempts);
      if (submission.isCorrect) {
        const matches = correctByPlayer.get(submission.playerId) ?? new Set<number>();
        matches.add(payload.entryId);
        correctByPlayer.set(submission.playerId, matches);
      }
    } catch { /* malformed submission is ignored */ }
  });
  const completed = Array.from(attemptedByPlayer.entries()).filter(([playerId, attempts]) => attempts.size >= target || (correctByPlayer.get(playerId)?.size ?? 0) >= target).length;
  if (completed >= playerCount) await db.update(multiplayerRounds).set({ status: "resolved", resolvedAt: new Date() }).where(eq(multiplayerRounds.id, round.id));
}

export async function submitMultiplayerQuizAnswer(input: { code: string; resumeToken: string; choice: string }) {
  const { db, room } = await requireRoom(input.code);
  const { player } = await requirePlayer(room.id, input.resumeToken);
  if (room.gameMode !== "quiz") throw new Error("Ce salon ne joue pas au Quiz.");
  const round = await getActiveRound(room.id);
  const existing = await db.select().from(multiplayerSubmissions).where(and(eq(multiplayerSubmissions.roundId, round.id), eq(multiplayerSubmissions.playerId, player.id))).orderBy(asc(multiplayerSubmissions.attemptIndex));
  const jokerUses = await db.select().from(multiplayerJokerUses).where(and(eq(multiplayerJokerUses.roundId, round.id), eq(multiplayerJokerUses.playerId, player.id), eq(multiplayerJokerUses.joker, "second_chance"))).limit(1);
  if (existing.length > 0 && !jokerUses.length) throw new Error("Votre réponse est déjà enregistrée.");
  if (existing.length > 1) throw new Error("Votre seconde chance a déjà été utilisée.");
  const data = parseData(round.publicData);
  const choices = Array.isArray(data.choices) ? data.choices.map(String) : [];
  if (!choices.includes(input.choice)) throw new Error("Cette réponse ne fait pas partie de la manche.");
  const isCorrect = input.choice === round.answerKey;
  const [rank] = await db.select({ value: count() }).from(multiplayerSubmissions).where(and(eq(multiplayerSubmissions.roundId, round.id), eq(multiplayerSubmissions.isCorrect, 1)));
  const basePoints = isCorrect ? getQuizPoints(Number(rank?.value ?? 0)) : 0;
  const points = existing.length > 0 ? Math.floor(basePoints / 2) : basePoints;
  await db.insert(multiplayerSubmissions).values({ roundId: round.id, playerId: player.id, submissionType: "quiz", payload: input.choice, isCorrect: isCorrect ? 1 : 0, points, attemptIndex: existing.length + 1 });
  if (points) await db.update(multiplayerPlayers).set({ score: sql`${multiplayerPlayers.score} + ${points}` }).where(eq(multiplayerPlayers.id, player.id));
  if (isCorrect) await grantRandomJoker(room.id, player.id, roomJokerDeck(room));
  const [playerTotal] = await db.select({ value: count() }).from(multiplayerPlayers).where(eq(multiplayerPlayers.roomId, room.id));
  await resolveWhenEveryoneIsDone(room.id, round, Number(playerTotal?.value ?? 0));
  return getMultiplayerRoomState(input);
}

export async function submitMultiplayerMotusAttempt(input: { code: string; resumeToken: string; word: string }) {
  const { db, room } = await requireRoom(input.code);
  const { player } = await requirePlayer(room.id, input.resumeToken);
  if (room.gameMode !== "motus") throw new Error("Ce salon ne joue pas à Motus.");
  const round = await getActiveRound(room.id);
  const activeUses = await db.select({ effect: multiplayerJokerUses.effect, joker: multiplayerJokerUses.joker }).from(multiplayerJokerUses).where(eq(multiplayerJokerUses.roundId, round.id));
  const blackout = activeUses.find((use) => {
    const effect = parseJokerEffect(use.effect);
    return use.joker === "blackout" && effect?.kind === "blackout" && Number(effect.targetPlayerId) === player.id && typeof effect.endsAt === "string" && new Date(effect.endsAt).getTime() > Date.now();
  });
  if (blackout) throw new Error("Blackout en cours : attendez la fin de la perturbation avant de proposer un mot.");
  const data = parseData(round.publicData);
  const maxAttempts = Number(data.attempts ?? 0);
  const expectedLength = Number(data.length ?? 0);
  const word = normalizeGameWord(input.word);
  if (!expectedLength || word.length !== expectedLength) throw new Error(`Entrez un mot de ${expectedLength} lettres.`);
  const valid = await isMotusAttemptInLexicon(word, expectedLength);
  if (!valid) throw new Error("Ce mot n’est pas présent dans le lexique Morphalou.");
  const existing = await db.select().from(multiplayerSubmissions).where(and(eq(multiplayerSubmissions.roundId, round.id), eq(multiplayerSubmissions.playerId, player.id))).orderBy(asc(multiplayerSubmissions.attemptIndex));
  if (existing.some((submission) => submission.isCorrect)) throw new Error("Vous avez déjà trouvé ce mot.");
  const attemptIndex = existing.length + 1;
  const [secondChance] = await db.select({ id: multiplayerJokerUses.id }).from(multiplayerJokerUses).where(and(eq(multiplayerJokerUses.roundId, round.id), eq(multiplayerJokerUses.playerId, player.id), eq(multiplayerJokerUses.joker, "second_chance"))).limit(1);
  const [bonusAttempt] = await db.select({ id: multiplayerJokerUses.id }).from(multiplayerJokerUses).where(and(eq(multiplayerJokerUses.roundId, round.id), eq(multiplayerJokerUses.playerId, player.id), eq(multiplayerJokerUses.joker, "bonus_attempt"))).limit(1);
  const allowedAttempts = maxAttempts + (secondChance ? 1 : 0) + (bonusAttempt ? 1 : 0);
  if (attemptIndex > allowedAttempts) throw new Error("Vous avez utilisé tous vos essais.");
  const feedback = gradeMotusGuess(word, round.answerKey);
  if (!feedback) throw new Error("Cette tentative ne peut pas être corrigée.");
  const isCorrect = word === round.answerKey;
  const [rank] = await db.select({ value: count() }).from(multiplayerSubmissions).where(and(eq(multiplayerSubmissions.roundId, round.id), eq(multiplayerSubmissions.isCorrect, 1)));
  const basePoints = isCorrect ? getMotusPoints(Number(rank?.value ?? 0), attemptIndex) : 0;
  const [overclock] = await db.select({ effect: multiplayerJokerUses.effect }).from(multiplayerJokerUses).where(and(eq(multiplayerJokerUses.roundId, round.id), eq(multiplayerJokerUses.playerId, player.id), eq(multiplayerJokerUses.joker, "overclock"))).limit(1);
  const overclockActive = Boolean(overclock && parseJokerEffect(overclock.effect)?.kind === "overclock");
  const adjustedBasePoints = overclockActive && isCorrect ? basePoints * 2 : basePoints;
  const points = attemptIndex > maxAttempts && secondChance ? Math.floor(adjustedBasePoints / 2) : adjustedBasePoints;
  await db.insert(multiplayerSubmissions).values({ roundId: round.id, playerId: player.id, submissionType: "motus", payload: word, feedback: JSON.stringify(feedback), isCorrect: isCorrect ? 1 : 0, points, attemptIndex });
  if (points) await db.update(multiplayerPlayers).set({ score: sql`${multiplayerPlayers.score} + ${points}` }).where(eq(multiplayerPlayers.id, player.id));
  if (isCorrect) await grantRandomJoker(room.id, player.id, roomJokerDeck(room));
  const [playerTotal] = await db.select({ value: count() }).from(multiplayerPlayers).where(eq(multiplayerPlayers.roomId, room.id));
  await resolveWhenEveryoneIsDone(room.id, round, Number(playerTotal?.value ?? 0), maxAttempts);
  return getMultiplayerRoomState(input);
}

export async function submitMultiplayerDefinitionMatch(input: { code: string; resumeToken: string; entryId: number; definitionId: number }) {
  const { db, room } = await requireRoom(input.code);
  const { player } = await requirePlayer(room.id, input.resumeToken);
  if (room.gameMode !== "definition") throw new Error("Ce salon ne joue pas à la liaison de définitions.");
  const round = await getActiveRound(room.id);
  const data = parseData(round.publicData);
  if (data.kind === "relation") {
    const options = Array.isArray(data.options) ? data.options as Array<{ entryId?: number }> : [];
    if (!options.some((option) => option.entryId === input.entryId)) throw new Error("Ce mot ne fait pas partie de la manche.");
    const existing = await db.select().from(multiplayerSubmissions).where(and(eq(multiplayerSubmissions.roundId, round.id), eq(multiplayerSubmissions.playerId, player.id))).orderBy(asc(multiplayerSubmissions.attemptIndex));
    const [secondChance] = await db.select({ id: multiplayerJokerUses.id }).from(multiplayerJokerUses).where(and(eq(multiplayerJokerUses.roundId, round.id), eq(multiplayerJokerUses.playerId, player.id), eq(multiplayerJokerUses.joker, "second_chance"))).limit(1);
    if (existing.length > 0 && !secondChance) throw new Error("Votre choix est déjà enregistré.");
    if (existing.length > 1) throw new Error("Votre seconde chance a déjà été utilisée.");
    const isCorrect = input.entryId === Number(round.answerKey);
    const [rank] = await db.select({ value: count() }).from(multiplayerSubmissions).where(and(eq(multiplayerSubmissions.roundId, round.id), eq(multiplayerSubmissions.isCorrect, 1)));
    const basePoints = isCorrect ? getQuizPoints(Number(rank?.value ?? 0)) : 0;
    const points = existing.length ? Math.floor(basePoints / 2) : basePoints;
    await db.insert(multiplayerSubmissions).values({ roundId: round.id, playerId: player.id, submissionType: "definition", payload: JSON.stringify({ entryId: input.entryId }), isCorrect: isCorrect ? 1 : 0, points, attemptIndex: existing.length + 1 });
    if (points) await db.update(multiplayerPlayers).set({ score: sql`${multiplayerPlayers.score} + ${points}` }).where(eq(multiplayerPlayers.id, player.id));
    if (isCorrect) await grantRandomJoker(room.id, player.id, roomJokerDeck(room));
    const [playerTotal] = await db.select({ value: count() }).from(multiplayerPlayers).where(eq(multiplayerPlayers.roomId, room.id));
    await resolveDefinitionWhenEveryoneIsDone(room.id, round, Number(playerTotal?.value ?? 0));
    return getMultiplayerRoomState(input);
  }
  const words = Array.isArray(data.words) ? data.words as Array<{ entryId?: number }> : [];
  const definitions = Array.isArray(data.definitions) ? data.definitions as Array<{ definitionId?: number }> : [];
  if (!words.some((item) => item.entryId === input.entryId) || !definitions.some((item) => item.definitionId === input.definitionId)) throw new Error("Cette association ne fait pas partie de la manche.");
  const existing = await db.select().from(multiplayerSubmissions).where(eq(multiplayerSubmissions.roundId, round.id));
  const ownSubmissions = existing.filter((submission) => submission.playerId === player.id);
  const ownCorrect = ownSubmissions.filter((submission) => submission.isCorrect).map((submission) => {
    try { return JSON.parse(submission.payload) as { entryId?: number; definitionId?: number }; } catch { return {}; }
  });
  if (ownCorrect.some((payload) => payload.entryId === input.entryId)) throw new Error("Ce mot est déjà relié dans votre grille.");
  if (ownCorrect.some((payload) => payload.definitionId === input.definitionId)) throw new Error("Cette définition est déjà reliée dans votre grille.");
  const ownAttemptsForWord = ownSubmissions
    .filter((submission) => {
      try { return (JSON.parse(submission.payload) as { entryId?: number }).entryId === input.entryId; } catch { return false; }
    });
  const [secondChance] = await db.select({ id: multiplayerJokerUses.id }).from(multiplayerJokerUses)
    .where(and(eq(multiplayerJokerUses.roundId, round.id), eq(multiplayerJokerUses.playerId, player.id), eq(multiplayerJokerUses.joker, "second_chance"))).limit(1);
  if (ownAttemptsForWord.length >= 1 && !secondChance) throw new Error("Utilisez Seconde chance pour retenter ce mot.");
  if (ownAttemptsForWord.length >= 2) throw new Error("Votre seconde chance a déjà été utilisée pour ce mot.");
  const result = await checkDefinitionMatch(input.entryId, input.definitionId);
  const sameWordCorrect = existing.filter((submission) => {
    if (!submission.isCorrect) return false;
    try { return (JSON.parse(submission.payload) as { entryId?: number }).entryId === input.entryId; } catch { return false; }
  }).length;
  const basePoints = result.correct ? getQuizPoints(sameWordCorrect) : 0;
  const points = ownAttemptsForWord.length > 0 ? Math.floor(basePoints / 2) : basePoints;
  await db.insert(multiplayerSubmissions).values({ roundId: round.id, playerId: player.id, submissionType: "definition", payload: JSON.stringify({ entryId: input.entryId, definitionId: input.definitionId }), isCorrect: result.correct ? 1 : 0, points, attemptIndex: getNextMultiplayerAttemptIndex(player.id, existing) });
  if (points) await db.update(multiplayerPlayers).set({ score: sql`${multiplayerPlayers.score} + ${points}` }).where(eq(multiplayerPlayers.id, player.id));
  if (result.correct) await grantRandomJoker(room.id, player.id, roomJokerDeck(room));
  const [playerTotal] = await db.select({ value: count() }).from(multiplayerPlayers).where(eq(multiplayerPlayers.roomId, room.id));
  await resolveDefinitionWhenEveryoneIsDone(room.id, round, Number(playerTotal?.value ?? 0));
  return getMultiplayerRoomState(input);
}

export function getMotusCompassMessage(answerKey: string) {
  const answer = normalizeGameWord(answerKey);
  const firstLetter = answer[0]?.toLocaleUpperCase("fr-FR");
  if (!firstLetter) return "Boussole : le mot secret reste à déchiffrer.";
  const occurrences = answer.split("").filter((letter) => letter === answer[0]).length;
  return `Boussole : le mot commence par « ${firstLetter} »${occurrences > 1 ? `, présente ${occurrences} fois` : ""}.`;
}

async function makeCompassEffect(room: RoomRecord, round: RoundRecord) {
  const data = parseData(round.publicData);
  if (room.gameMode === "quiz") {
    const choices = Array.isArray(data.choices) ? data.choices.map(String) : [];
    const excludedChoice = choices.find((choice) => choice !== round.answerKey);
    return { kind: "compass", message: excludedChoice ? `Boussole : « ${excludedChoice} » n’est pas la bonne piste.` : "Boussole : observez attentivement la formulation." };
  }
  if (room.gameMode === "motus") {
    return { kind: "compass", message: getMotusCompassMessage(round.answerKey) };
  }
  const words = Array.isArray(data.words) ? data.words as Array<{ entryId?: number; lemma?: string }> : [];
  const definitions = Array.isArray(data.definitions) ? data.definitions as Array<{ definitionId?: number; text?: string }> : [];
  for (const word of words) {
    for (let definitionIndex = 0; definitionIndex < definitions.length; definitionIndex += 1) {
      const definition = definitions[definitionIndex];
      if (!word.entryId || !definition.definitionId) continue;
      const match = await checkDefinitionMatch(word.entryId, definition.definitionId);
      if (match.correct) return { kind: "compass", message: `Boussole : « ${word.lemma ?? "ce mot"} » correspond à la définition n° ${definitionIndex + 1}.` };
    }
  }
  return { kind: "compass", message: "Boussole : une paire exacte se cache dans la grille." };
}

export async function useMultiplayerJoker(input: { code: string; resumeToken: string; joker: MultiplayerJoker; targetPlayerId?: number }) {
  const { db, room } = await requireRoom(input.code);
  const { player } = await requirePlayer(room.id, input.resumeToken);
  const round = await getActiveRound(room.id);
  if (!roomJokerDeck(room).includes(input.joker) || !isJokerCompatibleWithGame(input.joker, room.gameMode)) throw new Error("Ce joker n’est pas autorisé dans cette partie.");
  const [used] = await db.select({ id: multiplayerJokerUses.id }).from(multiplayerJokerUses)
    .where(and(eq(multiplayerJokerUses.roundId, round.id), eq(multiplayerJokerUses.playerId, player.id), eq(multiplayerJokerUses.joker, input.joker))).limit(1);
  if (used) throw new Error("Ce joker a déjà été utilisé pendant cette manche.");

  const [reward] = await db.select({ id: multiplayerPlayerRewards.id }).from(multiplayerPlayerRewards)
    .where(and(eq(multiplayerPlayerRewards.roomId, room.id), eq(multiplayerPlayerRewards.playerId, player.id), eq(multiplayerPlayerRewards.joker, input.joker), isNull(multiplayerPlayerRewards.consumedRoundId)))
    .orderBy(asc(multiplayerPlayerRewards.grantedAt)).limit(1);
  if (!reward) throw new Error("Ce joker n’est pas disponible dans votre réserve.");
  const rewardId = reward.id;

  let effect: Record<string, unknown>;
  if (input.joker === "compass") {
    effect = await makeCompassEffect(room, round);
  } else if (input.joker === "tempo") {
    if (!round.endsAt) throw new Error("Le joker Tempo nécessite une limite de durée active.");
    const nextEndsAt = new Date(Math.max(round.endsAt.getTime(), Date.now()) + 10_000);
    await db.update(multiplayerRounds).set({ endsAt: nextEndsAt }).where(eq(multiplayerRounds.id, round.id));
    effect = { kind: "tempo", seconds: 10, endsAt: nextEndsAt.toISOString() };
  } else if (input.joker === "fog") {
    if (!input.targetPlayerId) throw new Error("Choisissez un adversaire à brouiller.");
    if (input.targetPlayerId === player.id) throw new Error("Le Brouillard doit viser un autre joueur.");
    const [target] = await db.select({ id: multiplayerPlayers.id, nickname: multiplayerPlayers.nickname })
      .from(multiplayerPlayers)
      .where(and(eq(multiplayerPlayers.roomId, room.id), eq(multiplayerPlayers.id, input.targetPlayerId)))
      .limit(1);
    if (!target) throw new Error("Ce joueur ne fait pas partie de ce salon.");
    const endsAt = new Date(Date.now() + fogDurationMilliseconds);
    const [shieldUse] = await db.select().from(multiplayerJokerUses)
      .where(and(eq(multiplayerJokerUses.roundId, round.id), eq(multiplayerJokerUses.playerId, target.id), eq(multiplayerJokerUses.joker, "shield")))
      .limit(1);
    const shieldEffect = shieldUse ? parseJokerEffect(shieldUse.effect) : null;
    const shieldIsActive = isShieldEffectActive(shieldEffect);
    if (shieldUse && shieldEffect && shieldIsActive) {
      await db.update(multiplayerJokerUses).set({
        effect: JSON.stringify({ ...shieldEffect, triggeredAt: new Date().toISOString(), message: `Parade : le Brouillard de ${player.nickname} a été dissipé.` }),
      }).where(eq(multiplayerJokerUses.id, shieldUse.id));
      effect = createFogEffect(target.id, target.nickname, endsAt.toISOString(), true);
    } else {
      effect = createFogEffect(target.id, target.nickname, endsAt.toISOString(), false);
    }
  } else if (input.joker === "mana_siphon") {
    if (!input.targetPlayerId || input.targetPlayerId === player.id) throw new Error("Choisissez un adversaire à siphonner.");
    const [target] = await db.select().from(multiplayerPlayers).where(and(eq(multiplayerPlayers.roomId, room.id), eq(multiplayerPlayers.id, input.targetPlayerId))).limit(1);
    if (!target) throw new Error("Ce joueur ne fait pas partie de ce salon.");
    const [shieldUse] = await db.select().from(multiplayerJokerUses).where(and(eq(multiplayerJokerUses.roundId, round.id), eq(multiplayerJokerUses.playerId, target.id), eq(multiplayerJokerUses.joker, "shield"))).limit(1);
    const shieldEffect = shieldUse ? parseJokerEffect(shieldUse.effect) : null;
    if (shieldUse && shieldEffect && isShieldEffectActive(shieldEffect)) {
      await db.update(multiplayerJokerUses).set({ effect: JSON.stringify({ ...shieldEffect, triggeredAt: new Date().toISOString(), message: `Parade : le Siphon de ${player.nickname} a été renvoyé.` }) }).where(eq(multiplayerJokerUses.id, shieldUse.id));
      effect = { kind: "mana_siphon", targetPlayerId: target.id, targetNickname: target.nickname, prevented: true, message: "Siphon dissipé par la Parade adverse." };
    } else {
      const amount = Math.min(25, target.mana, getMultiplayerManaCap(player.archetype) - player.mana);
      await db.update(multiplayerPlayers).set({ mana: target.mana - amount, manaUpdatedAt: new Date() }).where(eq(multiplayerPlayers.id, target.id));
      await db.update(multiplayerPlayers).set({ mana: player.mana + amount, manaUpdatedAt: new Date() }).where(eq(multiplayerPlayers.id, player.id));
      effect = { kind: "mana_siphon", targetPlayerId: target.id, targetNickname: target.nickname, amount, message: `${amount} PM siphonnés à ${target.nickname}.` };
    }
  } else if (input.joker === "blackout") {
    if (!input.targetPlayerId || input.targetPlayerId === player.id) throw new Error("Choisissez un adversaire à placer sous blackout.");
    const [target] = await db.select().from(multiplayerPlayers).where(and(eq(multiplayerPlayers.roomId, room.id), eq(multiplayerPlayers.id, input.targetPlayerId))).limit(1);
    if (!target) throw new Error("Ce joueur ne fait pas partie de ce salon.");
    const endsAt = new Date(Date.now() + 4_000);
    const [shieldUse] = await db.select().from(multiplayerJokerUses).where(and(eq(multiplayerJokerUses.roundId, round.id), eq(multiplayerJokerUses.playerId, target.id), eq(multiplayerJokerUses.joker, "shield"))).limit(1);
    const shieldEffect = shieldUse ? parseJokerEffect(shieldUse.effect) : null;
    if (shieldUse && shieldEffect && isShieldEffectActive(shieldEffect)) {
      await db.update(multiplayerJokerUses).set({ effect: JSON.stringify({ ...shieldEffect, triggeredAt: new Date().toISOString(), message: `Parade : le Blackout de ${player.nickname} a été dissipé.` }) }).where(eq(multiplayerJokerUses.id, shieldUse.id));
      effect = { kind: "blackout", targetPlayerId: target.id, targetNickname: target.nickname, prevented: true, endsAt: endsAt.toISOString(), message: "Blackout dissipé par la Parade adverse." };
    } else effect = { kind: "blackout", targetPlayerId: target.id, targetNickname: target.nickname, endsAt: endsAt.toISOString(), seconds: 4, message: `${target.nickname} ne peut pas valider pendant 4 secondes.` };
  } else if (input.joker === "overclock") {
    effect = { kind: "overclock", multiplier: 2, message: "Overclock actif : votre prochaine réponse Motus correcte rapporte le double." };
  } else if (input.joker === "curse_trap") {
    if (!input.targetPlayerId || input.targetPlayerId === player.id) throw new Error("Choisissez un adversaire pour le piège maudit.");
    const [target] = await db.select({ id: multiplayerPlayers.id, nickname: multiplayerPlayers.nickname }).from(multiplayerPlayers).where(and(eq(multiplayerPlayers.roomId, room.id), eq(multiplayerPlayers.id, input.targetPlayerId))).limit(1);
    if (!target) throw new Error("Ce joueur ne fait pas partie de ce salon.");
    effect = { kind: "curse_trap", targetPlayerId: target.id, targetNickname: target.nickname, message: `Piège maudit posé : le prochain contrat de ${target.nickname} sera signalé à la table.` };
  } else if (input.joker === "shield") {
    const endsAt = new Date(Date.now() + shieldDurationMilliseconds);
    effect = { kind: "shield", message: "Parade active pendant 6 secondes : le prochain Brouillard dirigé contre vous sera dissipé.", active: true, seconds: 6, endsAt: endsAt.toISOString() };
  } else if (input.joker === "bonus_attempt") {
    if (room.gameMode !== "motus") throw new Error("L’essai bonus est réservé à Motus.");
    effect = { kind: "bonus_attempt", message: "Essai bonus activé : une proposition supplémentaire vous est accordée pour cette manche." };
  } else if (input.joker === "random_letter") {
    if (room.gameMode !== "motus") throw new Error("La lettre aléatoire est réservée à Motus.");
    const letters = Array.from(new Set(Array.from(round.answerKey)));
    const letter = letters[Math.floor(Math.random() * letters.length)];
    effect = { kind: "random_letter", letter, message: `Lettre révélée : « ${letter} » appartient au mot.` };
  } else if (input.joker === "opponent_progress") {
    if (room.gameMode !== "motus") throw new Error("Le Radar adverse est réservé à Motus.");
    const opponents = await db.select({ id: multiplayerPlayers.id, nickname: multiplayerPlayers.nickname }).from(multiplayerPlayers)
      .where(and(eq(multiplayerPlayers.roomId, room.id), sql`${multiplayerPlayers.id} <> ${player.id}`));
    if (!opponents.length) throw new Error("Un adversaire est nécessaire pour utiliser le Radar.");
    const target = opponents[Math.floor(Math.random() * opponents.length)]!;
    const attempts = await db.select({ feedback: multiplayerSubmissions.feedback }).from(multiplayerSubmissions)
      .where(and(eq(multiplayerSubmissions.roundId, round.id), eq(multiplayerSubmissions.playerId, target.id))).orderBy(desc(multiplayerSubmissions.attemptIndex));
    const latest = attempts[0]?.feedback ? parseData(attempts[0].feedback) : [];
    const exact = Array.isArray(latest) ? latest.filter((state) => state === "exact").length : 0;
    effect = { kind: "opponent_progress", targetPlayerId: target.id, targetNickname: target.nickname, message: `Radar : ${target.nickname} a fait ${attempts.length} essai${attempts.length > 1 ? "s" : ""} ; ${exact} lettre${exact > 1 ? "s" : ""} bien placée${exact > 1 ? "s" : ""} sur son dernier mot.` };
  } else if (input.joker === "exact_letter") {
    if (room.gameMode !== "motus") throw new Error("La Lettre placée est réservée à Motus.");
    const index = Math.floor(Math.random() * round.answerKey.length);
    const letter = round.answerKey[index]?.toLocaleUpperCase("fr-FR");
    effect = { kind: "exact_letter", index, letter, message: `Lettre placée : la case ${index + 1} contient « ${letter} ».` };
  } else if (input.joker === "peek") {
    if (room.gameMode !== "motus" && room.gameMode !== "definition") throw new Error("L’aperçu adverse est réservé à Motus et Mots liés.");
    if (!input.targetPlayerId || input.targetPlayerId === player.id) throw new Error("Choisissez un adversaire à observer.");
    const [target] = await db.select({ id: multiplayerPlayers.id, nickname: multiplayerPlayers.nickname }).from(multiplayerPlayers)
      .where(and(eq(multiplayerPlayers.roomId, room.id), eq(multiplayerPlayers.id, input.targetPlayerId))).limit(1);
    if (!target) throw new Error("Ce joueur ne fait pas partie de ce salon.");
    const endsAt = new Date(Date.now() + peekDurationMilliseconds);
    effect = { kind: "peek", targetPlayerId: target.id, targetNickname: target.nickname, endsAt: endsAt.toISOString(), seconds: 3, message: `Aperçu de ${target.nickname} pendant 3 secondes.` };
  } else {
    const ownSubmissions = await db.select().from(multiplayerSubmissions)
      .where(and(eq(multiplayerSubmissions.roundId, round.id), eq(multiplayerSubmissions.playerId, player.id)))
      .orderBy(asc(multiplayerSubmissions.attemptIndex));
    if (room.gameMode === "quiz" && (!ownSubmissions.length || ownSubmissions.some((submission) => submission.isCorrect))) {
      throw new Error("Répondez d’abord de manière erronée avant d’utiliser Seconde chance.");
    }
    if (room.gameMode === "motus") {
      const maxAttempts = Number(parseData(round.publicData).attempts ?? 0);
      if (!maxAttempts || ownSubmissions.length < maxAttempts || ownSubmissions.some((submission) => submission.isCorrect)) {
        throw new Error("Utilisez Seconde chance après votre dernier essai Motus non concluant.");
      }
    }
    if (room.gameMode === "definition" && !ownSubmissions.some((submission) => !submission.isCorrect)) {
      throw new Error("Faites d’abord une association erronée avant d’utiliser Seconde chance.");
    }
    effect = { kind: "second_chance", message: "Seconde chance activée : une reprise limitée rapporte la moitié des points." };
  }

  await db.insert(multiplayerJokerUses).values({ roundId: round.id, playerId: player.id, joker: input.joker, effect: JSON.stringify(effect) });
  if (rewardId) await db.update(multiplayerPlayerRewards).set({ consumedRoundId: round.id }).where(eq(multiplayerPlayerRewards.id, rewardId));
  await recordRoomEvent({ roomId: room.id, roundId: round.id, playerId: player.id, eventType: "joker_used", summary: `${player.nickname} utilise « ${jokerLabels[input.joker]} »${input.targetPlayerId ? " sur un adversaire" : ""}.`, effect });
  return getMultiplayerRoomState(input);
}

export async function proposeMotusLetterTrade(input: { code: string; resumeToken: string; targetPlayerId: number; offeredLetter: string }) {
  const { db, room } = await requireRoom(input.code);
  const { player } = await requirePlayer(room.id, input.resumeToken);
  if (room.gameMode !== "motus") throw new Error("Le troc de lettres est réservé à Motus.");
  const round = await getActiveRound(room.id);
  if (input.targetPlayerId === player.id) throw new Error("Vous ne pouvez pas troquer avec vous-même.");
  const [target] = await db.select({ id: multiplayerPlayers.id, nickname: multiplayerPlayers.nickname })
    .from(multiplayerPlayers)
    .where(and(eq(multiplayerPlayers.roomId, room.id), eq(multiplayerPlayers.id, input.targetPlayerId)))
    .limit(1);
  if (!target) throw new Error("Ce joueur ne fait pas partie du salon.");
  const offeredLetter = normalizeTradeLetter(input.offeredLetter);
  if (!offeredLetter) throw new Error("Choisissez une lettre valide.");
  await expireTradeOffers(round.id);
  return db.transaction(async (tx) => {
    const sourceLetters = await getKnownMotusLetters(round.id, player.id);
    if (!sourceLetters.has(offeredLetter)) throw new Error("Vous ne pouvez proposer qu’une lettre déjà vérifiée dans vos propres indices.");
    const [recentOffer] = await tx.select({ respondedAt: multiplayerTradeOffers.respondedAt })
      .from(multiplayerTradeOffers)
      .where(and(eq(multiplayerTradeOffers.roundId, round.id), eq(multiplayerTradeOffers.fromPlayerId, player.id), sql`${multiplayerTradeOffers.status} IN ('declined', 'expired', 'cancelled')`))
      .orderBy(desc(multiplayerTradeOffers.respondedAt))
      .limit(1);
    if (recentOffer?.respondedAt && Date.now() - recentOffer.respondedAt.getTime() < TRADE_COOLDOWN_MS) {
      const waitSeconds = Math.ceil((TRADE_COOLDOWN_MS - (Date.now() - recentOffer.respondedAt.getTime())) / 1_000);
      throw new Error(`Patientez encore ${waitSeconds}s avant de reproposer un troc.`);
    }
    const [pendingOffer] = await tx.select({ id: multiplayerTradeOffers.id })
      .from(multiplayerTradeOffers)
      .where(and(eq(multiplayerTradeOffers.roundId, round.id), eq(multiplayerTradeOffers.status, "pending"), sql`(${multiplayerTradeOffers.fromPlayerId} IN (${player.id}, ${target.id}) OR ${multiplayerTradeOffers.toPlayerId} IN (${player.id}, ${target.id}))`))
      .limit(1);
    if (pendingOffer) throw new Error("Un échange est déjà en cours avec ce joueur.");
    const expiresAt = new Date(Date.now() + TRADE_TIMEOUT_MS);
    const result = await tx.insert(multiplayerTradeOffers).values({ roomId: room.id, roundId: round.id, fromPlayerId: player.id, toPlayerId: target.id, offeredLetter, requestedLetter: "?", expiresAt, status: "pending" });
    await recordRoomEvent({ roomId: room.id, roundId: round.id, playerId: player.id, eventType: "trade_offered", summary: `${player.nickname} propose un troc mystère à ${target.nickname}.`, effect: { tradeId: asInsertId(result), targetPlayerId: target.id } });
    return getMultiplayerRoomState(input);
  });
}

export async function cancelMotusLetterTrade(input: { code: string; resumeToken: string; tradeId: number }) {
  const { db, room } = await requireRoom(input.code);
  const { player } = await requirePlayer(room.id, input.resumeToken);
  if (room.gameMode !== "motus") throw new Error("Le troc de lettres est réservé à Motus.");
  const round = await getActiveRound(room.id);
  return db.transaction(async (tx) => {
    const [offer] = await tx.select().from(multiplayerTradeOffers)
      .where(and(eq(multiplayerTradeOffers.id, input.tradeId), eq(multiplayerTradeOffers.roundId, round.id), eq(multiplayerTradeOffers.fromPlayerId, player.id), eq(multiplayerTradeOffers.status, "pending")))
      .limit(1);
    if (!offer) throw new Error("Cette offre n’existe plus ou a déjà été traitée.");
    await tx.update(multiplayerTradeOffers).set({ status: "cancelled", respondedAt: new Date() }).where(eq(multiplayerTradeOffers.id, offer.id));
    await recordRoomEvent({ roomId: room.id, roundId: round.id, playerId: player.id, eventType: "trade_cancelled", summary: `${player.nickname} a annulé sa proposition de troc.` });
    return getMultiplayerRoomState(input);
  });
}

export async function respondToMotusLetterTrade(input: { code: string; resumeToken: string; tradeId: number; accept: boolean; returnLetter?: string }) {
  const { db, room } = await requireRoom(input.code);
  const { player } = await requirePlayer(room.id, input.resumeToken);
  if (room.gameMode !== "motus") throw new Error("Le troc de lettres est réservé à Motus.");
  const round = await getActiveRound(room.id);
  return db.transaction(async (tx) => {
    const [offer] = await tx.select().from(multiplayerTradeOffers)
      .where(and(eq(multiplayerTradeOffers.id, input.tradeId), eq(multiplayerTradeOffers.roundId, round.id), eq(multiplayerTradeOffers.toPlayerId, player.id), eq(multiplayerTradeOffers.status, "pending")))
      .limit(1);
    if (!offer) throw new Error("Cette offre de troc n’est plus disponible.");
    if (offer.expiresAt.getTime() <= Date.now()) {
      await tx.update(multiplayerTradeOffers).set({ status: "expired", respondedAt: new Date() }).where(eq(multiplayerTradeOffers.id, offer.id));
      throw new Error("Cette offre de troc a expiré.");
    }
    if (!input.accept) {
      await tx.update(multiplayerTradeOffers).set({ status: "declined", respondedAt: new Date() }).where(eq(multiplayerTradeOffers.id, offer.id));
      await recordRoomEvent({ roomId: room.id, roundId: round.id, playerId: player.id, eventType: "trade_declined", summary: `${player.nickname} a décliné le troc.` });
      return getMultiplayerRoomState(input);
    }
    const targetLetters = await getKnownMotusLetters(round.id, player.id);
    const returnLetter = normalizeTradeLetter(input.returnLetter ?? "");
    if (!returnLetter || !targetLetters.has(returnLetter)) throw new Error("Choisissez une de vos lettres réellement vérifiées pour finaliser l’échange.");
    if (returnLetter === offer.offeredLetter) throw new Error("Choisissez une lettre différente de celle proposée.");
    const sourceLetters = await getKnownMotusLetters(round.id, offer.fromPlayerId);
    if (!sourceLetters.has(offer.offeredLetter)) throw new Error("La lettre proposée n’est plus vérifiée ; le troc ne peut pas être accepté.");
    await tx.update(multiplayerTradeOffers).set({ status: "accepted", requestedLetter: returnLetter, respondedAt: new Date() }).where(eq(multiplayerTradeOffers.id, offer.id));
    await recordRoomEvent({ roomId: room.id, roundId: round.id, playerId: player.id, eventType: "trade_completed", summary: `Troc conclu avec succès entre ${player.nickname} et son adversaire !`, effect: { tradeId: offer.id } });
    return getMultiplayerRoomState(input);
  });
}

export async function openTacticalContract(input: { code: string; resumeToken: string; contractType: TacticalContractType; offeredLetter?: string; targetPlayerId?: number; minimumBid: number }) {
  const { db, room } = await requireRoom(input.code);
  const { player } = await requirePlayer(room.id, input.resumeToken);
  const round = await getActiveRound(room.id);
  if (input.minimumBid < 0 || input.minimumBid > 100) throw new Error("La mise minimale doit être comprise entre 0 et 100 PM.");
  if (input.targetPlayerId === player.id) throw new Error("Un contrat ne peut pas vous cibler vous-même.");
  if (input.targetPlayerId) {
    const [target] = await db.select({ id: multiplayerPlayers.id }).from(multiplayerPlayers).where(and(eq(multiplayerPlayers.roomId, room.id), eq(multiplayerPlayers.id, input.targetPlayerId))).limit(1);
    if (!target) throw new Error("La cible du contrat n’est plus présente dans ce salon.");
  }
  const offeredLetter = normalizeTradeLetter(input.offeredLetter ?? "");
  let hint: ReturnType<typeof buildCryptoHint> | null = null;
  if (input.contractType === "letter" || input.contractType === "cryptohint") {
    if (!offeredLetter) throw new Error("Choisissez une lettre vérifiée pour ouvrir ce contrat.");
    const knownLetters = await getKnownMotusLetters(round.id, player.id);
    if (!knownLetters.has(offeredLetter)) throw new Error("Le contrat doit partir d’une lettre réellement vérifiée.");
    if (input.contractType === "cryptohint") hint = buildCryptoHint(offeredLetter);
  }
  const [trapUse] = await db.select().from(multiplayerJokerUses).where(and(eq(multiplayerJokerUses.roundId, round.id), eq(multiplayerJokerUses.joker, "curse_trap"))).orderBy(desc(multiplayerJokerUses.createdAt)).limit(1);
  const trapEffect = trapUse ? parseJokerEffect(trapUse.effect) : null;
  const cursed = Boolean(trapEffect?.kind === "curse_trap" && Number(trapEffect.targetPlayerId) === player.id && !trapEffect.triggeredAt);
  const contractHint = hint || cursed ? JSON.stringify({ ...(hint ?? {}), ...(cursed ? { cursed: true } : {}) }) : null;
  const minimumBid = input.minimumBid + (cursed ? 5 : 0);
  const result = await db.insert(multiplayerTacticalContracts).values({ roomId: room.id, roundId: round.id, fromPlayerId: player.id, targetPlayerId: input.targetPlayerId ?? null, contractType: input.contractType, offeredLetter: input.contractType === "letter" ? offeredLetter : null, hint: contractHint, minimumBid, expiresAt: new Date(Date.now() + TACTICAL_CONTRACT_TIMEOUT_MS) });
  if (cursed && trapUse && trapEffect) await db.update(multiplayerJokerUses).set({ effect: JSON.stringify({ ...trapEffect, triggeredAt: new Date().toISOString(), message: `Piège déclenché sur le contrat de ${player.nickname}.` }) }).where(eq(multiplayerJokerUses.id, trapUse.id));
  await recordRoomEvent({ roomId: room.id, roundId: round.id, playerId: player.id, eventType: "contract_opened", summary: `${player.nickname} ouvre un contrat tactique${cursed ? " maudit" : ""}.`, effect: { contractId: asInsertId(result), contractType: input.contractType, cursed } });
  return getMultiplayerRoomState(input);
}

export async function placeTacticalBid(input: { code: string; resumeToken: string; contractId: number; manaAmount: number }) {
  const { db, room } = await requireRoom(input.code);
  let { player } = await requirePlayer(room.id, input.resumeToken);
  player = await refreshPlayerMana(player);
  const round = await getActiveRound(room.id);
  await db.update(multiplayerTacticalContracts).set({ status: "expired", resolvedAt: new Date() }).where(and(eq(multiplayerTacticalContracts.roundId, round.id), eq(multiplayerTacticalContracts.status, "open"), lt(multiplayerTacticalContracts.expiresAt, new Date())));
  return db.transaction(async (tx) => {
    const [contract] = await tx.select().from(multiplayerTacticalContracts).where(and(eq(multiplayerTacticalContracts.id, input.contractId), eq(multiplayerTacticalContracts.roundId, round.id), eq(multiplayerTacticalContracts.status, "open"))).limit(1);
    if (!contract || contract.expiresAt.getTime() <= Date.now()) throw new Error("Ce contrat n’est plus ouvert aux enchères.");
    if (contract.fromPlayerId === player.id) throw new Error("Vous ne pouvez pas enchérir sur votre propre contrat.");
    if (contract.targetPlayerId && contract.targetPlayerId !== player.id) throw new Error("Ce contrat est privé.");
    const [highest] = await tx.select().from(multiplayerTacticalBids).where(eq(multiplayerTacticalBids.contractId, contract.id)).orderBy(desc(multiplayerTacticalBids.manaAmount), desc(multiplayerTacticalBids.id)).limit(1);
    if (!isTacticalBidValid({ bid: input.manaAmount, minimumBid: contract.minimumBid, currentHighestBid: highest?.manaAmount ?? -1, availableMana: player.mana })) throw new Error("Votre enchère doit dépasser la mise actuelle sans excéder votre mana disponible.");
    await tx.insert(multiplayerTacticalBids).values({ contractId: contract.id, playerId: player.id, manaAmount: input.manaAmount }).onDuplicateKeyUpdate({ set: { manaAmount: input.manaAmount, createdAt: new Date() } });
    await recordRoomEvent({ roomId: room.id, roundId: round.id, playerId: player.id, eventType: "contract_bid", summary: `${player.nickname} place une enchère tactique.`, effect: { contractId: contract.id, manaAmount: input.manaAmount } });
    return getMultiplayerRoomState(input);
  });
}

export async function resolveTacticalContract(input: { code: string; resumeToken: string; contractId: number }) {
  const { db, room } = await requireRoom(input.code);
  let { player } = await requirePlayer(room.id, input.resumeToken);
  player = await refreshPlayerMana(player);
  const round = await getActiveRound(room.id);
  return db.transaction(async (tx) => {
    const [contract] = await tx.select().from(multiplayerTacticalContracts).where(and(eq(multiplayerTacticalContracts.id, input.contractId), eq(multiplayerTacticalContracts.roundId, round.id), eq(multiplayerTacticalContracts.status, "open"))).limit(1);
    if (!contract || contract.fromPlayerId !== player.id) throw new Error("Seul l’auteur peut conclure ce contrat ouvert.");
    const [winner] = await tx.select().from(multiplayerTacticalBids).where(eq(multiplayerTacticalBids.contractId, contract.id)).orderBy(desc(multiplayerTacticalBids.manaAmount), desc(multiplayerTacticalBids.id)).limit(1);
    if (!winner) throw new Error("Aucune enchère ne permet de conclure ce contrat.");
    const [bidder] = await tx.select().from(multiplayerPlayers).where(eq(multiplayerPlayers.id, winner.playerId)).limit(1);
    if (!bidder || bidder.mana < winner.manaAmount) throw new Error("Le gagnant ne dispose plus du mana nécessaire.");
    await tx.update(multiplayerPlayers).set({ mana: bidder.mana - winner.manaAmount, manaUpdatedAt: new Date() }).where(eq(multiplayerPlayers.id, bidder.id));
    await tx.update(multiplayerPlayers).set({ mana: Math.min(getMultiplayerManaCap(player.archetype), player.mana + winner.manaAmount), manaUpdatedAt: new Date() }).where(eq(multiplayerPlayers.id, player.id));
    await tx.update(multiplayerTacticalContracts).set({ status: "awarded", resolvedAt: new Date() }).where(eq(multiplayerTacticalContracts.id, contract.id));
    await recordRoomEvent({ roomId: room.id, roundId: round.id, playerId: player.id, eventType: "contract_awarded", summary: `${player.nickname} conclut un contrat tactique.`, effect: { contractId: contract.id, winnerPlayerId: bidder.id } });
    return getMultiplayerRoomState(input);
  });
}

export async function finishMultiplayerRoom(input: { code: string; resumeToken: string }) {
  const { db, room } = await requireRoom(input.code);
  const { player } = await requirePlayer(room.id, input.resumeToken);
  if (!player.isHost) throw new Error("Seul l’hôte peut terminer la partie.");
  await db.update(multiplayerRounds).set({ status: "resolved", resolvedAt: new Date() }).where(and(eq(multiplayerRounds.roomId, room.id), eq(multiplayerRounds.status, "active")));
  await db.update(multiplayerRooms).set({ status: "finished" }).where(eq(multiplayerRooms.id, room.id));
  await recordRoomEvent({ roomId: room.id, playerId: player.id, eventType: "room_finished", summary: "L’hôte a terminé la partie : le classement final est disponible." });
  return getMultiplayerRoomState(input);
}

export async function rematchMultiplayerRoom(input: { code: string; resumeToken: string }) {
  const { db, room } = await requireRoom(input.code);
  const { player } = await requirePlayer(room.id, input.resumeToken);
  if (!player.isHost) throw new Error("Seul l’hôte peut lancer une revanche.");
  if (room.status !== "finished") throw new Error("Terminez la partie actuelle avant de lancer une revanche.");
  await db.update(multiplayerPlayers).set({ score: 0 }).where(eq(multiplayerPlayers.roomId, room.id));
  await db.update(multiplayerRooms).set({ status: "lobby", currentRoundIndex: 0 }).where(eq(multiplayerRooms.id, room.id));
  return getMultiplayerRoomState(input);
}

export async function addMultiplayerReaction(input: { code: string; resumeToken: string; reaction: "Bien vu" | "À toi" | "Belle piste" }) {
  const { room } = await requireRoom(input.code);
  const { player } = await requirePlayer(room.id, input.resumeToken);
  await recordRoomEvent({ roomId: room.id, playerId: player.id, eventType: "reaction", summary: `${player.nickname} · ${input.reaction}.` });
  return getMultiplayerRoomState(input);
}
