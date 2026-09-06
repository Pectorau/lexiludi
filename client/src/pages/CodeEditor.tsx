import Editor from "@monaco-editor/react";
import { Button } from "@/components/ui/button";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Circle,
  FileCode2,
  Folder,
  FolderOpen,
  Loader2,
  RefreshCw,
  Save,
  ShieldCheck,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";
import "./code-editor.css";

type TreeNode = {
  name: string;
  path: string;
  children: TreeNode[];
  isFile: boolean;
};

const languageForPath = (filePath: string) => {
  if (filePath.endsWith(".tsx")) return "typescript";
  if (filePath.endsWith(".ts")) return "typescript";
  if (filePath.endsWith(".css")) return "css";
  if (filePath.endsWith(".html")) return "html";
  if (filePath.endsWith(".json")) return "json";
  if (filePath.endsWith(".md")) return "markdown";
  return "plaintext";
};

function buildTree(paths: string[]): TreeNode[] {
  const roots: TreeNode[] = [];

  for (const filePath of paths) {
    const parts = filePath.split("/");
    let siblings = roots;
    let accumulated = "";

    parts.forEach((part, index) => {
      accumulated = accumulated ? `${accumulated}/${part}` : part;
      const isFile = index === parts.length - 1;
      let node = siblings.find((candidate) => candidate.name === part);
      if (!node) {
        node = { name: part, path: accumulated, children: [], isFile };
        siblings.push(node);
      }
      siblings = node.children;
    });
  }

  const sortNodes = (nodes: TreeNode[]): TreeNode[] =>
    nodes
      .sort(
        (left, right) =>
          Number(left.isFile) - Number(right.isFile) ||
          left.name.localeCompare(right.name),
      )
      .map((node) => ({ ...node, children: sortNodes(node.children) }));

  return sortNodes(roots);
}

