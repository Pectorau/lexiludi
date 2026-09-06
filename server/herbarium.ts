import { and, asc, count, desc, eq, like } from "drizzle-orm";
import { grimoireCanvases, grimoirePlacements, grimoireThemes, herbariumDiscoveries, herbariumRoots, lexicalDefinitions, lexicalEntries } from "../drizzle/schema";
import { getDb } from "./db";

export type HerbariumSourceMode = "quiz" | "motus" | "relation" | "intrus" | "daily";

export function normalizeHerbariumLemma(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr-FR")
    .replace(/[^a-z]/g, "");
}

export function rootMatchesLemma(prefix: string, lemma: string) {
  return normalizeHerbariumLemma(lemma).startsWith(normalizeHerbariumLemma(prefix));
}

function asNumber(value: number | string | bigint | null | undefined) {
  return Number(value ?? 0);
}

export async function getHerbariumTree(ownerKey: string) {
  const db = await getDb();
  if (!db) throw new Error("L’Herbier est momentanément indisponible.");

  const roots = await db.select().from(herbariumRoots).orderBy(asc(herbariumRoots.orderIndex));
  const discoveries = await db.select({ lexicalEntryId: herbariumDiscoveries.lexicalEntryId })
    .from(herbariumDiscoveries)
    .where(eq(herbariumDiscoveries.ownerKey, ownerKey));
  const discoveredIds = new Set(discoveries.map((item) => item.lexicalEntryId));

  const tree = await Promise.all(roots.map(async (root) => {
    const prefix = `${normalizeHerbariumLemma(root.prefix)}%`;
    const [totalRow] = await db.select({ total: count() }).from(lexicalEntries).where(like(lexicalEntries.normalizedLemma, prefix));
    const entries = await db.select({ id: lexicalEntries.id, lemma: lexicalEntries.lemma, cnrtlUrl: lexicalEntries.cnrtlUrl })
      .from(lexicalEntries)
      .where(like(lexicalEntries.normalizedLemma, prefix))
      .orderBy(asc(lexicalEntries.lemma))
      .limit(12);

    const words = await Promise.all(entries.map(async (entry) => {
      const isDiscovered = discoveredIds.has(entry.id);
      const [definition] = isDiscovered
        ? await db.select({ text: lexicalDefinitions.definition, sourceName: lexicalDefinitions.sourceName, sourceUrl: lexicalDefinitions.sourceUrl })
          .from(lexicalDefinitions)
          .where(eq(lexicalDefinitions.lexicalEntryId, entry.id))
          .limit(1)
        : [];
      return {
        id: entry.id,
        lemma: isDiscovered || discoveries.length > 0 ? entry.lemma : "Mot endormi",
        actualLemma: entry.lemma,
        cnrtlUrl: entry.cnrtlUrl,
        isDiscovered,
        isVisible: isDiscovered || discoveries.length > 0,
        definition: definition?.text ?? null,
        definitionSourceName: definition?.sourceName ?? null,
        definitionSourceUrl: definition?.sourceUrl ?? null,
      };
    }));

    const unlockedCount = words.filter((word) => word.isDiscovered).length;
    return {
      id: root.id,
      displayName: root.displayName,
      prefix: root.prefix,
      origin: root.origin,
      description: root.description,
      category: root.category,
      sourceName: root.sourceName,
      sourceUrl: root.sourceUrl,
      unlockedCount,
      totalCount: asNumber(totalRow?.total),
      words,
    };
  }));

  return {
    tree,
    totalDiscovered: discoveries.length,
    totalWords: tree.reduce((total, root) => total + root.totalCount, 0),
  };
}

export async function recordHerbariumDiscovery(input: { ownerKey: string; lexicalEntryId: number; sourceMode: HerbariumSourceMode }) {
  const db = await getDb();
  if (!db) throw new Error("L’Herbier est momentanément indisponible.");

  const [entry] = await db.select({ id: lexicalEntries.id, lemma: lexicalEntries.lemma })
    .from(lexicalEntries)
    .where(eq(lexicalEntries.id, input.lexicalEntryId))
    .limit(1);
  if (!entry) return { isNew: false, reason: "unknown-entry" as const };

  const roots = await db.select({ id: herbariumRoots.id, prefix: herbariumRoots.prefix }).from(herbariumRoots);
  const root = roots.find((item) => rootMatchesLemma(item.prefix, entry.lemma));
  if (!root) return { isNew: false, reason: "outside-catalogue" as const };

  const [existing] = await db.select({ id: herbariumDiscoveries.id }).from(herbariumDiscoveries)
    .where(and(eq(herbariumDiscoveries.ownerKey, input.ownerKey), eq(herbariumDiscoveries.lexicalEntryId, entry.id)))
    .limit(1);
  if (existing) return { isNew: false, reason: "already-discovered" as const, rootId: root.id, lemma: entry.lemma };

  await db.insert(herbariumDiscoveries).values({
    ownerKey: input.ownerKey,
    lexicalEntryId: entry.id,
    rootId: root.id,
    sourceMode: input.sourceMode,
  });
  return { isNew: true, rootId: root.id, lemma: entry.lemma };
}

