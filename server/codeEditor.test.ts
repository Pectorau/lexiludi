import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { MAX_EDITOR_FILE_BYTES, canEditCodeEditor, createCodeEditorFileService } from "./codeEditor";

const temporaryRoots: string[] = [];

async function createFixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "lexiludi-editor-"));
  temporaryRoots.push(root);
  await fs.mkdir(path.join(root, "client/src/components"), { recursive: true });
  await fs.mkdir(path.join(root, "server/_core"), { recursive: true });
  await fs.mkdir(path.join(root, "shared"), { recursive: true });
  await fs.mkdir(path.join(root, "drizzle"), { recursive: true });
  await fs.writeFile(path.join(root, "client/src/components/Card.tsx"), "export const Card = () => null;\n");
  await fs.writeFile(path.join(root, "server/feature.ts"), "export const enabled = true;\n");
  await fs.writeFile(path.join(root, "server/_core/secret.ts"), "export const secret = 'hidden';\n");
  await fs.writeFile(path.join(root, "shared/types.ts"), "export type Answer = string;\n");
  await fs.writeFile(path.join(root, "drizzle/schema.ts"), "export {};\n");
  await fs.writeFile(path.join(root, ".env"), "TOKEN=hidden\n");
  return { root, service: createCodeEditorFileService(root) };
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map(root => fs.rm(root, { recursive: true, force: true })));
});

describe("code editor files", () => {
  it("n’autorise que le propriétaire ou un administrateur", () => {
    expect(canEditCodeEditor({ openId: "owner", role: "user" }, "owner")).toBe(true);
    expect(canEditCodeEditor({ openId: "admin", role: "admin" }, "owner")).toBe(true);
    expect(canEditCodeEditor({ openId: "visitor", role: "user" }, "owner")).toBe(false);
  });

  it("liste uniquement les fichiers de code autorisés", async () => {
    const { service } = await createFixture();

    await expect(service.listFiles()).resolves.toEqual([
      { path: "client/src/components/Card.tsx", name: "Card.tsx" },
      { path: "drizzle/schema.ts", name: "schema.ts" },
      { path: "server/feature.ts", name: "feature.ts" },
      { path: "shared/types.ts", name: "types.ts" },
    ]);
  });

  it("bloque les traversées de dossiers et les fichiers internes", async () => {
    const { service } = await createFixture();

    await expect(service.readFile("../.env")).rejects.toThrow("Chemin de fichier non autorisé");
    await expect(service.readFile("server/_core/secret.ts")).rejects.toThrow("Ce fichier n’est pas disponible");
    await expect(service.readFile(".env")).rejects.toThrow("Ce fichier n’est pas disponible");
  });

  it("réécrit seulement le fichier autorisé sélectionné", async () => {
    const { root, service } = await createFixture();

    await expect(service.saveFile("client/src/components/Card.tsx", "export const Card = () => 'updated';\n")).resolves.toMatchObject({
      path: "client/src/components/Card.tsx",
    });
    await expect(fs.readFile(path.join(root, "client/src/components/Card.tsx"), "utf8")).resolves.toContain("updated");
    await expect(fs.readFile(path.join(root, "server/feature.ts"), "utf8")).resolves.toContain("enabled");
  });

  it("refuse les contenus dépassant la limite de taille", async () => {
    const { service } = await createFixture();

    await expect(service.saveFile("client/src/components/Card.tsx", "a".repeat(MAX_EDITOR_FILE_BYTES + 1))).rejects.toThrow("dépasse la taille maximale");
  });
});