function FileTree({
  nodes,
  selectedPath,
  onSelect,
  depth = 0,
}: {
  nodes: TreeNode[];
  selectedPath: string | null;
  onSelect: (path: string) => void;
  depth?: number;
}) {
  const [openFolders, setOpenFolders] = useState<Set<string>>(
    () => new Set(["client", "server", "shared", "drizzle"]),
  );

  return (
    <ul
      className="code-editor-tree"
      aria-label={depth === 0 ? "Fichiers éditables" : undefined}
    >
      {nodes.map((node) => {
        if (node.isFile) {
          const isSelected = selectedPath === node.path;
          return (
            <li key={node.path}>
              <button
                className={`code-editor-tree-item code-editor-file ${isSelected ? "is-selected" : ""}`}
                onClick={() => onSelect(node.path)}
                style={{ paddingLeft: `${12 + depth * 16}px` }}
                aria-current={isSelected ? "page" : undefined}
                title={node.path}
              >
                <FileCode2 size={15} aria-hidden="true" />
                <span>{node.name}</span>
              </button>
            </li>
          );
        }

        const isOpen = openFolders.has(node.path);
        return (
          <li key={node.path}>
            <button
              className="code-editor-tree-item code-editor-folder"
              onClick={() =>
                setOpenFolders((current) => {
                  const next = new Set(current);
                  if (next.has(node.path)) next.delete(node.path);
                  else next.add(node.path);
                  return next;
                })
              }
              style={{ paddingLeft: `${12 + depth * 16}px` }}
              aria-expanded={isOpen}
            >
              {isOpen ? (
                <ChevronDown size={14} aria-hidden="true" />
              ) : (
                <ChevronRight size={14} aria-hidden="true" />
              )}
              {isOpen ? (
                <FolderOpen size={15} aria-hidden="true" />
              ) : (
                <Folder size={15} aria-hidden="true" />
              )}
              <span>{node.name}</span>
            </button>
            {isOpen ? (
              <FileTree
                nodes={node.children}
                selectedPath={selectedPath}
                onSelect={onSelect}
                depth={depth + 1}
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export default function CodeEditor() {
  const access = trpc.codeEditor.access.useQuery();
  const tree = trpc.codeEditor.tree.useQuery(undefined, {
    enabled: Boolean(access.data?.canEdit),
  });
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const currentFile = trpc.codeEditor.file.useQuery(
    { path: selectedPath ?? "placeholder.ts" },
    { enabled: Boolean(access.data?.canEdit && selectedPath) },
  );
  const [draft, setDraft] = useState("");
  const [savedContent, setSavedContent] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const saveMutation = trpc.codeEditor.save.useMutation();

  const filePaths = useMemo(
    () => tree.data?.map((file) => file.path) ?? [],
    [tree.data],
  );
  const fileTree = useMemo(() => buildTree(filePaths), [filePaths]);
  const isDirty = Boolean(
    selectedPath && savedContent !== null && draft !== savedContent,
  );

  useEffect(() => {
    if (!selectedPath && filePaths.length > 0)
      setSelectedPath(filePaths[0] ?? null);
  }, [filePaths, selectedPath]);

  useEffect(() => {
    if (!currentFile.data || currentFile.data.path !== selectedPath) return;
    setDraft(currentFile.data.content);
    setSavedContent(currentFile.data.content);
    setLastSavedAt(null);
  }, [currentFile.data, selectedPath]);

  const selectFile = useCallback(
    (nextPath: string) => {
      if (nextPath === selectedPath) return;
      if (
        isDirty &&
        !window.confirm(
          "Les modifications actuelles ne sont pas sauvegardées. Ouvrir un autre fichier ?",
        )
      )
        return;
      setSelectedPath(nextPath);
    },
    [isDirty, selectedPath],
  );

  const saveCurrentFile = useCallback(async () => {
    if (!selectedPath || !isDirty || saveMutation.isPending) return;

    try {
      const result = await saveMutation.mutateAsync({
        path: selectedPath,
        content: draft,
      });
      setSavedContent(draft);
      setLastSavedAt(result.savedAt);
      toast.success(`${result.path} a été sauvegardé.`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "La sauvegarde a échoué.",
      );
    }
  }, [draft, isDirty, saveMutation, selectedPath]);

  useEffect(() => {
    const saveFromKeyboard = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveCurrentFile();
      }
    };
    window.addEventListener("keydown", saveFromKeyboard);
    return () => window.removeEventListener("keydown", saveFromKeyboard);
  }, [saveCurrentFile]);

  if (access.isLoading) {
    return (
      <main className="code-editor-loading">
        <Loader2 className="animate-spin" size={20} /> Ouverture de l’éditeur…
      </main>
    );
  }

  if (!access.data?.canEdit) {
    return (
      <main className="code-editor-guard">
        <ShieldCheck size={32} aria-hidden="true" />
        <p className="mini-label">ESPACE PRIVÉ</p>
        <h1>Éditeur réservé</h1>
        <p>
          Connectez-vous avec le compte propriétaire pour accéder aux fichiers
          du projet.
        </p>
        <Button onClick={() => startLogin()} className="code-editor-login">
          Se connecter
        </Button>
        <Link href="/">
          <ArrowLeft size={15} /> Retour aux jeux
        </Link>
      </main>
    );
  }

  return (
    <main className="code-editor-shell">
      <header className="code-editor-header">
        <div className="code-editor-heading">
          <Link href="/atelier" className="code-editor-back">
            <ArrowLeft size={15} /> Atelier visuel
          </Link>
          <div>
            <p className="mini-label">ATELIER TECHNIQUE · ACCÈS PROPRIÉTAIRE</p>
            <h1>
              Éditeur de <em>code.</em>
            </h1>
          </div>
        </div>
        <div className="code-editor-actions">
          <span className={`code-editor-status ${isDirty ? "is-dirty" : ""}`}>
            {isDirty ? (
              <Circle size={9} fill="currentColor" aria-hidden="true" />
            ) : (
              <ShieldCheck size={15} aria-hidden="true" />
            )}
            {isDirty ? "Modifications non sauvegardées" : "Fichier sauvegardé"}
          </span>
          <Button
            onClick={() => void saveCurrentFile()}
            disabled={!isDirty || saveMutation.isPending}
            className="code-editor-save"
          >
            {saveMutation.isPending ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              <Save size={16} />
            )}
            Sauvegarder
          </Button>
        </div>
      </header>

      <section className="code-editor-workbench" aria-label="Éditeur de code">
        <aside className="code-editor-sidebar">
          <div className="code-editor-sidebar-header">
            <div>
              <p className="mini-label">FICHIERS AUTORISÉS</p>
              <b>LexiLudi</b>
            </div>
            <button
              className="code-editor-icon-button"
              onClick={() => void tree.refetch()}
              title="Actualiser l’arborescence"
              aria-label="Actualiser l’arborescence"
            >
              <RefreshCw
                size={15}
                className={tree.isFetching ? "animate-spin" : ""}
              />
            </button>
          </div>
          {tree.isLoading ? (
            <div className="code-editor-sidebar-empty">
              <Loader2 className="animate-spin" size={18} /> Chargement…
            </div>
          ) : null}
          {tree.isError ? (
            <div className="code-editor-sidebar-empty">
              <AlertTriangle size={18} /> Impossible de charger les fichiers.
            </div>
          ) : null}
          {tree.data ? (
            <FileTree
              nodes={fileTree}
              selectedPath={selectedPath}
              onSelect={selectFile}
            />
          ) : null}
        </aside>

        <section className="code-editor-pane">
          <div className="code-editor-tabbar">
            <div className="code-editor-tab">
              <FileCode2 size={15} aria-hidden="true" />
              <span>{selectedPath ?? "Sélectionnez un fichier"}</span>
              {isDirty ? (
                <Circle
                  size={8}
                  fill="currentColor"
                  aria-label="Modifications non sauvegardées"
                />
              ) : null}
            </div>
            {lastSavedAt ? (
              <time dateTime={lastSavedAt}>
                Sauvegardé à{" "}
                {new Date(lastSavedAt).toLocaleTimeString("fr-FR", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </time>
            ) : null}
          </div>
          <div className="code-editor-canvas">
            {currentFile.isLoading ? (
              <div className="code-editor-state">
                <Loader2 className="animate-spin" size={22} /> Chargement du
                fichier…
              </div>
            ) : null}
            {currentFile.isError ? (
              <div className="code-editor-state code-editor-state-error">
                <AlertTriangle size={22} /> Ce fichier ne peut pas être ouvert.
              </div>
            ) : null}
            {!selectedPath && !currentFile.isLoading ? (
              <div className="code-editor-state">
                Choisissez un fichier dans l’arborescence.
              </div>
            ) : null}
            {selectedPath && currentFile.data ? (
              <Editor
                height="100%"
                language={languageForPath(selectedPath)}
                path={selectedPath}
                value={draft}
                theme="vs-dark"
                beforeMount={(monaco) => {
                  monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions(
                    {
                      noSemanticValidation: true,
                      noSyntaxValidation: false,
                    },
                  );
                }}
                onChange={(value) => setDraft(value ?? "")}
                options={{
                  automaticLayout: true,
                  fontSize: 14,
                  fontLigatures: true,
                  minimap: { enabled: false },
                  padding: { top: 16, bottom: 16 },
                  scrollBeyondLastLine: false,
                  smoothScrolling: true,
                  tabSize: 2,
                  wordWrap: "on",
                }}
              />
            ) : null}
          </div>
          <footer className="code-editor-footer">
            <span>{selectedPath ? languageForPath(selectedPath) : "—"}</span>
            <span>Ctrl/Cmd + S pour sauvegarder</span>
            <span>Écriture limitée aux sources autorisées</span>
          </footer>
        </section>
      </section>
    </main>
  );
}
