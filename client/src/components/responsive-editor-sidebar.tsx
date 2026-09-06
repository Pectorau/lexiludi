import { CopyPlus, Monitor, Save, Smartphone } from "lucide-react";
import { useState } from "react";
import { useVisualEditor } from "./visual-editor-context";
import "./responsive-editor-sidebar.css";

type CompositionTemplate = {
  id: string;
  name: string;
  blocks: Array<{
    responsive?: {
      desktop: {
        x: number;
        y: number;
        width: number;
        height: number;
        hidden?: boolean;
      };
      mobile: {
        x: number;
        y: number;
        width: number;
        height: number;
        hidden?: boolean;
      };
    };
    style?: {
      zIndex?: number;
      opacity?: number;
      padding?: number;
      borderRadius?: number;
    };
    content?: string;
  }>;
};
const TEMPLATE_KEY = "motif.visual-editor.templates.v1";
function readTemplates(): CompositionTemplate[] {
  try {
    return JSON.parse(
      window.localStorage.getItem(TEMPLATE_KEY) ?? "[]",
    ) as CompositionTemplate[];
  } catch {
    return [];
  }
}

export function ResponsiveEditorSidebar() {
  const {
    isEditMode,
    viewportMode,
    setViewportMode,
    selectedIds,
    layouts,
    updateBlock,
    updateActiveLayout,
    saveNow,
    isDirty,
    isSaving,
  } = useVisualEditor();
  const [templates, setTemplates] =
    useState<CompositionTemplate[]>(readTemplates);
  const [templateName, setTemplateName] = useState("");
  const id = selectedIds[0];
  const block = id ? layouts[id] : undefined;
  const layout = block?.responsive?.[viewportMode];
  if (!isEditMode) return null;
  const saveTemplate = () => {
    const blocks = selectedIds
      .map((selectedId) => layouts[selectedId])
      .filter(Boolean)
      .map((item) => ({
        responsive: item.responsive,
        style: item.style,
        content: item.content,
      }));
    if (!templateName.trim() || !blocks.length) return;
    const next = [
      ...templates,
      {
        id: crypto.randomUUID(),
        name: templateName.trim().slice(0, 48),
        blocks,
      },
    ];
    window.localStorage.setItem(TEMPLATE_KEY, JSON.stringify(next));
    setTemplates(next);
    setTemplateName("");
  };
  const applyTemplate = (template: CompositionTemplate) => {
    if (!selectedIds.length || !template.blocks.length) return;
    selectedIds.forEach((selectedId, index) => {
      const source = template.blocks[index] ?? template.blocks[0]!;
      if (source.style) updateBlock(selectedId, { style: source.style });
      const layoutPatch = source.responsive?.[viewportMode];
      if (layoutPatch) updateActiveLayout(selectedId, layoutPatch);
    });
  };
  return (
    <aside
      data-editor-ui
      className="responsive-editor-sidebar"
      aria-label="Composition responsive"
    >
      <header>
        <b>Composition</b>
        <button
          type="button"
          className={isDirty ? "is-dirty" : ""}
          onClick={() => void saveNow()}
          disabled={isSaving}
        >
          <Save size={14} />{" "}
          {isSaving ? "Enreg." : isDirty ? "Sauvegarder" : "À jour"}
        </button>
      </header>
      <div
        className="responsive-viewport-switch"
        role="group"
        aria-label="Format à modifier"
      >
        <button
          type="button"
          className={viewportMode === "desktop" ? "is-active" : ""}
          onClick={() => setViewportMode("desktop")}
        >
          <Monitor size={14} /> Ordinateur
        </button>
        <button
          type="button"
          className={viewportMode === "mobile" ? "is-active" : ""}
          onClick={() => setViewportMode("mobile")}
        >
          <Smartphone size={14} /> Mobile
        </button>
      </div>
      {block && layout ? (
        <section>
          <p>
            <b>{id.replace(".", " · ")}</b>
            <small>
              Réglages {viewportMode === "mobile" ? "mobile" : "ordinateur"}
            </small>
          </p>
          <label>
            Opacité{" "}
            <output>{Math.round((block.style?.opacity ?? 1) * 100)}%</output>
            <input
              type="range"
              min="0.2"
              max="1"
              step="0.05"
              value={block.style?.opacity ?? 1}
              onChange={(event) =>
                updateBlock(id, {
                  style: {
                    ...block.style,
                    opacity: Number(event.target.value),
                  },
                })
              }
            />
          </label>
          <label>
            Arrondi <output>{block.style?.borderRadius ?? 0}px</output>
            <input
              type="range"
              min="0"
              max="32"
              step="2"
              value={block.style?.borderRadius ?? 0}
              onChange={(event) =>
                updateBlock(id, {
                  style: {
                    ...block.style,
                    borderRadius: Number(event.target.value),
                  },
                })
              }
            />
          </label>
          <label>
            Espacement <output>{block.style?.padding ?? 0}px</output>
            <input
              type="range"
              min="0"
              max="80"
              step="4"
              value={block.style?.padding ?? 0}
              onChange={(event) =>
                updateBlock(id, {
                  style: {
                    ...block.style,
                    padding: Number(event.target.value),
                  },
                })
              }
            />
          </label>
          <label className="responsive-hide-toggle">
            <input
              type="checkbox"
              checked={Boolean(layout.hidden)}
              onChange={(event) =>
                updateActiveLayout(id, { hidden: event.target.checked })
              }
            />{" "}
            Masquer pour {viewportMode === "mobile" ? "mobile" : "ordinateur"}
          </label>
        </section>
      ) : (
        <p className="responsive-empty">
          Sélectionnez un bloc puis choisissez le format à composer.
        </p>
      )}
      <section className="responsive-templates">
        <b>Modèles réutilisables</b>
        {selectedIds.length > 0 && (
          <div>
            <input
              value={templateName}
              maxLength={48}
              onChange={(event) => setTemplateName(event.target.value)}
              placeholder="Nom du modèle"
            />
            <button type="button" onClick={saveTemplate}>
              <CopyPlus size={13} /> Sauver
            </button>
          </div>
        )}
        {templates.length ? (
          templates.map((template) => (
            <button
              type="button"
              key={template.id}
              onClick={() => applyTemplate(template)}
            >
              {template.name}
              <span>Appliquer</span>
            </button>
          ))
        ) : (
          <small>
            Enregistrez une sélection pour créer votre premier modèle.
          </small>
        )}
      </section>
    </aside>
  );
}
