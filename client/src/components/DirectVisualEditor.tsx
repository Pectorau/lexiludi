import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Check,
  Clipboard,
  Copy,
  EyeOff,
  Grip,
  Group,
  Maximize2,
  Monitor,
  MousePointer2,
  Palette,
  Save,
  Scissors,
  Smartphone,
  Type,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  buildVisualEditorPageCss,
  NON_HIDEABLE_VISUAL_BLOCKS,
  pageForVisualEditorPath,
  TEXT_SELECTORS,
  VISUAL_EDITOR_SELECTORS,
} from "@/lib/visualEditorDom";
import {
  EMPTY_VISUAL_EDITOR_CONFIG,
  type VisualBlockConfig,
  type VisualEditorConfig,
  type VisualEditorFont,
} from "../../../shared/visualEditor";
import "./direct-visual-editor.css";

type RectSnapshot = {
  id: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
  centerX: number;
  centerY: number;
};
type DragState = {
  ids: string[];
  startX: number;
  startY: number;
  bases: Record<string, { x: number; y: number }>;
  primary: RectSnapshot;
  references: RectSnapshot[];
};
type ResizeState = {
  id: string;
  startX: number;
  startY: number;
  width: number;
  height: number;
  parentWidth: number;
};
type AlignmentGuide = { axis: "x" | "y"; position: number; label: string };

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));
const snap = (value: number) => Math.round(value / 8) * 8;
const clone = (value: VisualEditorConfig) =>
  JSON.parse(JSON.stringify(value)) as VisualEditorConfig;
const toSnapshot = (id: string, rect: DOMRect): RectSnapshot => ({
  id,
  left: rect.left,
  top: rect.top,
  right: rect.right,
  bottom: rect.bottom,
  centerX: rect.left + rect.width / 2,
  centerY: rect.top + rect.height / 2,
});

function blockConfig(config: VisualEditorConfig, id: string) {
  return config.blocks[id] ?? {};
}
function patchBlock(
  config: VisualEditorConfig,
  id: string,
  patch: Partial<VisualBlockConfig>,
): VisualEditorConfig {
  return {
    blocks: {
      ...config.blocks,
      [id]: { ...blockConfig(config, id), ...patch },
    },
  };
}
function candidateAlignment(
  axis: "x" | "y",
  start: number,
  length: number,
  references: RectSnapshot[],
) {
  const values =
    axis === "x"
      ? [start, start + length, start + length / 2]
      : [start, start + length, start + length / 2];
  const keys =
    axis === "x"
      ? (["left", "right", "centerX"] as const)
      : (["top", "bottom", "centerY"] as const);
  const labels =
    axis === "x"
      ? ["bords gauches", "bords droits", "centres"]
      : ["bords hauts", "bords bas", "centres"];
  let closest: { delta: number; guide: AlignmentGuide } | null = null;
  for (const reference of references) {
    for (let index = 0; index < keys.length; index += 1) {
      const key = keys[index]!;
      const delta = reference[key] - values[index]!;
      if (
        Math.abs(delta) > 9 ||
        (closest && Math.abs(delta) >= Math.abs(closest.delta))
      )
        continue;
      closest = {
        delta,
        guide: {
          axis,
          position: reference[key],
          label: `aligné · ${labels[index]}`,
        },
      };
    }
  }
  return closest;
}

const FONT_OPTIONS: Array<{ value: VisualEditorFont; label: string }> = [
  { value: "inherit", label: "Style du site" },
  { value: "serif", label: "Éditorial" },
  { value: "sans", label: "Net" },
  { value: "mono", label: "Monospace" },
  { value: "hand", label: "Manuscrite" },
];

