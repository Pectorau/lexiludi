import { z } from "zod";

export const visualEditorPageSchema = z.enum(["home", "quiz", "motus", "definitions", "multiplayer"]);
export type VisualEditorPage = z.infer<typeof visualEditorPageSchema>;

export const visualEditorIconSchema = z.enum(["sparkles", "arrow-right", "book-open", "pencil", "circle-help"]);
export type VisualEditorIcon = z.infer<typeof visualEditorIconSchema>;

export const visualEditorFontSchema = z.enum(["inherit", "serif", "sans", "mono", "hand"]);
export type VisualEditorFont = z.infer<typeof visualEditorFontSchema>;

const visualHexColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "La couleur doit être au format hexadécimal.");
/** Compatibilité des brouillons historiques : une hauteur nulle devient 40 px avant validation. */
const visualHeightSchema = z.preprocess((value) => typeof value === "number" && Number.isFinite(value) ? Math.max(40, Math.round(value)) : value, z.number().int().min(40).max(900));
const responsiveLayoutSchema = z.object({ x: z.number().int().min(-320).max(320).optional(), y: z.number().int().min(-320).max(320).optional(), width: z.number().int().min(25).max(100).optional(), height: visualHeightSchema.optional(), hidden: z.boolean().optional() }).strict();

