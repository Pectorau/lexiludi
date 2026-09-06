import { desc, eq } from "drizzle-orm";
import { visualEditorPages } from "../drizzle/schema";
import {
  EMPTY_VISUAL_EDITOR_CONFIG,
  normalizeVisualEditorConfig,
  type VisualEditorConfig,
  type VisualEditorPage,
} from "../shared/visualEditor";
import { getDb } from "./db";

export function canEditVisualEditor(user: { openId: string; role: string } | null | undefined, ownerOpenId: string) {
  return Boolean(user && (user.role === "admin" || (ownerOpenId && user.openId === ownerOpenId)));
}

function deserialize(page: VisualEditorPage, raw: string | null | undefined): VisualEditorConfig {
  if (!raw) return EMPTY_VISUAL_EDITOR_CONFIG;
  try {
    return normalizeVisualEditorConfig(page, JSON.parse(raw));
  } catch {
    return EMPTY_VISUAL_EDITOR_CONFIG;
  }
}

async function getStoredPage(page: VisualEditorPage) {
  const db = await getDb();
  if (!db) return undefined;
  const [stored] = await db.select().from(visualEditorPages).where(eq(visualEditorPages.page, page)).orderBy(desc(visualEditorPages.updatedAt)).limit(1);
  if (stored || page !== "motus") return stored;
  const [legacyMotus] = await db.select().from(visualEditorPages).where(eq(visualEditorPages.page, "motusGame")).orderBy(desc(visualEditorPages.updatedAt)).limit(1);
  return legacyMotus;
}

export async function getPublishedVisualEditorPage(page: VisualEditorPage) {
  const stored = await getStoredPage(page);
  return { page, config: deserialize(page, stored?.publishedConfig), publishedAt: stored?.publishedAt ?? null };
}

export async function getDraftVisualEditorPage(page: VisualEditorPage) {
  const stored = await getStoredPage(page);
  return {
    page,
    config: deserialize(page, stored?.draftConfig),
    publishedConfig: deserialize(page, stored?.publishedConfig),
    updatedAt: stored?.updatedAt ?? null,
    publishedAt: stored?.publishedAt ?? null,
  };
}

export async function saveVisualEditorDraft(page: VisualEditorPage, config: VisualEditorConfig, ownerOpenId: string) {
  const db = await getDb();
  if (!db) throw new Error("La persistance de l’éditeur est indisponible.");
  const normalized = normalizeVisualEditorConfig(page, config);
  const draftConfig = JSON.stringify(normalized);
  await db.insert(visualEditorPages).values({
    page,
    draftConfig,
    publishedConfig: JSON.stringify(EMPTY_VISUAL_EDITOR_CONFIG),
    updatedByOpenId: ownerOpenId,
  }).onDuplicateKeyUpdate({ set: { draftConfig, updatedByOpenId: ownerOpenId, version: 1 } });
  return getDraftVisualEditorPage(page);
}

export async function publishVisualEditorDraft(page: VisualEditorPage, ownerOpenId: string) {
  const db = await getDb();
  if (!db) throw new Error("La persistance de l’éditeur est indisponible.");
  const stored = await getStoredPage(page);
  if (!stored) return getPublishedVisualEditorPage(page);
  await db.update(visualEditorPages).set({ publishedConfig: stored.draftConfig, publishedAt: new Date(), updatedByOpenId: ownerOpenId, version: stored.version + 1 }).where(eq(visualEditorPages.id, stored.id));
  return getDraftVisualEditorPage(page);
}

export async function restoreVisualEditorDraft(page: VisualEditorPage, ownerOpenId: string) {
  const db = await getDb();
  if (!db) throw new Error("La persistance de l’éditeur est indisponible.");
  const stored = await getStoredPage(page);
  if (!stored) return getDraftVisualEditorPage(page);
  await db.update(visualEditorPages).set({ draftConfig: stored.publishedConfig, updatedByOpenId: ownerOpenId, version: stored.version + 1 }).where(eq(visualEditorPages.id, stored.id));
  return getDraftVisualEditorPage(page);
}
