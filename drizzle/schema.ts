import { index, int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  sessionVersion: int("session_version").notNull().default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/** Configuration brouillon/publiée de l’éditeur visuel, limitée à des blocs prédéfinis et contrôlée par le propriétaire. */
export const visualEditorPages = mysqlTable("visual_editor_pages", {
  id: int("id").autoincrement().primaryKey(),
  page: varchar("page", { length: 32 }).notNull().unique(),
  draftConfig: text("draft_config").notNull(),
  publishedConfig: text("published_config").notNull(),
  updatedByOpenId: varchar("updated_by_open_id", { length: 64 }).notNull(),
  version: int("version").notNull().default(1),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("visual_editor_pages_updated_idx").on(table.updatedAt)]);

/**
 * Index local des lemmes Morphalou 3.
 * Source : ATILF / ORTOLANG, licence LGPL-LR. Les définitions restent consultées sur le CNRTL via cnrtlUrl.
 */
export const lexicalEntries = mysqlTable("lexical_entries", {
  id: int("id").autoincrement().primaryKey(),
  lemma: varchar("lemma", { length: 255 }).notNull(),
  normalizedLemma: varchar("normalized_lemma", { length: 255 }).notNull(),
  category: varchar("category", { length: 100 }),
  subcategory: varchar("subcategory", { length: 100 }),
  isLocution: varchar("is_locution", { length: 16 }),
  gender: varchar("gender", { length: 32 }),
  linkedLemmas: text("linked_lemmas"),
  pronunciation: text("pronunciation"),
  origins: text("origins"),
  sourceName: varchar("source_name", { length: 100 }).notNull().default("Morphalou 3"),
  sourceLicense: varchar("source_license", { length: 50 }).notNull().default("LGPL-LR"),
  cnrtlUrl: varchar("cnrtl_url", { length: 512 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("lexical_entries_normalized_lemma_idx").on(table.normalizedLemma),
]);

/** Formes fléchies rattachées aux lemmes Morphalou pour une recherche par mot saisi. */
export const lexicalForms = mysqlTable("lexical_forms", {
  id: int("id").autoincrement().primaryKey(),
  entryId: int("entry_id").notNull(),
  form: varchar("form", { length: 255 }).notNull(),
  normalizedForm: varchar("normalized_form", { length: 255 }).notNull(),
  grammaticalNumber: varchar("grammatical_number", { length: 32 }),
  mode: varchar("mode", { length: 32 }),
  gender: varchar("gender", { length: 32 }),
  tense: varchar("tense", { length: 32 }),
  person: varchar("person", { length: 32 }),
  pronunciation: text("pronunciation"),
  origins: text("origins"),
}, (table) => [
  index("lexical_forms_entry_idx").on(table.entryId),
  index("lexical_forms_normalized_form_idx").on(table.normalizedForm),
]);

export type LexicalEntry = typeof lexicalEntries.$inferSelect;
export type InsertLexicalEntry = typeof lexicalEntries.$inferInsert;
export type LexicalForm = typeof lexicalForms.$inferSelect;

/** Définitions françaises attribuées à DBnary / Wiktionnaire, liées aux lemmes Morphalou. */
export const lexicalDefinitions = mysqlTable("lexical_definitions", {
  id: int("id").autoincrement().primaryKey(),
  lexicalEntryId: int("lexical_entry_id").notNull(),
  lemma: varchar("lemma", { length: 255 }).notNull(),
  normalizedLemma: varchar("normalized_lemma", { length: 255 }).notNull(),
  definition: text("definition").notNull(),
  sourceName: varchar("source_name", { length: 100 }).notNull().default("DBnary / Wiktionnaire"),
  sourceLicense: varchar("source_license", { length: 64 }).notNull().default("CC BY-SA 3.0"),
  sourceUrl: varchar("source_url", { length: 512 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("lexical_definitions_normalized_lemma_idx").on(table.normalizedLemma),
]);

export type LexicalDefinition = typeof lexicalDefinitions.$inferSelect;

/** Relations lexicales DBnary/Wiktionnaire, limitées aux lemmes Morphalou associés à CNRTL. */
export const lexicalRelations = mysqlTable("lexical_relations", {
  id: int("id").autoincrement().primaryKey(),
  sourceEntryId: int("source_entry_id").notNull(),
  targetEntryId: int("target_entry_id").notNull(),
  relation: mysqlEnum("relation", ["synonym", "antonym"]).notNull(),
  sourceName: varchar("source_name", { length: 100 }).notNull().default("DBnary / Wiktionnaire"),
  sourceLicense: varchar("source_license", { length: 64 }).notNull().default("CC BY-SA 3.0"),
  sourceUrl: varchar("source_url", { length: 512 }).notNull().default("https://kaiko.getalp.org/about-dbnary/"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("lexical_relations_unique_idx").on(table.sourceEntryId, table.targetEntryId, table.relation),
  index("lexical_relations_source_idx").on(table.sourceEntryId, table.relation),
  index("lexical_relations_target_idx").on(table.targetEntryId, table.relation),
]);

/** Racines et éléments de composition retenus pour l’Herbier, avec attribution éditoriale explicite. */
export const herbariumRoots = mysqlTable("herbarium_roots", {
  id: varchar("id", { length: 32 }).primaryKey(),
  displayName: varchar("display_name", { length: 80 }).notNull(),
  prefix: varchar("prefix", { length: 64 }).notNull(),
  origin: varchar("origin", { length: 180 }).notNull(),
  description: text("description").notNull(),
  category: varchar("category", { length: 64 }).notNull(),
  sourceName: varchar("source_name", { length: 100 }).notNull().default("CNRTL"),
  sourceUrl: varchar("source_url", { length: 512 }).notNull(),
  orderIndex: int("order_index").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("herbarium_roots_prefix_unique").on(table.prefix),
  index("herbarium_roots_order_idx").on(table.orderIndex),
]);

/** Découvertes lexicales d’un compte connecté ou, hors connexion, de son identité de jeu locale. */
export const herbariumDiscoveries = mysqlTable("herbarium_discoveries", {
  id: int("id").autoincrement().primaryKey(),
  ownerKey: varchar("owner_key", { length: 64 }).notNull(),
  lexicalEntryId: int("lexical_entry_id").notNull(),
  rootId: varchar("root_id", { length: 32 }).notNull(),
  sourceMode: varchar("source_mode", { length: 32 }).notNull(),
  discoveredAt: timestamp("discovered_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("herbarium_discoveries_owner_entry_unique").on(table.ownerKey, table.lexicalEntryId),
  index("herbarium_discoveries_owner_root_idx").on(table.ownerKey, table.rootId),
  index("herbarium_discoveries_entry_idx").on(table.lexicalEntryId),
]);

/** Thèmes libres créés par chaque joueur pour organiser ses découvertes dans le Grimoire. */
export const grimoireThemes = mysqlTable("grimoire_themes", {
  id: int("id").autoincrement().primaryKey(),
  ownerKey: varchar("owner_key", { length: 64 }).notNull(),
  title: varchar("title", { length: 80 }).notNull(),
  accent: varchar("accent", { length: 24 }).notNull().default("violet"),
  x: int("x").notNull().default(0),
  y: int("y").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("grimoire_themes_owner_idx").on(table.ownerKey, table.updatedAt),
]);

/** Placement personnel d’un mot réellement découvert, éventuellement relié à un thème du Grimoire. */
export const grimoirePlacements = mysqlTable("grimoire_placements", {
  id: int("id").autoincrement().primaryKey(),
  ownerKey: varchar("owner_key", { length: 64 }).notNull(),
  lexicalEntryId: int("lexical_entry_id").notNull(),
  themeId: int("theme_id"),
  x: int("x").notNull().default(0),
  y: int("y").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("grimoire_placements_owner_entry_unique").on(table.ownerKey, table.lexicalEntryId),
  index("grimoire_placements_owner_theme_idx").on(table.ownerKey, table.themeId),
  index("grimoire_placements_entry_idx").on(table.lexicalEntryId),
]);

/** Dernier cadrage de toile utilisé par un joueur pour reprendre son Grimoire sans décalage. */
export const grimoireCanvases = mysqlTable("grimoire_canvases", {
  ownerKey: varchar("owner_key", { length: 64 }).primaryKey(),
  offsetX: int("offset_x").notNull().default(0),
  offsetY: int("offset_y").notNull().default(0),
  zoom: int("zoom").notNull().default(100),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

/** Identité anonyme de navigateur, utilisée uniquement pour reprendre une session de jeu sans compte. */
export const gameIdentities = mysqlTable("game_identities", {
  id: varchar("id", { length: 64 }).primaryKey(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
});

/** Session solo dont les données publiques et la solution restent séparées côté serveur. */
export const soloGameSessions = mysqlTable("solo_game_sessions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  ownerKey: varchar("owner_key", { length: 64 }).notNull(),
  mode: mysqlEnum("mode", ["quiz", "motus", "definition", "relation"]).notNull(),
  status: mysqlEnum("status", ["active", "resolved", "abandoned", "expired"]).notNull().default("active"),
  publicData: text("public_data").notNull(),
  secretData: text("secret_data").notNull(),
  attempts: int("attempts").notNull().default(0),
  maxAttempts: int("max_attempts").notNull().default(1),
  score: int("score").notNull().default(0),
  expiresAt: timestamp("expires_at").notNull(),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("solo_game_sessions_owner_status_idx").on(table.ownerKey, table.status),
  index("solo_game_sessions_expiry_idx").on(table.expiresAt),
]);

/** Défi quotidien stable par date et par mode ; le mot solution est conservé dans secretData. */
export const dailyChallenges = mysqlTable("daily_challenges", {
  id: int("id").autoincrement().primaryKey(),
  dailyDate: varchar("daily_date", { length: 10 }).notNull(),
  mode: mysqlEnum("mode", ["mystery", "pyramid", "auction"]).notNull(),
  publicData: text("public_data").notNull(),
  secretData: text("secret_data").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [uniqueIndex("daily_challenges_date_mode_unique").on(table.dailyDate, table.mode)]);

/** Partie quotidienne officielle ou session d’entraînement reprise par une identité anonyme. */
export const dailyRuns = mysqlTable("daily_runs", {
  id: varchar("id", { length: 64 }).primaryKey(),
  challengeId: int("challenge_id").notNull(),
  ownerKey: varchar("owner_key", { length: 64 }).notNull(),
  dailyDate: varchar("daily_date", { length: 10 }).notNull(),
  mode: mysqlEnum("mode", ["mystery", "pyramid", "auction"]).notNull(),
  runNonce: varchar("run_nonce", { length: 64 }).notNull(),
  status: mysqlEnum("status", ["active", "won", "lost", "abandoned"]).notNull().default("active"),
  stateData: text("state_data").notNull(),
  attempts: int("attempts").notNull().default(0),
  score: int("score").notNull().default(0),
  version: int("version").notNull().default(1),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("daily_runs_owner_date_mode_nonce_unique").on(table.ownerKey, table.dailyDate, table.mode, table.runNonce),
  index("daily_runs_owner_date_idx").on(table.ownerKey, table.dailyDate),
  index("daily_runs_challenge_idx").on(table.challengeId),
]);

/** Salons privés persistants du multijoueur léger. */
export const multiplayerRooms = mysqlTable("multiplayer_rooms", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 8 }).notNull().unique(),
  title: varchar("title", { length: 60 }).notNull().default("Salon de mots"),
  visibility: mysqlEnum("visibility", ["private", "public"]).notNull().default("private"),
  gameMode: mysqlEnum("game_mode", ["quiz", "motus", "definition"]).notNull(),
  variant: varchar("variant", { length: 32 }).notNull(),
  status: mysqlEnum("status", ["lobby", "active", "finished"]).notNull().default("lobby"),
  hostPlayerId: int("host_player_id"),
  playerCount: int("player_count").notNull().default(0),
  currentRoundIndex: int("current_round_index").notNull().default(0),
  roundLimit: int("round_limit").notNull().default(5),
  roundDurationSeconds: int("round_duration_seconds").notNull().default(0),
  isHardcore: int("is_hardcore").notNull().default(0),
  showSubmissions: int("show_submissions").notNull().default(1),
  allowedJokers: text("allowed_jokers"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("multiplayer_rooms_status_idx").on(table.status),
  index("multiplayer_rooms_lobby_capacity_idx").on(table.status, table.playerCount),
]);

/** Joueurs d’un salon ; le jeton permet la reprise sans compte obligatoire. */
export const multiplayerPlayers = mysqlTable("multiplayer_players", {
  id: int("id").autoincrement().primaryKey(),
  roomId: int("room_id").notNull(),
  nickname: varchar("nickname", { length: 30 }).notNull(),
  resumeTokenHash: varchar("resume_token_hash", { length: 64 }).notNull().unique(),
  resumeTokenExpiresAt: timestamp("resume_token_expires_at").notNull(),
  isHost: int("is_host").notNull().default(0),
  isReady: int("is_ready").notNull().default(0),
  score: int("score").notNull().default(0),
  archetype: mysqlEnum("archetype", ["cryptographer", "berserker", "banker", "necromancer"]).notNull().default("cryptographer"),
  mana: int("mana").notNull().default(100),
  manaUpdatedAt: timestamp("mana_updated_at").defaultNow().notNull(),
  lastRewardMessage: text("last_reward_message"),
  lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("multiplayer_players_room_idx").on(table.roomId),
  uniqueIndex("multiplayer_players_room_nickname_unique").on(table.roomId, table.nickname),
]);

/** Manche commune ; les données publiques et la solution restent séparées côté serveur. */
export const multiplayerRounds = mysqlTable("multiplayer_rounds", {
  id: int("id").autoincrement().primaryKey(),
  roomId: int("room_id").notNull(),
  position: int("position").notNull(),
  status: mysqlEnum("status", ["active", "resolved"]).notNull().default("active"),
  prompt: text("prompt").notNull(),
  publicData: text("public_data").notNull(),
  answerKey: text("answer_key").notNull(),
  sourceCnrtlUrl: varchar("source_cnrtl_url", { length: 512 }),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  endsAt: timestamp("ends_at"),
  resolvedAt: timestamp("resolved_at"),
}, (table) => [
  index("multiplayer_rounds_room_position_idx").on(table.roomId, table.position),
  uniqueIndex("multiplayer_rounds_room_position_unique").on(table.roomId, table.position),
]);

/** Historique concis des actions visibles dans un salon : préparation, effets et transitions. */
export const multiplayerRoomEvents = mysqlTable("multiplayer_room_events", {
  id: int("id").autoincrement().primaryKey(),
  roomId: int("room_id").notNull(),
  roundId: int("round_id"),
  playerId: int("player_id"),
  eventType: varchar("event_type", { length: 32 }).notNull(),
  summary: varchar("summary", { length: 240 }).notNull(),
  effect: text("effect"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("multiplayer_room_events_room_created_idx").on(table.roomId, table.createdAt),
]);

/** Réponses Quiz et essais Motus enregistrés et corrigés côté serveur. */
export const multiplayerSubmissions = mysqlTable("multiplayer_submissions", {
  id: int("id").autoincrement().primaryKey(),
  roundId: int("round_id").notNull(),
  playerId: int("player_id").notNull(),
  submissionType: mysqlEnum("submission_type", ["quiz", "motus", "definition"]).notNull(),
  payload: text("payload").notNull(),
  feedback: text("feedback"),
  isCorrect: int("is_correct").notNull().default(0),
  points: int("points").notNull().default(0),
  attemptIndex: int("attempt_index").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("multiplayer_submissions_round_player_idx").on(table.roundId, table.playerId),
  uniqueIndex("multiplayer_submissions_round_player_attempt_unique").on(table.roundId, table.playerId, table.attemptIndex),
]);

/** Jokers consommés par un joueur pendant une manche commune. */
export const multiplayerJokerUses = mysqlTable("multiplayer_joker_uses", {
  id: int("id").autoincrement().primaryKey(),
  roundId: int("round_id").notNull(),
  playerId: int("player_id").notNull(),
  joker: mysqlEnum("joker", ["compass", "tempo", "second_chance", "fog", "shield", "bonus_attempt", "random_letter", "peek", "opponent_progress", "exact_letter", "mana_siphon", "blackout", "overclock", "curse_trap", "trade_letter"]).notNull(),
  effect: text("effect"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("multiplayer_joker_round_player_kind_idx").on(table.roundId, table.playerId, table.joker),
  index("multiplayer_joker_round_idx").on(table.roundId),
]);

/** Jokers gagnés en Motus et disponibles jusqu’à leur utilisation dans le même salon. */
export const multiplayerPlayerRewards = mysqlTable("multiplayer_player_rewards", {
  id: int("id").autoincrement().primaryKey(),
  roomId: int("room_id").notNull(),
  playerId: int("player_id").notNull(),
  joker: mysqlEnum("joker", ["compass", "tempo", "second_chance", "fog", "shield", "bonus_attempt", "random_letter", "peek", "opponent_progress", "exact_letter", "mana_siphon", "blackout", "overclock", "curse_trap", "trade_letter"]).notNull(),
  consumedRoundId: int("consumed_round_id"),
  grantedAt: timestamp("granted_at").defaultNow().notNull(),
}, (table) => [
  index("multiplayer_rewards_room_player_idx").on(table.roomId, table.playerId),
  index("multiplayer_rewards_available_idx").on(table.playerId, table.consumedRoundId),
]);

/** Offre de troc négociée pendant une manche Motus. Les lettres sont contrôlées avant création, puis révélées uniquement après acceptation. */
export const multiplayerTradeOffers = mysqlTable("multiplayer_trade_offers", {
  id: int("id").autoincrement().primaryKey(),
  roomId: int("room_id").notNull(),
  roundId: int("round_id").notNull(),
  fromPlayerId: int("from_player_id").notNull(),
  toPlayerId: int("to_player_id").notNull(),
  offeredLetter: varchar("offered_letter", { length: 1 }).notNull(),
  requestedLetter: varchar("requested_letter", { length: 1 }).notNull(),
  status: mysqlEnum("status", ["pending", "accepted", "declined", "expired", "cancelled"]).notNull().default("pending"),
  expiresAt: timestamp("expires_at").notNull(),
  respondedAt: timestamp("responded_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("multiplayer_trade_round_target_idx").on(table.roundId, table.toPlayerId, table.status),
  index("multiplayer_trade_round_source_idx").on(table.roundId, table.fromPlayerId, table.status),
]);

/** Contrats tactiques temporaires : lettre, indice cryptographique ou offre de mana négociée pendant une manche. */
export const multiplayerTacticalContracts = mysqlTable("multiplayer_tactical_contracts", {
  id: int("id").autoincrement().primaryKey(),
  roomId: int("room_id").notNull(),
  roundId: int("round_id").notNull(),
  fromPlayerId: int("from_player_id").notNull(),
  targetPlayerId: int("target_player_id"),
  contractType: mysqlEnum("contract_type", ["letter", "cryptohint", "mana"]).notNull(),
  offeredLetter: varchar("offered_letter", { length: 1 }),
  hint: text("hint"),
  minimumBid: int("minimum_bid").notNull().default(0),
  status: mysqlEnum("status", ["open", "awarded", "expired", "cancelled"]).notNull().default("open"),
  expiresAt: timestamp("expires_at").notNull(),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("multiplayer_contract_round_status_idx").on(table.roundId, table.status),
  index("multiplayer_contract_source_idx").on(table.fromPlayerId, table.createdAt),
]);

/** Enchères de mana auditées, une offre active par joueur et par contrat. */
export const multiplayerTacticalBids = mysqlTable("multiplayer_tactical_bids", {
  id: int("id").autoincrement().primaryKey(),
  contractId: int("contract_id").notNull(),
  playerId: int("player_id").notNull(),
  manaAmount: int("mana_amount").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("multiplayer_tactical_bid_unique_idx").on(table.contractId, table.playerId),
  index("multiplayer_tactical_bid_contract_amount_idx").on(table.contractId, table.manaAmount),
]);

/** Réglages opératoires gérés par le propriétaire : bannière, disponibilité et options de jeux. */
export const adminSystemConfigurations = mysqlTable("admin_system_configurations", {
  key: varchar("key", { length: 64 }).primaryKey(),
  value: text("value").notNull(),
  updatedByOpenId: varchar("updated_by_open_id", { length: 64 }).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

/** Journal immuable des actes d’administration applicatifs, sans adresse IP ni empreinte navigateur. */
export const adminAuditLogs = mysqlTable("admin_audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  action: varchar("action", { length: 64 }).notNull(),
  targetType: varchar("target_type", { length: 64 }).notNull(),
  targetId: varchar("target_id", { length: 128 }).notNull(),
  adminOpenId: varchar("admin_open_id", { length: 64 }).notNull(),
  summary: varchar("summary", { length: 240 }).notNull(),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("admin_audit_logs_created_idx").on(table.createdAt),
  index("admin_audit_logs_target_idx").on(table.targetType, table.targetId),
]);

/** Curation éditoriale appliquée au corpus Morphalou existant sans modifier la source référencée. */
export const lexiconCurations = mysqlTable("lexicon_curations", {
  id: int("id").autoincrement().primaryKey(),
  lexicalEntryId: int("lexical_entry_id").notNull().unique(),
  difficulty: mysqlEnum("difficulty", ["facile", "moyen", "difficile", "diabolique"]).notNull().default("moyen"),
  frequencyWeight: int("frequency_weight").notNull().default(100),
  tags: text("tags"),
  isActive: int("is_active").notNull().default(1),
  editorialNote: text("editorial_note"),
  updatedByOpenId: varchar("updated_by_open_id", { length: 64 }).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("lexicon_curations_active_idx").on(table.isActive, table.difficulty)]);