export const visualBlockConfigSchema = z.object({
  visible: z.boolean().optional(),
  locked: z.boolean().optional(),
  order: z.number().int().min(0).max(20).optional(),
  group: z.string().trim().min(1).max(32).optional(),
  text: z.string().trim().min(1).max(220).optional(),
  buttonLabel: z.string().trim().min(1).max(36).optional(),
  href: z.string().trim().regex(/^\/(?!\/)|^#/, "Le lien doit rester interne au site.").max(160).optional(),
  icon: visualEditorIconSchema.optional(),
  align: z.enum(["start", "center", "end"]).optional(),
  appearance: z.object({
    backgroundColor: visualHexColorSchema.optional(),
    textColor: visualHexColorSchema.optional(),
    borderColor: visualHexColorSchema.optional(),
    font: visualEditorFontSchema.optional(),
    fontSize: z.number().int().min(10).max(72).optional(),
    opacity: z.number().min(0.2).max(1).optional(),
    borderRadius: z.number().int().min(0).max(32).optional(),
  }).optional(),
  spacing: z.object({
    marginTop: z.number().int().min(0).max(96).optional(),
    marginRight: z.number().int().min(0).max(96).optional(),
    marginBottom: z.number().int().min(0).max(96).optional(),
    marginLeft: z.number().int().min(0).max(96).optional(),
    padding: z.number().int().min(0).max(80).optional(),
  }).optional(),
  layout: z.object({
    x: z.number().int().min(-320).max(320).optional(),
    y: z.number().int().min(-320).max(320).optional(),
    width: z.number().int().min(25).max(100).optional(),
    minHeight: visualHeightSchema.optional(),
    zIndex: z.number().int().min(0).max(50).optional(),
  }).optional(),
  responsive: z.object({ desktop: responsiveLayoutSchema.optional(), mobile: responsiveLayoutSchema.optional() }).optional(),
}).strict();

export type VisualBlockConfig = z.infer<typeof visualBlockConfigSchema>;

export const visualEditorConfigSchema = z.object({
  blocks: z.record(z.string(), visualBlockConfigSchema).default({}),
}).strict();

export type VisualEditorConfig = z.infer<typeof visualEditorConfigSchema>;

export const EDITABLE_BLOCKS: Record<VisualEditorPage, readonly string[]> = {
  home: ["home.copy", "home.daily", "home.chapters", "home.quiz", "home.motus", "home.definitions", "home.cta"],
  quiz: ["quiz.heading", "quiz.prompt", "quiz.answers", "quiz.trace"],
  motus: ["motus.heading", "motus.grid", "motus.keyboard", "motus.actions"],
  definitions: ["definitions.heading", "definitions.board", "definitions.actions"],
  multiplayer: ["multiplayer.rail", "multiplayer.lobby", "multiplayer.share", "multiplayer.ready", "multiplayer.activity", "multiplayer.jokers", "multiplayer.result"],
};

export const EMPTY_VISUAL_EDITOR_CONFIG: VisualEditorConfig = { blocks: {} };

const LEGACY_MOTUS_BLOCKS: Record<string, string> = {
  "motusGame.header": "motus.heading",
  "motusGame.title": "motus.heading",
  "motusGame.grid": "motus.grid",
  "motusGame.keyboard": "motus.keyboard",
  "motusGame.actions": "motus.actions",
};

/** Adapte les clés de l’ancien atelier Motus sans écrire ni supprimer la configuration d’origine. */
export function migrateLegacyVisualEditorConfig(page: VisualEditorPage, candidate: unknown): unknown {
  if (page !== "motus" || !candidate || typeof candidate !== "object") return candidate;
  const record = candidate as { blocks?: unknown };
  if (!record.blocks || typeof record.blocks !== "object") return candidate;
  const blocks = record.blocks as Record<string, unknown>;
  const migratedBlocks = Object.fromEntries(Object.entries(blocks).flatMap(([id, config]) => {
    const mappedId = LEGACY_MOTUS_BLOCKS[id] ?? id;
    return mappedId.startsWith("motus.") ? [[mappedId, config]] : [];
  }));
  return { ...record, blocks: migratedBlocks };
}

const NON_HIDEABLE_BLOCKS = new Set(["quiz.answers", "motus.grid", "motus.keyboard", "definitions.board", "multiplayer.lobby", "multiplayer.ready"]);

export function normalizeVisualEditorConfig(page: VisualEditorPage, candidate: unknown): VisualEditorConfig {
  const parsed = visualEditorConfigSchema.safeParse(migrateLegacyVisualEditorConfig(page, candidate));
  if (!parsed.success) return EMPTY_VISUAL_EDITOR_CONFIG;
  const allowed = new Set(EDITABLE_BLOCKS[page]);
  return {
    blocks: Object.fromEntries(
      Object.entries(parsed.data.blocks).filter(([blockId]) => allowed.has(blockId)).map(([blockId, config]) => [
        blockId,
        NON_HIDEABLE_BLOCKS.has(blockId) && config.visible === false ? { ...config, visible: undefined } : config,
      ]),
    ),
  };
}

export function visualBlockStyle(config?: VisualBlockConfig): Record<string, string | number> | undefined {
  if (!config) return undefined;
  const spacing = config.spacing;
  const layout = config.layout;
  const appearance = config.appearance;
  if (!spacing && !config.align && !layout && !appearance && config.order === undefined) return undefined;
  return {
    ...(config.order !== undefined ? { order: config.order } : {}),
    ...(spacing?.marginTop !== undefined ? { marginTop: spacing.marginTop } : {}),
    ...(spacing?.marginRight !== undefined ? { marginRight: spacing.marginRight } : {}),
    ...(spacing?.marginBottom !== undefined ? { marginBottom: spacing.marginBottom } : {}),
    ...(spacing?.marginLeft !== undefined ? { marginLeft: spacing.marginLeft } : {}),
    ...(spacing?.padding !== undefined ? { padding: spacing.padding } : {}),
    ...(config.align ? { textAlign: config.align } : {}),
    ...(layout?.x || layout?.y ? { transform: `translate(${layout?.x ?? 0}px, ${layout?.y ?? 0}px)` } : {}),
    ...(layout?.width !== undefined ? { width: `${layout.width}%` } : {}),
    ...(layout?.minHeight !== undefined ? { minHeight: layout.minHeight } : {}),
    ...(layout?.zIndex !== undefined ? { zIndex: layout.zIndex } : {}),
    ...(appearance?.backgroundColor ? { backgroundColor: appearance.backgroundColor } : {}),
    ...(appearance?.textColor ? { color: appearance.textColor } : {}),
    ...(appearance?.borderColor ? { borderColor: appearance.borderColor } : {}),
    ...(appearance?.fontSize !== undefined ? { fontSize: appearance.fontSize } : {}),
    ...(appearance?.opacity !== undefined ? { opacity: appearance.opacity } : {}),
    ...(appearance?.borderRadius !== undefined ? { borderRadius: appearance.borderRadius } : {}),
    ...(appearance?.font && appearance.font !== "inherit" ? { fontFamily: appearance.font === "serif" ? '"DM Serif Display", Georgia, serif' : appearance.font === "mono" ? '"IBM Plex Mono", monospace' : appearance.font === "hand" ? 'Caveat, cursive' : '"Space Grotesk", sans-serif' } : {}),
  };
}
