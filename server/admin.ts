import { and, asc, count, desc, eq, like, or, sql } from "drizzle-orm";
import {
  adminAuditLogs,
  adminSystemConfigurations,
  dailyRuns,
  lexicalDefinitions,
  lexicalEntries,
  lexiconCurations,
  multiplayerPlayers,
  multiplayerRoomEvents,
  multiplayerRounds,
  multiplayerRooms,
  soloGameSessions,
} from "../drizzle/schema";
import { getDb } from "./db";

export type BannerLevel = "info" | "attention";
export type GlobalBanner = { active: boolean; message: string; level: BannerLevel };
export type AdminRoomPlayer = { id: number; nickname: string; isHost: boolean };

const DEFAULT_BANNER: GlobalBanner = { active: false, message: "", level: "info" };

export function planAdminRoomKick(players: AdminRoomPlayer[], targetPlayerId: number) {
  const target = players.find((player) => player.id === targetPlayerId);
  if (!target) return null;
  const remaining = players.filter((player) => player.id !== targetPlayerId);
  const successor = target.isHost ? remaining[0] ?? null : players.find((player) => player.isHost) ?? null;
  return { target, successor, shouldCloseRoom: remaining.length === 0 };
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function normalizeCurationInput(input: { difficulty: "facile" | "moyen" | "difficile" | "diabolique"; frequencyWeight: number; tags: string[]; isActive: boolean; editorialNote?: string }) {
  const tags = Array.from(new Set(input.tags.map((tag) => tag.trim().toLocaleLowerCase("fr-FR")).filter((tag) => tag.length >= 2 && tag.length <= 32))).slice(0, 12);
  return {
    difficulty: input.difficulty,
    frequencyWeight: Math.max(1, Math.min(500, Math.round(input.frequencyWeight))),
    tags,
    isActive: input.isActive,
    editorialNote: input.editorialNote?.trim().slice(0, 1_000) || null,
  };
}

async function logAdminAction(input: { action: string; targetType: string; targetId: string; adminOpenId: string; summary: string; metadata?: Record<string, unknown> }) {
  const db = await getDb();
  if (!db) return;
  await db.insert(adminAuditLogs).values({
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    adminOpenId: input.adminOpenId,
    summary: input.summary.slice(0, 240),
    metadata: input.metadata ? JSON.stringify(input.metadata) : null,
  });
}

export async function getPublicGlobalBanner(): Promise<GlobalBanner> {
  const db = await getDb();
  if (!db) return DEFAULT_BANNER;
  const [config] = await db.select({ value: adminSystemConfigurations.value }).from(adminSystemConfigurations).where(eq(adminSystemConfigurations.key, ********)).limit(1);
  const banner = parseJson<GlobalBanner>(config?.value, DEFAULT_BANNER);
  return {
    active: Boolean(banner.active && banner.message?.trim()),
    message: String(banner.message ?? "").trim().slice(0, 240),
    level: banner.level === "attention" ? "attention" : "info",
  };
}

export async function setGlobalBanner(input: GlobalBanner & { adminOpenId: string }) {
  const banner: GlobalBanner = {
    active: input.active,
    message: input.message.trim().slice(0, 240),
    level: input.level,
  };
  const db = await getDb();
  if (!db) throw new Error("La base de données est indisponible.");
  await db.insert(adminSystemConfigurations).values({ key: ********, value: JSON.stringify(banner), updatedByOpenId: input.adminOpenId })
    .onDuplicateKeyUpdate({ set: { value: JSON.stringify(banner), updatedByOpenId: input.adminOpenId } });
  await logAdminAction({
    action: "UPDATE_GLOBAL_BANNER",
    targetType: "system_configuration",
    targetId: ********,
    adminOpenId: input.adminOpenId,
    summary: banner.active ? "Bandeau global activé." : "Bandeau global désactivé.",
    metadata: { level: banner.level },
  });
  return banner;
}

export async function getAdminOverview() {
  const db = await getDb();
  if (!db) return { lexiconEntries: 0, definitions: 0, activeRooms: 0, resolvedSoloRuns: 0, resolvedDailyRuns: 0, recentAuditActions: [] as Awaited<ReturnType<typeof getAdminAuditLog>> };
  const [entries, definitions, rooms, soloRuns, dailyResolved] = await Promise.all([
    db.select({ value: count() }).from(lexicalEntries),
    db.select({ value: count() }).from(lexicalDefinitions),
    db.select({ value: count() }).from(multiplayerRooms).where(eq(multiplayerRooms.status, "active")),
    db.select({ value: count() }).from(soloGameSessions).where(eq(soloGameSessions.status, "resolved")),
    db.select({ value: count() }).from(dailyRuns).where(or(eq(dailyRuns.status, "won"), eq(dailyRuns.status, "lost"))),
  ]);
  return {
    lexiconEntries: Number(entries[0]?.value ?? 0),
    definitions: Number(definitions[0]?.value ?? 0),
    activeRooms: Number(rooms[0]?.value ?? 0),
    resolvedSoloRuns: Number(soloRuns[0]?.value ?? 0),
    resolvedDailyRuns: Number(dailyResolved[0]?.value ?? 0),
    recentAuditActions: await getAdminAuditLog(6),
  };
}

export async function getAdminAnalytics() {
  const db = await getDb();
  if (!db) {
    return {
      soloAttempts: [] as Array<{ attempts: number; total: number }>,
      dailyModes: [] as Array<{ mode: string; total: number }>,
      roomModes: [] as Array<{ mode: string; total: number }>,
    };
  }
  const [soloAttempts, dailyModes, roomModes] = await Promise.all([
    db.select({ attempts: soloGameSessions.attempts, total: count() })
      .from(soloGameSessions)
      .where(eq(soloGameSessions.status, "resolved"))
      .groupBy(soloGameSessions.attempts)
      .orderBy(asc(soloGameSessions.attempts)),
    db.select({ mode: dailyRuns.mode, total: count() })
      .from(dailyRuns)
      .groupBy(dailyRuns.mode)
      .orderBy(asc(dailyRuns.mode)),
    db.select({ mode: multiplayerRooms.gameMode, total: count() })
      .from(multiplayerRooms)
      .groupBy(multiplayerRooms.gameMode)
      .orderBy(asc(multiplayerRooms.gameMode)),
  ]);
  return {
    soloAttempts: soloAttempts.map((row) => ({ attempts: row.attempts, total: Number(row.total) })),
    dailyModes: dailyModes.map((row) => ({ mode: row.mode, total: Number(row.total) })),
    roomModes: roomModes.map((row) => ({ mode: row.mode, total: Number(row.total) })),
  };
}

export async function searchAdminLexicon(query: string, limit = 24) {
  const db = await getDb();
  if (!db) return [];
  const normalized = query.trim();
  const predicate = normalized
    ? or(like(lexicalEntries.lemma, `%${normalized}%`), like(lexicalEntries.normalizedLemma, `%${normalized.toLocaleLowerCase("fr-FR")}%`))
    : sql`1 = 1`;
  const rows = await db.select({
    id: lexicalEntries.id,
    lemma: lexicalEntries.lemma,
    category: lexicalEntries.category,
    cnrtlUrl: lexicalEntries.cnrtlUrl,
    difficulty: lexiconCurations.difficulty,
    frequencyWeight: lexiconCurations.frequencyWeight,
    tags: lexiconCurations.tags,
    isActive: lexiconCurations.isActive,
    editorialNote: lexiconCurations.editorialNote,
  }).from(lexicalEntries).leftJoin(lexiconCurations, eq(lexiconCurations.lexicalEntryId, lexicalEntries.id)).where(predicate).orderBy(asc(lexicalEntries.lemma)).limit(limit);
  return rows.map((row) => ({
    ...row,
    difficulty: row.difficulty ?? "moyen",
    frequencyWeight: row.frequencyWeight ?? 100,
    tags: parseJson<string[]>(row.tags, []),
    isActive: row.isActive === null ? true : Boolean(row.isActive),
  }));
}

export async function saveLexiconCuration(input: { lexicalEntryId: number; difficulty: "facile" | "moyen" | "difficile" | "diabolique"; frequencyWeight: number; tags: string[]; isActive: boolean; editorialNote?: string; adminOpenId: string }) {
  const db = await getDb();
  if (!db) throw new Error("La base de données est indisponible.");
  const [entry] = await db.select({ id: lexicalEntries.id, lemma: lexicalEntries.lemma }).from(lexicalEntries).where(eq(lexicalEntries.id, input.lexicalEntryId)).limit(1);
  if (!entry) throw new Error("Entrée lexicale introuvable.");
  const normalized = normalizeCurationInput(input);
  await db.insert(lexiconCurations).values({
    lexicalEntryId: entry.id,
    difficulty: normalized.difficulty,
    frequencyWeight: normalized.frequencyWeight,
    tags: JSON.stringify(normalized.tags),
    isActive: normalized.isActive ? 1 : 0,
    editorialNote: normalized.editorialNote,
    updatedByOpenId: input.adminOpenId,
  }).onDuplicateKeyUpdate({ set: {
    difficulty: normalized.difficulty,
    frequencyWeight: normalized.frequencyWeight,
    tags: JSON.stringify(normalized.tags),
    isActive: normalized.isActive ? 1 : 0,
    editorialNote: normalized.editorialNote,
    updatedByOpenId: input.adminOpenId,
  } });
  await logAdminAction({
    action: "CURATE_LEXICON_ENTRY",
    targetType: "lexical_entry",
    targetId: String(entry.id),
    adminOpenId: input.adminOpenId,
    summary: `Curation mise à jour pour « ${entry.lemma} ».`,
    metadata: { difficulty: normalized.difficulty, isActive: normalized.isActive },
  });
  return { entryId: entry.id, lemma: entry.lemma, ...normalized };
}

export async function getAdminRoomRadar(limit = 40) {
  const db = await getDb();
  if (!db) return [];
  const [rooms, players] = await Promise.all([
    db.select().from(multiplayerRooms).orderBy(desc(multiplayerRooms.updatedAt)).limit(limit),
    db.select({ id: multiplayerPlayers.id, roomId: multiplayerPlayers.roomId, nickname: multiplayerPlayers.nickname, isHost: multiplayerPlayers.isHost })
      .from(multiplayerPlayers)
      .orderBy(asc(multiplayerPlayers.id)),
  ]);
  const playersByRoom = new Map<number, AdminRoomPlayer[]>();
  players.forEach((player) => {
    const roster = playersByRoom.get(player.roomId) ?? [];
    roster.push({ id: player.id, nickname: player.nickname, isHost: Boolean(player.isHost) });
    playersByRoom.set(player.roomId, roster);
  });
  return rooms.map((room) => {
    const roster = playersByRoom.get(room.id) ?? [];
    return {
      id: room.id,
      code: room.code,
      title: room.title,
      gameMode: room.gameMode,
      variant: room.variant,
      status: room.status,
      visibility: room.visibility,
      players: roster,
      playerCount: roster.length,
      round: room.currentRoundIndex,
      updatedAt: room.updatedAt,
    };
  });
}

export async function closeRoomAsAdmin(input: { roomId: number; adminOpenId: string }) {
  const db = await getDb();
  if (!db) throw new Error("La base de données est indisponible.");
  const [room] = await db.select({ id: multiplayerRooms.id, code: multiplayerRooms.code, title: multiplayerRooms.title, status: multiplayerRooms.status }).from(multiplayerRooms).where(eq(multiplayerRooms.id, input.roomId)).limit(1);
  if (!room) throw new Error("Salon introuvable.");
  if (room.status !== "finished") {
    await db.update(multiplayerRounds).set({ status: "resolved", resolvedAt: new Date() })
      .where(and(eq(multiplayerRounds.roomId, room.id), eq(multiplayerRounds.status, "active")));
    await db.update(multiplayerRooms).set({ status: "finished" }).where(eq(multiplayerRooms.id, room.id));
    await db.insert(multiplayerRoomEvents).values({ roomId: room.id, eventType: "admin_room_closed", summary: "[Système] Le salon a été fermé par l’administration." });
  }
  await logAdminAction({ action: "CLOSE_ROOM", targetType: "multiplayer_room", targetId: String(room.id), adminOpenId: input.adminOpenId, summary: `Salon ${room.code} fermé depuis le radar.`, metadata: { code: room.code } });
  return { id: room.id, code: room.code, status: "finished" as const };
}

export async function kickRoomPlayerAsAdmin(input: { roomId: number; playerId: number; adminOpenId: string }) {
  const db = await getDb();
  if (!db) throw new Error("La base de données est indisponible.");
  const [room] = await db.select({ id: multiplayerRooms.id, code: multiplayerRooms.code, status: multiplayerRooms.status })
    .from(multiplayerRooms).where(eq(multiplayerRooms.id, input.roomId)).limit(1);
  if (!room || room.status === "finished") throw new Error("Ce salon n’est plus disponible.");
  const players = await db.select({ id: multiplayerPlayers.id, nickname: multiplayerPlayers.nickname, isHost: multiplayerPlayers.isHost })
    .from(multiplayerPlayers).where(eq(multiplayerPlayers.roomId, room.id)).orderBy(asc(multiplayerPlayers.id));
  const plan = planAdminRoomKick(players.map((player) => ({ ...player, isHost: Boolean(player.isHost) })), input.playerId);
  if (!plan) throw new Error("Ce joueur ne fait pas partie du salon.");
  if (plan.successor) {
    await db.update(multiplayerPlayers).set({ isHost: 0 }).where(eq(multiplayerPlayers.roomId, room.id));
    await db.update(multiplayerPlayers).set({ isHost: 1 }).where(eq(multiplayerPlayers.id, plan.successor.id));
    await db.update(multiplayerRooms).set({ hostPlayerId: plan.successor.id }).where(eq(multiplayerRooms.id, room.id));
  }
  await db.delete(multiplayerPlayers).where(eq(multiplayerPlayers.id, plan.target.id));
  if (plan.shouldCloseRoom) {
    await db.update(multiplayerRounds).set({ status: "resolved", resolvedAt: new Date() })
      .where(and(eq(multiplayerRounds.roomId, room.id), eq(multiplayerRounds.status, "active")));
    await db.update(multiplayerRooms).set({ status: "finished", hostPlayerId: null }).where(eq(multiplayerRooms.id, room.id));
  }
  const transition = plan.shouldCloseRoom
    ? "Le salon a été fermé car il ne restait plus de participant."
    : plan.successor && plan.target.isHost
      ? `${plan.successor.nickname} devient l’hôte du salon.`
      : "Le salon reste ouvert pour les autres participants.";
  await db.insert(multiplayerRoomEvents).values({ roomId: room.id, eventType: "admin_player_removed", summary: `[Système] ${plan.target.nickname} a été retiré du salon. ${transition}` });
  await logAdminAction({
    action: "KICK_ROOM_PLAYER",
    targetType: "multiplayer_player",
    targetId: String(plan.target.id),
    adminOpenId: input.adminOpenId,
    summary: `${plan.target.nickname} a été retiré du salon ${room.code}.`,
    metadata: { roomId: room.id, successorId: plan.successor?.id ?? null, roomClosed: plan.shouldCloseRoom },
  });
  return { roomId: room.id, playerId: plan.target.id, successorId: plan.successor?.id ?? null, roomClosed: plan.shouldCloseRoom };
}

export async function postRoomAnnouncementAsAdmin(input: { roomId: number; message: string; adminOpenId: string }) {
  const message = input.message.trim().replace(/\s+/g, " ").slice(0, 220);
  if (!message) throw new Error("Le message de salon ne peut pas être vide.");
  const db = await getDb();
  if (!db) throw new Error("La base de données est indisponible.");
  const [room] = await db.select({ id: multiplayerRooms.id, code: multiplayerRooms.code, status: multiplayerRooms.status }).from(multiplayerRooms).where(eq(multiplayerRooms.id, input.roomId)).limit(1);
  if (!room || room.status === "finished") throw new Error("Ce salon n’est plus disponible pour une annonce.");
  await db.insert(multiplayerRoomEvents).values({
    roomId: room.id,
    eventType: "admin_announcement",
    summary: `[Système] ${message}`,
    effect: JSON.stringify({ source: "admin" }),
  });
  await logAdminAction({
    action: "POST_ROOM_ANNOUNCEMENT",
    targetType: "multiplayer_room",
    targetId: String(room.id),
    adminOpenId: input.adminOpenId,
    summary: `Annonce envoyée au salon ${room.code}.`,
  });
  return { roomId: room.id, code: room.code, message };
}

export async function getAdminAuditLog(limit = 30) {
  const db = await getDb();
  if (!db) return [];
  return db.select({ id: adminAuditLogs.id, action: adminAuditLogs.action, targetType: adminAuditLogs.targetType, targetId: adminAuditLogs.targetId, summary: adminAuditLogs.summary, createdAt: adminAuditLogs.createdAt })
    .from(adminAuditLogs).orderBy(desc(adminAuditLogs.createdAt)).limit(limit);
}