export const GRIMOIRE_ACCENTS = ["violet", "carmin", "safran", "sapin", "bleu"] as const;
export type GrimoireAccent = (typeof GRIMOIRE_ACCENTS)[number];

type GrimoirePoint = { x: number; y: number };

async function assertOwnedGrimoireTheme(ownerKey: string, themeId: number) {
  const db = await getDb();
  if (!db) throw new Error("Le Grimoire est momentanément indisponible.");
  const [theme] = await db.select().from(grimoireThemes)
    .where(and(eq(grimoireThemes.id, themeId), eq(grimoireThemes.ownerKey, ownerKey)))
    .limit(1);
  if (!theme) throw new Error("Ce thème n’appartient pas à votre Grimoire.");
  return theme;
}

/** Renvoie uniquement les mots réellement découverts, puis leur organisation personnelle. */
export async function getGrimoire(ownerKey: string) {
  const db = await getDb();
  if (!db) throw new Error("Le Grimoire est momentanément indisponible.");

  const [discoveries, themes, placements, canvasRows] = await Promise.all([
    db.select({
      lexicalEntryId: herbariumDiscoveries.lexicalEntryId,
      discoveredAt: herbariumDiscoveries.discoveredAt,
      sourceMode: herbariumDiscoveries.sourceMode,
      lemma: lexicalEntries.lemma,
      cnrtlUrl: lexicalEntries.cnrtlUrl,
      rootId: herbariumRoots.id,
      rootName: herbariumRoots.displayName,
      rootOrigin: herbariumRoots.origin,
      rootCategory: herbariumRoots.category,
    })
      .from(herbariumDiscoveries)
      .innerJoin(lexicalEntries, eq(herbariumDiscoveries.lexicalEntryId, lexicalEntries.id))
      .innerJoin(herbariumRoots, eq(herbariumDiscoveries.rootId, herbariumRoots.id))
      .where(eq(herbariumDiscoveries.ownerKey, ownerKey))
      .orderBy(desc(herbariumDiscoveries.discoveredAt), asc(lexicalEntries.lemma)),
    db.select().from(grimoireThemes)
      .where(eq(grimoireThemes.ownerKey, ownerKey))
      .orderBy(asc(grimoireThemes.createdAt)),
    db.select().from(grimoirePlacements)
      .where(eq(grimoirePlacements.ownerKey, ownerKey)),
    db.select().from(grimoireCanvases)
      .where(eq(grimoireCanvases.ownerKey, ownerKey))
      .limit(1),
  ]);

  return {
    discoveries: discoveries.map((word) => ({
      id: word.lexicalEntryId,
      lemma: word.lemma,
      cnrtlUrl: word.cnrtlUrl,
      discoveredAt: word.discoveredAt,
      sourceMode: word.sourceMode,
      root: {
        id: word.rootId,
        name: word.rootName,
        origin: word.rootOrigin,
        category: word.rootCategory,
      },
    })),
    themes: themes.map((theme) => ({
      id: theme.id,
      title: theme.title,
      accent: theme.accent as GrimoireAccent,
      x: theme.x,
      y: theme.y,
    })),
    placements: placements.map((placement) => ({
      lexicalEntryId: placement.lexicalEntryId,
      themeId: placement.themeId,
      x: placement.x,
      y: placement.y,
    })),
    canvas: canvasRows[0]
      ? { offsetX: canvasRows[0].offsetX, offsetY: canvasRows[0].offsetY, zoom: canvasRows[0].zoom }
      : { offsetX: 0, offsetY: 0, zoom: 100 },
  };
}