export default function DirectVisualEditor() {
  const [location, setLocation] = useLocation();
  const pathname = location.split("?")[0] || "/";
  const page = pageForVisualEditorPath(pathname);
  const search = typeof window === "undefined" ? "" : window.location.search;
  const access = trpc.visualEditor.access.useQuery();
  const canEdit = access.data?.canEdit === true;
  const active = Boolean(
    page && new URLSearchParams(search).get("edit") === "1" && canEdit,
  );
  const draft = trpc.visualEditor.draft.useQuery(
    { page: page ?? "home" },
    { enabled: active && Boolean(page), retry: false },
  );
  const utils = trpc.useUtils();
  const [config, setConfig] = useState<VisualEditorConfig>(
    EMPTY_VISUAL_EDITOR_CONFIG,
  );
  const configRef = useRef(config);
  const [selected, setSelected] = useState<string[]>([]);
  const selectedRef = useRef(selected);
  const [clipboard, setClipboard] = useState<VisualBlockConfig | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [resize, setResize] = useState<ResizeState | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [guides, setGuides] = useState<AlignmentGuide[]>([]);
  const [viewportMode, setViewportMode] = useState<"desktop" | "mobile">(
    "desktop",
  );

  useEffect(() => {
    configRef.current = config;
  }, [config]);
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);
  useEffect(() => {
    if (draft.data) {
      setConfig(draft.data.config);
      configRef.current = draft.data.config;
    }
  }, [draft.data]);

  const save = trpc.visualEditor.saveDraft.useMutation({
    onSuccess: () => {
      utils.visualEditor.draft.invalidate({ page: page ?? "home" });
      toast.success("Brouillon direct enregistré.");
    },
    onError: () => toast.error("Enregistrement impossible."),
  });
  const publish = trpc.visualEditor.publish.useMutation({
    onSuccess: () => {
      utils.visualEditor.invalidate();
      toast.success("Composition publiée.");
    },
    onError: () => toast.error("Publication impossible."),
  });
  const directCss = useMemo(
    () =>
      page ? buildVisualEditorPageCss(page, config.blocks, viewportMode) : "",
    [page, config.blocks, viewportMode],
  );
  const selectedId = selected[0];
  const selectedConfig = selectedId
    ? blockConfig(config, selectedId)
    : undefined;
  const isProtected = selectedId
    ? NON_HIDEABLE_VISUAL_BLOCKS.has(selectedId)
    : true;
  const canEditText = Boolean(selectedId && TEXT_SELECTORS[selectedId]);

  const stopEditing = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("edit");
    setLocation(`${url.pathname}${url.search}`);
  };
  const updateConfig = (next: VisualEditorConfig) => {
    configRef.current = next;
    setConfig(next);
  };
  const updateAppearance = (
    patch: NonNullable<VisualBlockConfig["appearance"]>,
  ) => {
    if (selectedId)
      updateConfig(
        patchBlock(configRef.current, selectedId, {
          appearance: { ...selectedConfig?.appearance, ...patch },
        }),
      );
  };
  const activeLayout = (source: VisualEditorConfig, id: string) =>
    source.blocks[id]?.responsive?.[viewportMode] ??
    source.blocks[id]?.layout ??
    {};
  const patchActiveLayout = (
    source: VisualEditorConfig,
    id: string,
    patch: Record<string, number | boolean | undefined>,
  ) => {
    const current = activeLayout(source, id);
    const responsive = {
      ...source.blocks[id]?.responsive,
      [viewportMode]: { ...current, ...patch },
    };
    return patchBlock(source, id, {
      responsive,
      ...(viewportMode === "desktop"
        ? { layout: { ...source.blocks[id]?.layout, ...patch } }
        : {}),
    });
  };
  const targets = () => (page ? VISUAL_EDITOR_SELECTORS[page] : {});
  const idsForMove = (id: string) => {
    const group = blockConfig(configRef.current, id).group;
    return group
      ? Object.keys(configRef.current.blocks).filter(
          (blockId) => blockConfig(configRef.current, blockId).group === group,
        )
      : [id];
  };

  useEffect(() => {
    if (!active || !page || page === "home" || page === "multiplayer") return;
    const mapped = targets();
    const cleanups: Array<() => void> = [];
    Object.entries(mapped).forEach(([id, selector]) =>
      document.querySelectorAll<HTMLElement>(selector).forEach((node) => {
        const onPointerDown = (event: PointerEvent) => {
          if (
            (event.target as HTMLElement).closest(
              ".direct-visual-toolbar,.direct-visual-frame,.direct-visual-inspector",
            )
          )
            return;
          event.preventDefault();
          event.stopPropagation();
          const currentSelection = selectedRef.current;
          const nextSelection =
            event.metaKey || event.ctrlKey
              ? currentSelection.includes(id)
                ? currentSelection.filter((item) => item !== id)
                : [...currentSelection, id]
              : [id];
          const moved = idsForMove(id);
          const bases = Object.fromEntries(
            moved.map((blockId) => [
              blockId,
              {
                x: activeLayout(configRef.current, blockId).x ?? 0,
                y: activeLayout(configRef.current, blockId).y ?? 0,
              },
            ]),
          );
          const primary = toSnapshot(id, node.getBoundingClientRect());
          const references = Array.from(
            document.querySelectorAll<HTMLElement>("[data-visual-block]"),
          )
            .filter(
              (candidate) =>
                !moved.includes(candidate.dataset.visualBlock ?? ""),
            )
            .map((candidate) =>
              toSnapshot(
                candidate.dataset.visualBlock ?? "bloc",
                candidate.getBoundingClientRect(),
              ),
            );
          setSelected(nextSelection);
          setDrag({
            ids: moved,
            startX: event.clientX,
            startY: event.clientY,
            bases,
            primary,
            references,
          });
        };
        node.dataset.visualBlock = id;
        node.classList.add("visual-direct-target");
        node.addEventListener("pointerdown", onPointerDown);
        cleanups.push(() => {
          node.removeEventListener("pointerdown", onPointerDown);
          delete node.dataset.visualBlock;
          node.classList.remove(
            "visual-direct-target",
            "is-visual-selected",
            "is-visual-grouped",
          );
        });
      }),
    );
    return () => cleanups.forEach((cleanup) => cleanup());
    // Le montage doit suivre la navigation vers une vraie page, pas le contenu du brouillon.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, page, location]);

  useEffect(() => {
    document
      .querySelectorAll<HTMLElement>("[data-visual-block]")
      .forEach((node) => {
        const id = node.dataset.visualBlock ?? "";
        node.classList.toggle("is-visual-selected", selected.includes(id));
        node.classList.toggle(
          "is-visual-grouped",
          Boolean(blockConfig(config, id).group),
        );
      });
    const current = selectedId
      ? document.querySelector<HTMLElement>(
          `[data-visual-block="${selectedId}"]`,
        )
      : null;
    setRect(current?.getBoundingClientRect() ?? null);
  }, [config, selected, selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    const updateFrame = () =>
      setRect(
        document
          .querySelector<HTMLElement>(`[data-visual-block="${selectedId}"]`)
          ?.getBoundingClientRect() ?? null,
      );
    const target = document.querySelector<HTMLElement>(
      `[data-visual-block="${selectedId}"]`,
    );
    const observer = target ? new ResizeObserver(updateFrame) : null;
    observer?.observe(target!);
    window.addEventListener("scroll", updateFrame, true);
    window.addEventListener("resize", updateFrame);
    return () => {
      observer?.disconnect();
      window.removeEventListener("scroll", updateFrame, true);
      window.removeEventListener("resize", updateFrame);
    };
  }, [selectedId]);

  useEffect(() => {
    if (!active) return;
    const onMove = (event: PointerEvent) => {
      if (drag) {
        let dx = snap(event.clientX - drag.startX);
        let dy = snap(event.clientY - drag.startY);
        const xGuide = candidateAlignment(
          "x",
          drag.primary.left + dx,
          drag.primary.right - drag.primary.left,
          drag.references,
        );
        const yGuide = candidateAlignment(
          "y",
          drag.primary.top + dy,
          drag.primary.bottom - drag.primary.top,
          drag.references,
        );
        if (xGuide) dx += xGuide.delta;
        if (yGuide) dy += yGuide.delta;
        setGuides([
          ...(xGuide ? [xGuide.guide] : []),
          ...(yGuide ? [yGuide.guide] : []),
        ]);
        let next = configRef.current;
        drag.ids.forEach((id) => {
          const base = drag.bases[id]!;
          next = patchActiveLayout(next, id, {
            x: clamp(base.x + dx, -320, 320),
            y: clamp(base.y + dy, -320, 320),
          });
        });
        updateConfig(next);
      }
      if (resize) {
        const width = clamp(
          Math.round(
            ((resize.width + event.clientX - resize.startX) /
              resize.parentWidth) *
              100,
          ),
          25,
          100,
        );
        const height = clamp(
          Math.round(resize.height + event.clientY - resize.startY),
          40,
          900,
        );
        updateConfig(
          patchActiveLayout(configRef.current, resize.id, { width, height }),
        );
      }
    };
    const onUp = () => {
      setDrag(null);
      setResize(null);
      setGuides([]);
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
    };
  }, [active, drag, resize, viewportMode]);

  if (!canEdit || pathname.startsWith("/atelier")) return null;
  if (page === "home" || page === "multiplayer") {
    if (!active)
      return (
        <button
          type="button"
          className="direct-visual-launcher"
          onClick={() => {
            const url = new URL(window.location.href);
            url.searchParams.set("edit", "1");
            setLocation(`${url.pathname}${url.search}`);
          }}
        >
          <MousePointer2 size={14} /> Éditer cette page
        </button>
      );
    return null;
  }
  if (!active)
    return (
      <button
        type="button"
        className="direct-visual-launcher"
        onClick={() => {
          const url = new URL(window.location.href);
          url.searchParams.set("edit", "1");
          setLocation(`${url.pathname}${url.search}`);
        }}
      >
        <MousePointer2 size={14} /> Éditer cette page
      </button>
    );
  const displayedText = selectedId
    ? (selectedConfig?.text ??
      document
        .querySelector<HTMLElement>(`[data-visual-block="${selectedId}"]`)
        ?.innerText.trim()
        .slice(0, 220) ??
      "")
    : "";
  return (
    <>
      <style data-direct-visual-editor>{directCss}</style>
      <div className="direct-visual-grid" aria-hidden="true" />
      {guides.map((guide, index) => (
        <div
          key={`${guide.axis}-${index}`}
          className={`direct-visual-guide direct-visual-guide-${guide.axis}`}
          style={
            guide.axis === "x"
              ? { left: guide.position }
              : { top: guide.position }
          }
        >
          <span>{guide.label}</span>
        </div>
      ))}
      <div data-editor-ui className="direct-visual-toolbar">
        <span>
          <MousePointer2 size={14} /> ÉDITION DIRECTE
        </span>
        <b>{selectedId ? selectedId.replace(".", " · ") : "Cliquez un bloc"}</b>
        <button
          type="button"
          onClick={() =>
            selectedId &&
            document
              .querySelector<HTMLTextAreaElement>(
                ".direct-visual-inspector textarea",
              )
              ?.focus()
          }
          disabled={!canEditText}
        >
          <Type size={14} /> Texte
        </button>
        <button
          type="button"
          onClick={() =>
            selectedConfig &&
            setClipboard(clone({ blocks: { x: selectedConfig } }).blocks.x)
          }
          disabled={!selectedId}
        >
          <Copy size={14} /> Copier
        </button>
        <button
          type="button"
          onClick={() => {
            if (clipboard && selectedId) {
              const { group: _group, ...copied } = clipboard;
              updateConfig(
                patchBlock(
                  configRef.current,
                  selectedId,
                  clone({ blocks: { x: copied } }).blocks.x,
                ),
              );
            }
          }}
          disabled={!selectedId || !clipboard}
        >
          <Clipboard size={14} /> Coller
        </button>
        <button
          type="button"
          onClick={() => {
            if (selected.length < 2)
              return toast.error(
                "Sélectionnez au moins deux blocs avec Ctrl/Cmd + clic.",
              );
            const groupId = `g-${Date.now()}`;
            let next = configRef.current;
            selected.forEach((id) => {
              next = patchBlock(next, id, { group: groupId });
            });
            updateConfig(next);
            toast.success("Blocs groupés : ils se déplaceront ensemble.");
          }}
        >
          <Group size={14} /> Grouper
        </button>
        <button
          type="button"
          onClick={() => {
            if (!selectedId || !selectedConfig?.group) return;
            let next = configRef.current;
            Object.keys(next.blocks)
              .filter(
                (id) => blockConfig(next, id).group === selectedConfig.group,
              )
              .forEach((id) => {
                next = patchBlock(next, id, { group: undefined });
              });
            updateConfig(next);
            toast.success("Groupe scindé.");
          }}
          disabled={!selectedConfig?.group}
        >
          <Scissors size={14} /> Scinder
        </button>
        <button
          type="button"
          onClick={() =>
            selectedId &&
            updateConfig(
              patchBlock(configRef.current, selectedId, { visible: false }),
            )
          }
          disabled={!selectedId || isProtected}
        >
          <EyeOff size={14} /> Retirer
        </button>
        <button
          type="button"
          onClick={() => save.mutate({ page: page!, config })}
          disabled={save.isPending}
        >
          <Save size={14} /> Enregistrer
        </button>
        <button
          type="button"
          className="direct-publish"
          onClick={() => publish.mutate({ page: page! })}
          disabled={publish.isPending}
        >
          <Check size={14} /> Publier
        </button>
        <button type="button" onClick={stopEditing}>
          <X size={14} /> Quitter
        </button>
      </div>
      {selectedId && selectedConfig && (
        <aside
          data-editor-ui
          className="direct-visual-inspector"
          aria-label="Propriétés du bloc sélectionné"
        >
          <header>
            <Palette size={15} />
            <div>
              <b>Propriétés du bloc</b>
              <small>{selectedId.replace(".", " · ")}</small>
            </div>
          </header>
          {canEditText && (
            <label className="direct-text-field">
              Texte
              <textarea
                value={displayedText}
                maxLength={220}
                onChange={(event) =>
                  updateConfig(
                    patchBlock(configRef.current, selectedId, {
                      text: event.target.value,
                    }),
                  )
                }
              />
            </label>
          )}
          <div className="direct-appearance-grid">
            <label>
              Fond
              <input
                type="color"
                value={selectedConfig.appearance?.backgroundColor ?? "#fffdf4"}
                onChange={(event) =>
                  updateAppearance({ backgroundColor: event.target.value })
                }
              />
            </label>
            <label>
              Texte
              <input
                type="color"
                value={selectedConfig.appearance?.textColor ?? "#17231c"}
                onChange={(event) =>
                  updateAppearance({ textColor: event.target.value })
                }
              />
            </label>
            <label>
              Bord
              <input
                type="color"
                value={selectedConfig.appearance?.borderColor ?? "#9b9a86"}
                onChange={(event) =>
                  updateAppearance({ borderColor: event.target.value })
                }
              />
            </label>
          </div>
          <label className="direct-font-field">
            Police
            <select
              value={selectedConfig.appearance?.font ?? "inherit"}
              onChange={(event) =>
                updateAppearance({
                  font: event.target.value as VisualEditorFont,
                })
              }
            >
              {FONT_OPTIONS.map((font) => (
                <option key={font.value} value={font.value}>
                  {font.label}
                </option>
              ))}
            </select>
          </label>
          <label className="direct-range-field">
            Taille <b>{selectedConfig.appearance?.fontSize ?? "auto"}</b>
            <input
              type="range"
              min="10"
              max="72"
              value={selectedConfig.appearance?.fontSize ?? 16}
              onChange={(event) =>
                updateAppearance({ fontSize: Number(event.target.value) })
              }
            />
          </label>
          <div className="direct-align-row">
            <span>Aligner le texte</span>
            <button
              type="button"
              className={selectedConfig.align === "start" ? "is-active" : ""}
              onClick={() =>
                updateConfig(
                  patchBlock(configRef.current, selectedId, { align: "start" }),
                )
              }
            >
              <AlignLeft size={14} />
            </button>
            <button
              type="button"
              className={selectedConfig.align === "center" ? "is-active" : ""}
              onClick={() =>
                updateConfig(
                  patchBlock(configRef.current, selectedId, {
                    align: "center",
                  }),
                )
              }
            >
              <AlignCenter size={14} />
            </button>
            <button
              type="button"
              className={selectedConfig.align === "end" ? "is-active" : ""}
              onClick={() =>
                updateConfig(
                  patchBlock(configRef.current, selectedId, { align: "end" }),
                )
              }
            >
              <AlignRight size={14} />
            </button>
          </div>
          <p className="direct-snap-note">
            Déplacez le bloc : les lignes bleues indiquent l’alignement et
            l’accrochage à 8 px.
          </p>
        </aside>
      )}
      {rect && selectedId && (
        <div
          data-editor-ui
          className="direct-visual-frame"
          style={{
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
          }}
        >
          <span>
            <Grip size={13} /> {selectedId}
          </span>
          <button
            type="button"
            aria-label="Redimensionner le bloc"
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              const element = document.querySelector<HTMLElement>(
                `[data-visual-block="${selectedId}"]`,
              );
              const box = element?.getBoundingClientRect();
              if (!box) return;
              setResize({
                id: selectedId,
                startX: event.clientX,
                startY: event.clientY,
                width: box.width,
                height: box.height,
                parentWidth:
                  element?.parentElement?.getBoundingClientRect().width ??
                  box.width,
              });
            }}
          >
            <Maximize2 size={13} />
          </button>
        </div>
      )}
    </>
  );
}
