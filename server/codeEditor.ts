import { promises as fs } from "node:fs";
import path from "node:path";
import { TRPCError } from "@trpc/server";

export const MAX_EDITOR_FILE_BYTES = 512_000;

const EDITABLE_DIRECTORIES = ["client/src", "server", "shared"] as const;
const EDITABLE_SPECIAL_FILES = ["drizzle/schema.ts"] as const;
const BLOCKED_SEGMENTS = new Set([".git", ".env", "dist", "node_modules", "_core", "storage"]);
const EDITABLE_EXTENSIONS = new Set([".ts", ".tsx", ".css", ".html", ".json", ".md"]);

export type CodeEditorUser = {
  openId: string;
  role?: string | null;
};

export type EditableCodeFile = {
  path: string;
  name: string;
};

export function canEditCodeEditor(user: CodeEditorUser | null | undefined, ownerOpenId: string) {
  return Boolean(user && (user.openId === ownerOpenId || user.role === "admin"));
}

export function requireCodeEditorAccess(user: CodeEditorUser | null | undefined, ownerOpenId: string) {
  if (!canEditCodeEditor(user, ownerOpenId)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Éditeur de code réservé au propriétaire." });
  }
}

function normalizeRelativePath(candidate: string) {
  if (!candidate || candidate.length > 300 || candidate.includes("\\") || path.isAbsolute(candidate)) {
    throw new Error("Chemin de fichier non autorisé.");
  }

  const normalized = path.posix.normalize(candidate);
  if (normalized === "." || normalized.startsWith("../") || normalized.includes("/../")) {
    throw new Error("Chemin de fichier non autorisé.");
  }

  return normalized;
}

function isAllowedPath(relativePath: string) {
  const isInEditableDirectory = EDITABLE_DIRECTORIES.some(
    directory => relativePath.startsWith(`${directory}/`),
  );
  const isSpecialFile = EDITABLE_SPECIAL_FILES.includes(relativePath as (typeof EDITABLE_SPECIAL_FILES)[number]);
  const containsBlockedSegment = relativePath.split("/").some(segment => BLOCKED_SEGMENTS.has(segment));

  return (isInEditableDirectory || isSpecialFile)
    && !containsBlockedSegment
    && EDITABLE_EXTENSIONS.has(path.posix.extname(relativePath));
}

export function createCodeEditorFileService(projectRoot: string) {
  const root = path.resolve(projectRoot);

  function resolveEditablePath(candidate: string) {
    const relativePath = normalizeRelativePath(candidate);
    if (!isAllowedPath(relativePath)) throw new Error("Ce fichier n’est pas disponible dans l’éditeur.");

    const absolutePath = path.resolve(root, relativePath);
    if (!absolutePath.startsWith(`${root}${path.sep}`)) {
      throw new Error("Chemin de fichier non autorisé.");
    }

    return { absolutePath, relativePath };
  }

  async function walk(relativeDirectory: string, files: EditableCodeFile[]): Promise<void> {
    const absoluteDirectory = path.resolve(root, relativeDirectory);
    let entries: import("node:fs").Dirent<string>[];

    try {
      entries = await fs.readdir(absoluteDirectory, { withFileTypes: true, encoding: "utf8" });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }

    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (BLOCKED_SEGMENTS.has(entry.name) || entry.isSymbolicLink()) continue;

      const relativePath = path.posix.join(relativeDirectory, entry.name);
      if (entry.isDirectory()) {
        await walk(relativePath, files);
        continue;
      }

      if (entry.isFile() && isAllowedPath(relativePath)) {
        files.push({ path: relativePath, name: entry.name });
      }
    }
  }

  return {
    async listFiles() {
      const files: EditableCodeFile[] = [];
      for (const directory of EDITABLE_DIRECTORIES) {
        await walk(directory, files);
      }

      for (const relativePath of EDITABLE_SPECIAL_FILES) {
        try {
          const stats = await fs.lstat(path.resolve(root, relativePath));
          if (stats.isFile() && !stats.isSymbolicLink()) {
            files.push({ path: relativePath, name: path.posix.basename(relativePath) });
          }
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
      }

      return files.sort((a, b) => a.path.localeCompare(b.path));
    },

    async readFile(candidate: string) {
      const { absolutePath, relativePath } = resolveEditablePath(candidate);
      const stats = await fs.lstat(absolutePath);
      if (!stats.isFile() || stats.isSymbolicLink()) throw new Error("Ce chemin ne correspond pas à un fichier éditable.");
      if (stats.size > MAX_EDITOR_FILE_BYTES) throw new Error("Ce fichier dépasse la taille maximale autorisée.");

      return {
        path: relativePath,
        content: await fs.readFile(absolutePath, "utf8"),
        size: stats.size,
      };
    },

    async saveFile(candidate: string, content: string) {
      const { absolutePath, relativePath } = resolveEditablePath(candidate);
      const stats = await fs.lstat(absolutePath);
      if (!stats.isFile() || stats.isSymbolicLink()) throw new Error("Ce chemin ne correspond pas à un fichier éditable.");

      const byteSize = Buffer.byteLength(content, "utf8");
      if (byteSize > MAX_EDITOR_FILE_BYTES) throw new Error("Le contenu dépasse la taille maximale autorisée.");

      await fs.writeFile(absolutePath, content, "utf8");
      return { path: relativePath, size: byteSize, savedAt: new Date().toISOString() };
    },
  };
}

export const codeEditorFileService = createCodeEditorFileService(process.cwd());
