import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";
import { ENV } from "./_core/env";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { FREE_MULTIPLAYER_ROUND_DURATION_SECONDS } from "@shared/multiplayerSettings";
import { getDailyPyramidChallenge, getLexiconStats, getMotusPoolStats, isMotusAttemptInLexicon, revokeUserSessions, searchLexicon, validateDailyPyramidStep } from "./db";
import { attemptDailyAuction, attemptDailyMystery, attemptDailyPyramid, getDailyRun, revealDailyAuctionClue, revealDailyAuctionLetter, revealDailyMystery, startDailyRun } from "./dailySessions";
import { getOrCreateGameIdentity } from "./gameIdentity";
import { addMultiplayerReaction, closeMultiplayerRoom, createMultiplayerRoom, finishMultiplayerRoom, getMultiplayerRoomPreview, getMultiplayerRoomState, joinMultiplayerRoom, kickMultiplayerPlayer, leaveMultiplayerRoom, listPublicMultiplayerRooms, rematchMultiplayerRoom, renameMultiplayerPlayer, resolveAndStartNextRound, setMultiplayerReady, startMultiplayerRound, submitMultiplayerDefinitionMatch, submitMultiplayerMotusAttempt, submitMultiplayerQuizAnswer, transferMultiplayerHost, updateMultiplayerRoom } from "./multiplayerDb";
import { getSoloSession, startSoloDefinitionMatch, startSoloMotus, startSoloQuiz, startSoloRelation, submitSoloDefinitionMatch, submitSoloMotus, submitSoloQuiz, submitSoloRelation } from "./soloSessions";
import { canEditVisualEditor, getDraftVisualEditorPage, getPublishedVisualEditorPage, publishVisualEditorDraft, restoreVisualEditorDraft, saveVisualEditorDraft } from "./visualEditor";
import { visualEditorConfigSchema, visualEditorPageSchema } from "../shared/visualEditor";
import { codeEditorFileService, MAX_EDITOR_FILE_BYTES, requireCodeEditorAccess } from "./codeEditor";
import { closeRoomAsAdmin, getAdminAnalytics, getAdminAuditLog, getAdminOverview, getAdminRoomRadar, getPublicGlobalBanner, kickRoomPlayerAsAdmin, postRoomAnnouncementAsAdmin, saveLexiconCuration, searchAdminLexicon, setGlobalBanner } from "./admin";
import { createGrimoireTheme, deleteGrimoireTheme, getGrimoire, getHerbariumTree, GRIMOIRE_ACCENTS, removeGrimoirePlacement, saveGrimoireCanvas, saveGrimoirePlacement, updateGrimoireTheme } from "./herbarium";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(async ({ ctx }) => {
      if (ctx.user) {
        try {
          await revokeUserSessions(ctx.user.openId);
        } catch (error) {
          console.error("[Auth] Session revocation failed during logout", error);
        }
      }
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  visualEditor: router({
    access: publicProcedure.query(({ ctx }) => ({ canEdit: canEditVisualEditor(ctx.user, ENV.ownerOpenId) })),
    page: publicProcedure.input(z.object({ page: visualEditorPageSchema })).query(({ input }) => getPublishedVisualEditorPage(input.page)),
    draft: publicProcedure.input(z.object({ page: visualEditorPageSchema })).query(({ ctx, input }) => {
      if (!canEditVisualEditor(ctx.user, ENV.ownerOpenId)) throw new TRPCError({ code: "FORBIDDEN", message: "Atelier réservé au propriétaire." });
      return getDraftVisualEditorPage(input.page);
    }),
    saveDraft: publicProcedure.input(z.object({ page: visualEditorPageSchema, config: visualEditorConfigSchema })).mutation(({ ctx, input }) => {
      if (!canEditVisualEditor(ctx.user, ENV.ownerOpenId)) throw new TRPCError({ code: "FORBIDDEN", message: "Atelier réservé au propriétaire." });
      return saveVisualEditorDraft(input.page, input.config, ctx.user!.openId);
    }),
    publish: publicProcedure.input(z.object({ page: visualEditorPageSchema })).mutation(({ ctx, input }) => {
      if (!canEditVisualEditor(ctx.user, ENV.ownerOpenId)) throw new TRPCError({ code: "FORBIDDEN", message: "Atelier réservé au propriétaire." });
      return publishVisualEditorDraft(input.page, ctx.user!.openId);
    }),
    restore: publicProcedure.input(z.object({ page: visualEditorPageSchema })).mutation(({ ctx, input }) => {
      if (!canEditVisualEditor(ctx.user, ENV.ownerOpenId)) throw new TRPCError({ code: "FORBIDDEN", message: "Atelier réservé au propriétaire." });
      return restoreVisualEditorDraft(input.page, ctx.user!.openId);
    }),
  }),
  codeEditor: router({
    access: publicProcedure.query(({ ctx }) => ({ canEdit: Boolean(ctx.user && (ctx.user.openId === ENV.ownerOpenId || ctx.user.role === "admin")) })),
    tree: publicProcedure.query(({ ctx }) => {
      requireCodeEditorAccess(ctx.user, ENV.ownerOpenId);
      return codeEditorFileService.listFiles();
    }),
    file: publicProcedure.input(z.object({ path: z.string().min(1).max(300) })).query(async ({ ctx, input }) => {
      requireCodeEditorAccess(ctx.user, ENV.ownerOpenId);
      return codeEditorFileService.readFile(input.path);
    }),
    save: publicProcedure.input(z.object({ path: z.string().min(1).max(300), content: z.string().max(MAX_EDITOR_FILE_BYTES) })).mutation(async ({ ctx, input }) => {
      requireCodeEditorAccess(ctx.user, ENV.ownerOpenId);
      return codeEditorFileService.saveFile(input.path, input.content);
    }),
  }),
  admin: router({
    access: publicProcedure.query(({ ctx }) => ({ canManage: Boolean(ctx.user?.role === "admin") })),
    publicBanner: publicProcedure.query(() => getPublicGlobalBanner()),
    overview: adminProcedure.query(() => getAdminOverview()),
    analytics: adminProcedure.query(() => getAdminAnalytics()),
    lexicon: adminProcedure
      .input(z.object({ query: z.string().trim().max(80).default(""), limit: z.number().int().min(1).max(60).default(24) }))
      .query(({ input }) => searchAdminLexicon(input.query, input.limit)),
    saveCuration: adminProcedure
      .input(z.object({ lexicalEntryId: z.number().int().positive(), difficulty: z.enum(["facile", "moyen", "difficile", "diabolique"]), frequencyWeight: z.number().int().min(1).max(500), tags: z.array(z.string().max(40)).max(20), isActive: z.boolean(), editorialNote: z.string().max(1_000).optional() }))
      .mutation(({ ctx, input }) => saveLexiconCuration({ ...input, adminOpenId: ctx.user.openId })),
    rooms: adminProcedure.query(() => getAdminRoomRadar()),
    closeRoom: adminProcedure.input(z.object({ roomId: z.number().int().positive() })).mutation(({ ctx, input }) => closeRoomAsAdmin({ ...input, adminOpenId: ctx.user.openId })),
    kickRoomPlayer: adminProcedure.input(z.object({ roomId: z.number().int().positive(), playerId: z.number().int().positive() })).mutation(({ ctx, input }) => kickRoomPlayerAsAdmin({ ...input, adminOpenId: ctx.user.openId })),
    announceRoom: adminProcedure.input(z.object({ roomId: z.number().int().positive(), message: z.string().trim().min(1).max(220) })).mutation(({ ctx, input }) => postRoomAnnouncementAsAdmin({ ...input, adminOpenId: ctx.user.openId })),
    audit: adminProcedure.input(z.object({ limit: z.number().int().min(1).max(100).default(30) })).query(({ input }) => getAdminAuditLog(input.limit)),
    globalBanner: adminProcedure
      .input(z.object({ active: z.boolean(), message: z.string().max(240), level: z.enum(["info", "attention"]) }))
      .mutation(({ ctx, input }) => setGlobalBanner({ ...input, adminOpenId: ctx.user.openId })),
  }),
  lexicon: router({
    search: publicProcedure
      .input(z.object({ query: z.string().trim().min(2).max(80), limit: z.number().int().min(1).max(12).default(6) }))
      .query(({ input }) => searchLexicon(input.query, input.limit)),
    stats: publicProcedure.query(() => getLexiconStats()),
  }),
  herbarium: router({
    tree: publicProcedure.query(async ({ ctx }) => getHerbariumTree(ctx.user?.openId ?? (await getOrCreateGameIdentity(ctx)))),
    grimoire: publicProcedure.query(async ({ ctx }) => getGrimoire(ctx.user?.openId ?? (await getOrCreateGameIdentity(ctx)))),
    createTheme: publicProcedure
      .input(z.object({ title: z.string().trim().min(1).max(80), accent: z.enum(GRIMOIRE_ACCENTS), x: z.number().int().min(-50_000).max(50_000), y: z.number().int().min(-50_000).max(50_000) }))
      .mutation(async ({ ctx, input }) => createGrimoireTheme({ ...input, ownerKey: ctx.user?.openId ?? (await getOrCreateGameIdentity(ctx)) })),
    updateTheme: publicProcedure
      .input(z.object({ themeId: z.number().int().positive(), title: z.string().trim().min(1).max(80).optional(), accent: z.enum(GRIMOIRE_ACCENTS).optional(), x: z.number().int().min(-50_000).max(50_000).optional(), y: z.number().int().min(-50_000).max(50_000).optional() }).refine((input) => input.title !== undefined || input.accent !== undefined || input.x !== undefined || input.y !== undefined, { message: "Aucune modification de thème n’a été reçue." }))
      .mutation(async ({ ctx, input }) => updateGrimoireTheme({ ...input, ownerKey: ctx.user?.openId ?? (await getOrCreateGameIdentity(ctx)) })),
    deleteTheme: publicProcedure
      .input(z.object({ themeId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => deleteGrimoireTheme({ ...input, ownerKey: ctx.user?.openId ?? (await getOrCreateGameIdentity(ctx)) })),
    savePlacement: publicProcedure
      .input(z.object({ lexicalEntryId: z.number().int().positive(), themeId: z.number().int().positive().nullable(), x: z.number().int().min(-50_000).max(50_000), y: z.number().int().min(-50_000).max(50_000) }))
      .mutation(async ({ ctx, input }) => saveGrimoirePlacement({ ...input, ownerKey: ctx.user?.openId ?? (await getOrCreateGameIdentity(ctx)) })),
    removePlacement: publicProcedure
      .input(z.object({ lexicalEntryId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => removeGrimoirePlacement({ ...input, ownerKey: ctx.user?.openId ?? (await getOrCreateGameIdentity(ctx)) })),
    saveCanvas: publicProcedure
      .input(z.object({ offsetX: z.number().int().min(-50_000).max(50_000), offsetY: z.number().int().min(-50_000).max(50_000), zoom: z.number().int().min(50).max(180) }))
      .mutation(async ({ ctx, input }) => saveGrimoireCanvas({ ...input, ownerKey: ctx.user?.openId ?? (await getOrCreateGameIdentity(ctx)) })),
  }),
  solo: router({
    startQuiz: publicProcedure.input(z.object({ mode: z.enum(["category", "truefalse", "gender"]) })).mutation(async ({ ctx, input }) => startSoloQuiz(await getOrCreateGameIdentity(ctx), input.mode)),
    submitQuiz: publicProcedure.input(z.object({ sessionId: z.string().min(24).max(64), choice: z.string().trim().min(1).max(100) })).mutation(async ({ ctx, input }) => submitSoloQuiz(await getOrCreateGameIdentity(ctx), input.sessionId, input.choice)),
    getQuiz: publicProcedure.input(z.object({ sessionId: z.string().min(24).max(64) })).query(async ({ ctx, input }) => getSoloSession(await getOrCreateGameIdentity(ctx), input.sessionId, "quiz")),
    startMotus: publicProcedure.input(z.object({ minLength: z.number().int().min(4).max(10), maxLength: z.number().int().min(5).max(12), maxAttempts: z.number().int().min(4).max(10) })).mutation(async ({ ctx, input }) => startSoloMotus(await getOrCreateGameIdentity(ctx), input)),
    submitMotus: publicProcedure.input(z.object({ sessionId: z.string().min(24).max(64), word: z.string().trim().min(1).max(24) })).mutation(async ({ ctx, input }) => submitSoloMotus(await getOrCreateGameIdentity(ctx), input.sessionId, input.word)),
    getMotus: publicProcedure.input(z.object({ sessionId: z.string().min(24).max(64) })).query(async ({ ctx, input }) => getSoloSession(await getOrCreateGameIdentity(ctx), input.sessionId, "motus")),
    startDefinitionMatch: publicProcedure.mutation(async ({ ctx }) => startSoloDefinitionMatch(await getOrCreateGameIdentity(ctx))),
    submitDefinitionMatch: publicProcedure.input(z.object({ sessionId: z.string().min(24).max(64), entryId: z.number().int().positive(), definitionId: z.number().int().positive() })).mutation(async ({ ctx, input }) => submitSoloDefinitionMatch(await getOrCreateGameIdentity(ctx), input.sessionId, input)),
    getDefinitionMatch: publicProcedure.input(z.object({ sessionId: z.string().min(24).max(64) })).query(async ({ ctx, input }) => getSoloSession(await getOrCreateGameIdentity(ctx), input.sessionId, "definition")),
    startRelation: publicProcedure.input(z.object({ variant: z.enum(["synonym", "antonym", "intruder"]) })).mutation(async ({ ctx, input }) => startSoloRelation(await getOrCreateGameIdentity(ctx), input.variant)),
    submitRelation: publicProcedure.input(z.object({ sessionId: z.string().min(24).max(64), entryId: z.number().int().positive(), useSecondChance: z.boolean() })).mutation(async ({ ctx, input }) => submitSoloRelation(await getOrCreateGameIdentity(ctx), input.sessionId, input)),
    getRelation: publicProcedure.input(z.object({ sessionId: z.string().min(24).max(64) })).query(async ({ ctx, input }) => getSoloSession(await getOrCreateGameIdentity(ctx), input.sessionId, "relation")),
  }),
  daily: router({
    start: publicProcedure.input(z.object({ mode: z.enum(["mystery", "pyramid", "auction"]), scope: z.enum(["official", "practice"]).default("official") })).mutation(async ({ ctx, input }) => startDailyRun(await getOrCreateGameIdentity(ctx), input.mode, input.scope)),
    state: publicProcedure.input(z.object({ runId: z.string().min(24).max(64) })).query(async ({ ctx, input }) => getDailyRun(await getOrCreateGameIdentity(ctx), input.runId)),
    revealMystery: publicProcedure.input(z.object({ runId: z.string().min(24).max(64), action: z.enum(["word", "grammar"]), index: z.number().int().min(0).max(120).optional() })).mutation(async ({ ctx, input }) => revealDailyMystery(await getOrCreateGameIdentity(ctx), input.runId, input.action, input.index)),
    attemptMystery: publicProcedure.input(z.object({ runId: z.string().min(24).max(64), word: z.string().trim().min(1).max(32) })).mutation(async ({ ctx, input }) => attemptDailyMystery(await getOrCreateGameIdentity(ctx), input.runId, input.word)),
    attemptPyramid: publicProcedure.input(z.object({ runId: z.string().min(24).max(64), word: z.string().trim().min(1).max(8) })).mutation(async ({ ctx, input }) => attemptDailyPyramid(await getOrCreateGameIdentity(ctx), input.runId, input.word)),
    revealAuctionLetter: publicProcedure.input(z.object({ runId: z.string().min(24).max(64), index: z.number().int().min(0).max(11) })).mutation(async ({ ctx, input }) => revealDailyAuctionLetter(await getOrCreateGameIdentity(ctx), input.runId, input.index)),
    revealAuctionClue: publicProcedure.input(z.object({ runId: z.string().min(24).max(64), clue: z.enum(["vowel_count", "pattern"]) })).mutation(async ({ ctx, input }) => revealDailyAuctionClue(await getOrCreateGameIdentity(ctx), input.runId, input.clue)),
    attemptAuction: publicProcedure.input(z.object({ runId: z.string().min(24).max(64), word: z.string().trim().min(1).max(32) })).mutation(async ({ ctx, input }) => attemptDailyAuction(await getOrCreateGameIdentity(ctx), input.runId, input.word)),
  }),
  games: router({
    motusPool: publicProcedure
      .input(z.object({ minLength: z.number().int().min(4).max(10).default(4), maxLength: z.number().int().min(5).max(12).default(12) }))
      .query(({ input }) => getMotusPoolStats(input.minLength, input.maxLength)),
    motusAttempt: publicProcedure
      .input(z.object({ word: z.string().trim().min(1).max(24), expectedLength: z.number().int().min(4).max(12) }))
      .query(({ input }) => isMotusAttemptInLexicon(input.word, input.expectedLength).then((valid) => ({ valid }))),
  }),
  multiplayer: router({
    create: publicProcedure
      .input(z.object({
        gameMode: z.enum(["quiz", "motus", "definition"]),
        variant: z.string().trim().min(3).max(32),
        nickname: z.string().trim().min(1).max(30),
        title: z.string().trim().max(60).default(""),
        visibility: z.enum(["private", "public"]).default("private"),
        roundLimit: z.number().int().refine((value) => [3, 5, 8, 10, 12].includes(value)).default(5),
        roundDurationSeconds: z.number().int().refine((value) => [0, 30, 45, 60, 75, 120, 180, 300].includes(value)).default(FREE_MULTIPLAYER_ROUND_DURATION_SECONDS),
        showSubmissions: z.boolean().default(true),
        isHardcore: z.boolean().default(false),
        allowedJokers: z.array(z.enum(["compass", "tempo", "second_chance", "fog", "shield", "bonus_attempt", "random_letter", "peek", "opponent_progress", "exact_letter", "mana_siphon", "blackout", "overclock", "curse_trap"])).min(0).max(14).optional(),
      }))
      .mutation(({ input }) => createMultiplayerRoom(input)),
    publicRooms: publicProcedure
      .input(z.object({ gameMode: z.enum(["quiz", "motus", "definition"]) }))
      .query(({ input }) => listPublicMultiplayerRooms(input.gameMode)),
    preview: publicProcedure
      .input(z.object({ code: z.string().trim().toUpperCase().length(6) }))
      .query(({ input }) => getMultiplayerRoomPreview(input.code)),
    join: publicProcedure
      .input(z.object({ code: z.string().trim().toUpperCase().length(6), nickname: z.string().trim().min(1).max(30) }))
      .mutation(({ input }) => joinMultiplayerRoom(input)),
    state: publicProcedure
      .input(z.object({ code: z.string().trim().toUpperCase().length(6), resumeToken: z.string().min(20).max(80) }))
      .query(({ input }) => getMultiplayerRoomState(input)),
    startRound: publicProcedure
      .input(z.object({ code: z.string().trim().toUpperCase().length(6), resumeToken: z.string().min(20).max(80) }))
      .mutation(({ input }) => startMultiplayerRound(input)),
    nextRound: publicProcedure
      .input(z.object({ code: z.string().trim().toUpperCase().length(6), resumeToken: z.string().min(20).max(80), expectedRoundId: z.number().int().positive() }))
      .mutation(({ input }) => resolveAndStartNextRound(input)),
    finish: publicProcedure
      .input(z.object({ code: z.string().trim().toUpperCase().length(6), resumeToken: z.string().min(20).max(80) }))
      .mutation(({ input }) => finishMultiplayerRoom(input)),
    close: publicProcedure
      .input(z.object({ code: z.string().trim().toUpperCase().length(6), resumeToken: z.string().min(20).max(80) }))
      .mutation(({ input }) => closeMultiplayerRoom(input)),
    transferHost: publicProcedure
      .input(z.object({ code: z.string().trim().toUpperCase().length(6), resumeToken: z.string().min(20).max(80), playerId: z.number().int().positive() }))
      .mutation(({ input }) => transferMultiplayerHost(input)),
    leave: publicProcedure
      .input(z.object({ code: z.string().trim().toUpperCase().length(6), resumeToken: z.string().min(20).max(80) }))
      .mutation(({ input }) => leaveMultiplayerRoom(input)),
    rematch: publicProcedure
      .input(z.object({ code: z.string().trim().toUpperCase().length(6), resumeToken: z.string().min(20).max(80) }))
      .mutation(({ input }) => rematchMultiplayerRoom(input)),
    updateRoom: publicProcedure
      .input(z.object({ code: z.string().trim().toUpperCase().length(6), resumeToken: z.string().min(20).max(80), title: z.string().trim().max(60), visibility: z.enum(["private", "public"]), roundLimit: z.number().int().refine((value) => [3, 5, 8, 10, 12].includes(value)), roundDurationSeconds: z.number().int().refine((value) => [0, 30, 45, 60, 75, 120, 180, 300].includes(value)), showSubmissions: z.boolean(), isHardcore: z.boolean(), allowedJokers: z.array(z.enum(["compass", "tempo", "second_chance", "fog", "shield", "bonus_attempt", "random_letter", "peek", "opponent_progress", "exact_letter", "mana_siphon", "blackout", "overclock", "curse_trap"])).min(0).max(14).optional() }))
      .mutation(({ input }) => updateMultiplayerRoom(input)),
    renamePlayer: publicProcedure
      .input(z.object({ code: z.string().trim().toUpperCase().length(6), resumeToken: z.string().min(20).max(80), nickname: z.string().trim().min(1).max(30) }))
      .mutation(({ input }) => renameMultiplayerPlayer(input)),
    kickPlayer: publicProcedure
      .input(z.object({ code: z.string().trim().toUpperCase().length(6), resumeToken: z.string().min(20).max(80), playerId: z.number().int().positive() }))
      .mutation(({ input }) => kickMultiplayerPlayer(input)),
    setReady: publicProcedure
      .input(z.object({ code: z.string().trim().toUpperCase().length(6), resumeToken: z.string().min(20).max(80), isReady: z.boolean() }))
      .mutation(({ input }) => setMultiplayerReady(input)),
    react: publicProcedure
      .input(z.object({ code: z.string().trim().toUpperCase().length(6), resumeToken: z.string().min(20).max(80), reaction: z.enum(["Bien vu", "À toi", "Belle piste"]) }))
      .mutation(({ input }) => addMultiplayerReaction(input)),
    answerQuiz: publicProcedure
      .input(z.object({ code: z.string().trim().toUpperCase().length(6), resumeToken: z.string().min(20).max(80), choice: z.string().trim().min(1).max(100) }))
      .mutation(({ input }) => submitMultiplayerQuizAnswer(input)),
    attemptMotus: publicProcedure
      .input(z.object({ code: z.string().trim().toUpperCase().length(6), resumeToken: z.string().min(20).max(80), word: z.string().trim().min(1).max(24) }))
      .mutation(({ input }) => submitMultiplayerMotusAttempt(input)),
    answerDefinition: publicProcedure
      .input(z.object({ code: z.string().trim().toUpperCase().length(6), resumeToken: z.string().min(20).max(80), entryId: z.number().int().positive(), definitionId: z.number().int().positive() }))
      .mutation(({ input }) => submitMultiplayerDefinitionMatch(input)),
  }),

});

export type AppRouter = typeof appRouter;