export async function createGrimoireTheme(input: { ownerKey: string; title: string; accent: GrimoireAccent } & GrimoirePoint) {
  const db = await getDb();
  if (!db) throw new Error("Le Grimoire est momentanément indisponible.");
  const result = await db.insert(grimoireThemes).values(input);
  return { id: Number(result[0].insertId), title: input.title, accent: input.accent, x: input.x, y: input.y };
}

export async function updateGrimoireTheme(input: { ownerKey: string; themeId: number; title?: string; accent?: GrimoireAccent; x?: number; y?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Le Grimoire est momentanément indisponible.");
  await assertOwnedGrimoireTheme(input.ownerKey, input.themeId);
  const values = Object.fromEntries(Object.entries({ title: input.title, accent: input.accent, x: input.x, y: input.y }).filter(([, value]) => value !== undefined));
  if (Object.keys(values).length === 0) throw new Error("Aucune modification de thème n’a été reçue.");
  await db.update(grimoireThemes).set(values).where(and(eq(grimoireThemes.id, input.themeId), eq(grimoireThemes.ownerKey, input.ownerKey)));
  return { id: input.themeId, ...values };
}

export async function deleteGrimoireTheme(input: { ownerKey: string; themeId: number }) {
  const db = await getDb();
  if (!db) throw new Error("Le Grimoire est momentanément indisponible.");
  await assertOwnedGrimoireTheme(input.ownerKey, input.themeId);
  await db.update(grimoirePlacements).set({ themeId: null })
    .where(and(eq(grimoirePlacements.ownerKey, input.ownerKey), eq(grimoirePlacements.themeId, input.themeId)));
  await db.delete(grimoireThemes).where(and(eq(grimoireThemes.id, input.themeId), eq(grimoireThemes.ownerKey, input.ownerKey)));
  return { id: input.themeId };
}

export async function saveGrimoirePlacement(input: { ownerKey: string; lexicalEntryId: number; themeId: number | null } & GrimoirePoint) {
  const db = await getDb();
  if (!db) throw new Error("Le Grimoire est momentanément indisponible.");
  const [discovery] = await db.select({ id: herbariumDiscoveries.id }).from(herbariumDiscoveries)
    .where(and(eq(herbariumDiscoveries.ownerKey, input.ownerKey), eq(herbariumDiscoveries.lexicalEntryId, input.lexicalEntryId)))
    .limit(1);
  if (!discovery) throw new Error("Seuls les mots réellement découverts peuvent être inscrits dans le Grimoire.");
  if (input.themeId !== null) await assertOwnedGrimoireTheme(input.ownerKey, input.themeId);

  const [existing] = await db.select({ id: grimoirePlacements.id }).from(grimoirePlacements)
    .where(and(eq(grimoirePlacements.ownerKey, input.ownerKey), eq(grimoirePlacements.lexicalEntryId, input.lexicalEntryId)))
    .limit(1);
  if (existing) {
    await db.update(grimoirePlacements).set({ themeId: input.themeId, x: input.x, y: input.y })
      .where(eq(grimoirePlacements.id, existing.id));
  } else {
    await db.insert(grimoirePlacements).values(input);
  }
  return { lexicalEntryId: input.lexicalEntryId, themeId: input.themeId, x: input.x, y: input.y };
}

export async function removeGrimoirePlacement(input: { ownerKey: string; lexicalEntryId: number }) {
  const db = await getDb();
  if (!db) throw new Error("Le Grimoire est momentanément indisponible.");
  await db.delete(grimoirePlacements).where(and(eq(grimoirePlacements.ownerKey, input.ownerKey), eq(grimoirePlacements.lexicalEntryId, input.lexicalEntryId)));
  return { lexicalEntryId: input.lexicalEntryId };
}

export async function saveGrimoireCanvas(input: { ownerKey: string; offsetX: number; offsetY: number; zoom: number }) {
  const db = await getDb();
  if (!db) throw new Error("Le Grimoire est momentanément indisponible.");
  const [existing] = await db.select({ ownerKey: grimoireCanvases.ownerKey }).from(grimoireCanvases)
    .where(eq(grimoireCanvases.ownerKey, input.ownerKey)).limit(1);
  if (existing) {
    await db.update(grimoireCanvases).set({ offsetX: input.offsetX, offsetY: input.offsetY, zoom: input.zoom })
      .where(eq(grimoireCanvases.ownerKey, input.ownerKey));
  } else {
    await db.insert(grimoireCanvases).values(input);
  }
  return { offsetX: input.offsetX, offsetY: input.offsetY, zoom: input.zoom };
}
