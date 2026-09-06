export type MultiplayerGameMode = "quiz" | "motus" | "definition";
export type QuizVariant = "category" | "truefalse" | "gender";
export type MotusVariant = "classic" | "sprint" | "long";
export type DefinitionVariant = "match" | "synonym" | "antonym" | "intruder";
export type RoomVisibility = "private" | "public";
export type MultiplayerJoker = "compass" | "tempo" | "second_chance" | "fog" | "shield" | "bonus_attempt" | "random_letter" | "peek" | "opponent_progress" | "exact_letter" | "mana_siphon" | "blackout" | "overclock" | "curse_trap" | "trade_letter";

export const multiplayerRoundLimits = [3, 5, 8, 10, 12] as const;
export const multiplayerRoundDurations = [0, 30, 45, 60, 75, 120, 180, 300] as const;
export const fogDurationMilliseconds = 5_000;
export const peekDurationMilliseconds = 3_000;
export const shieldDurationMilliseconds = 6_000;
export const commonJokers = ["compass", "tempo", "second_chance", "fog", "shield"] as const satisfies readonly MultiplayerJoker[];
export const motusJokers = ["bonus_attempt", "random_letter", "peek", "opponent_progress", "exact_letter", "mana_siphon", "blackout", "overclock", "curse_trap"] as const satisfies readonly MultiplayerJoker[];
export const allMultiplayerJokers = [...commonJokers, ...motusJokers] as const satisfies readonly MultiplayerJoker[];
export const motusRewardJokers = motusJokers;

export function isMultiplayerJoker(value: string): value is MultiplayerJoker {
  return (allMultiplayerJokers as readonly string[]).includes(value);
}

export function isJokerCompatibleWithGame(joker: MultiplayerJoker, gameMode: MultiplayerGameMode) {
  if (joker === "compass") return gameMode !== "quiz";
  if (joker === "bonus_attempt" || joker === "random_letter" || joker === "opponent_progress" || joker === "exact_letter" || joker === "mana_siphon" || joker === "blackout" || joker === "overclock" || joker === "curse_trap" || joker === "trade_letter") return gameMode === "motus";
  if (joker === "peek") return gameMode === "motus" || gameMode === "definition";
  return true;
}

export function defaultJokerDeck(gameMode: MultiplayerGameMode): MultiplayerJoker[] {
  const extras: MultiplayerJoker[] = gameMode === "motus" ? [...motusJokers] : gameMode === "definition" ? ["peek"] : [];
  return [...commonJokers.filter((joker) => isJokerCompatibleWithGame(joker, gameMode)), ...extras];
}

export function normalizeJokerDeck(values: string[] | null | undefined, gameMode: MultiplayerGameMode) {
  if (Array.isArray(values) && values.length === 0) return [] as MultiplayerJoker[];
  const candidates: MultiplayerJoker[] = values
    ? values.filter((value): value is MultiplayerJoker => isMultiplayerJoker(value))
    : defaultJokerDeck(gameMode);
  const deck = Array.from(new Set(candidates.filter((joker) => isJokerCompatibleWithGame(joker, gameMode))));
  return deck.length ? deck : defaultJokerDeck(gameMode);
}

export function isFogEffectActive(effect: Record<string, unknown> | null, viewerId: number, now = Date.now()) {
  if (!effect || effect.kind !== "fog" || effect.prevented === true || Number(effect.targetPlayerId) !== viewerId || typeof effect.endsAt !== "string") return false;
  return new Date(effect.endsAt).getTime() > now;
}

export function isShieldEffectActive(effect: Record<string, unknown> | null, now = Date.now()) {
  if (!effect || effect.kind !== "shield" || effect.triggeredAt || typeof effect.endsAt !== "string") return false;
  return new Date(effect.endsAt).getTime() > now;
}

export function isPeekEffectActive(effect: Record<string, unknown> | null, now = Date.now()) {
  if (!effect || effect.kind !== "peek" || typeof effect.endsAt !== "string") return false;
  return new Date(effect.endsAt).getTime() > now;
}

export function createFogEffect(targetPlayerId: number, targetNickname: string, endsAt: string, prevented: boolean) {
  return {
    kind: "fog" as const,
    targetPlayerId,
    targetNickname,
    endsAt,
    seconds: 5,
    ...(prevented ? { prevented: true, preventedBy: "shield" } : {}),
  };
}

export const motusMultiplayerFormats: Record<MotusVariant, { attempts: number; minLength: number; maxLength: number }> = {
  classic: { attempts: 6, minLength: 4, maxLength: 8 },
  sprint: { attempts: 4, minLength: 4, maxLength: 6 },
  long: { attempts: 8, minLength: 7, maxLength: 12 },
};

export function isQuizVariant(value: string): value is QuizVariant {
  return value === "category" || value === "truefalse" || value === "gender";
}

export function isMotusVariant(value: string): value is MotusVariant {
  return value === "classic" || value === "sprint" || value === "long";
}

export function isDefinitionVariant(value: string): value is DefinitionVariant {
  return value === "match" || value === "synonym" || value === "antonym" || value === "intruder";
}

export function isRoomVisibility(value: string): value is RoomVisibility {
  return value === "private" || value === "public";
}

export function isMultiplayerRoundLimit(value: number) {
  return multiplayerRoundLimits.includes(value as typeof multiplayerRoundLimits[number]);
}

export function isMultiplayerRoundDuration(value: number) {
  return multiplayerRoundDurations.includes(value as typeof multiplayerRoundDurations[number]);
}

export function getQuizPoints(correctRank: number) {
  return [100, 70, 50, 30, 20][correctRank] ?? 10;
}

export function getMotusPoints(correctRank: number, attemptIndex: number) {
  return Math.max(20, 100 - correctRank * 20 - Math.max(0, attemptIndex - 1) * 10);
}

export function makeRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}
