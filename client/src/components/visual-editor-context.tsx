import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useStudioInterception } from "@/hooks/useStudioInterception";
import type {
  VisualEditorConfig,
  VisualEditorPage,
} from "../../../shared/visualEditor";

export const GRID_SIZE = 8;
export type AlignType =
  "left" | "center" | "right" | "top" | "middle" | "bottom";
export type DistributeType = "horizontal" | "vertical";
export type ViewportMode = "desktop" | "mobile";
export interface ResponsiveLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  hidden?: boolean;
}
export interface BlockStyle {
  zIndex?: number;
  opacity?: number;
  padding?: number;
  borderRadius?: number;
  hidden?: boolean;
}
export interface BlockLayout {
  id: string;
  name?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  responsive?: { desktop: ResponsiveLayout; mobile: ResponsiveLayout };
  groupId?: string;
  locked?: boolean;
  content?: string;
  style?: BlockStyle;
}
export type LayoutMap = Record<string, BlockLayout>;

interface VisualEditorContextValue {
  isEditMode: boolean;
  isPreview: boolean;
  viewportMode: ViewportMode;
  setViewportMode: Dispatch<SetStateAction<ViewportMode>>;
  layouts: LayoutMap;
  selectedIds: string[];
  hasClipboard: boolean;
  isSaving: boolean;
  isDirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
  registerBlock: (id: string, defaults: Omit<BlockLayout, "id">) => void;
  updateBlock: (
    id: string,
    patch: Partial<Omit<BlockLayout, "id">>,
    opts?: { moveGroup?: boolean; pushHistory?: boolean },
  ) => void;
  updateActiveLayout: (id: string, patch: Partial<ResponsiveLayout>) => void;
  updateBatch: (
    updater: (previous: LayoutMap) => LayoutMap,
    pushHistory?: boolean,
  ) => void;
  select: (id: string, additive: boolean) => void;
  clearSelection: () => void;
  groupSelected: () => void;
  splitSelectedGroup: () => void;
  copySelected: () => void;
  pasteToSelected: () => void;
  undo: () => void;
  redo: () => void;
  saveNow: () => Promise<void>;
  setIsPreview: Dispatch<SetStateAction<boolean>>;
  toggleLock: (id?: string) => void;
  bringToFront: () => void;
  sendToBack: () => void;
  alignSelected: (type: AlignType) => void;
  distributeSelected: (type: DistributeType) => void;
  nudge: (dx: number, dy: number) => void;
}

const VisualEditorContext = createContext<VisualEditorContextValue | null>(
  null,
);
const snapshot = (layouts: LayoutMap) =>
  JSON.parse(JSON.stringify(layouts)) as LayoutMap;
export const snapToGrid = (value: number, step = GRID_SIZE) =>
  Math.round(value / step) * step;
function configToLayouts(config: VisualEditorConfig): LayoutMap {
  return Object.fromEntries(
    Object.entries(config.blocks).map(([id, block]) => {
      const desktop: ResponsiveLayout = {
        x: block.responsive?.desktop?.x ?? block.layout?.x ?? 0,
        y: block.responsive?.desktop?.y ?? block.layout?.y ?? 0,
        width: block.responsive?.desktop?.width ?? block.layout?.width ?? 100,
        height:
          block.responsive?.desktop?.height ?? block.layout?.minHeight ?? 0,
        hidden: block.responsive?.desktop?.hidden ?? block.visible === false,
      };
      const mobile: ResponsiveLayout = {
        x: block.responsive?.mobile?.x ?? desktop.x,
        y: block.responsive?.mobile?.y ?? desktop.y,
        width: block.responsive?.mobile?.width ?? desktop.width,
        height: block.responsive?.mobile?.height ?? desktop.height,
        hidden: block.responsive?.mobile?.hidden ?? false,
      };
      return [
        id,
        {
          id,
          ...desktop,
          responsive: { desktop, mobile },
          groupId: block.group,
          locked: block.locked,
          content: block.text,
          style: {
            zIndex: block.layout?.zIndex,
            opacity: block.appearance?.opacity,
            padding: block.spacing?.padding,
            borderRadius: block.appearance?.borderRadius,
            hidden: desktop.hidden,
          },
        },
      ];
    }),
  ) as LayoutMap;
}
function layoutsToConfig(
  layouts: LayoutMap,
  base: VisualEditorConfig,
): VisualEditorConfig {
  return {
    blocks: {
      ...base.blocks,
      ...Object.fromEntries(
        Object.values(layouts).map((block) => {
          const current = base.blocks[block.id];
          const desktop: ResponsiveLayout = block.responsive?.desktop ?? {
            x: block.x,
            y: block.y,
            width: block.width,
            height: block.height,
            hidden: block.style?.hidden,
          };
          const mobile: ResponsiveLayout = block.responsive?.mobile ?? desktop;
          return [
            block.id,
            {
              ...current,
              visible: desktop.hidden ? false : undefined,
              locked: block.locked || undefined,
              group: block.groupId,
              text: block.content ?? current?.text,
              spacing: { ...current?.spacing, padding: block.style?.padding },
              appearance: {
                ...current?.appearance,
                opacity: block.style?.opacity,
                borderRadius: block.style?.borderRadius,
              },
              layout: {
                ...current?.layout,
                x: desktop.x,
                y: desktop.y,
                width: desktop.width,
                minHeight: desktop.height || undefined,
                zIndex: block.style?.zIndex,
              },
              responsive: { desktop, mobile },
            },
          ];
        }),
      ),
    },
  };
}

export function VisualEditorProvider({
  pageKey,
  children,
}: {
  pageKey: VisualEditorPage;
  children: ReactNode;
}) {
  const access = trpc.visualEditor.access.useQuery();
  const [location] = useLocation();
  const isEditMode = useMemo(() => {
    const search =
      typeof window === "undefined"
        ? (location.split("?")[1] ?? "")
        : window.location.search;
    return (
      new URLSearchParams(search).get("edit") === "1" &&
      access.data?.canEdit === true
    );
  }, [location, access.data?.canEdit]);
  const saved = trpc.visualEditor.draft.useQuery(
    { page: pageKey },
    { enabled: isEditMode, retry: false },
  );
  const save = trpc.visualEditor.saveDraft.useMutation();
  const [layouts, setLayouts] = useState<LayoutMap>({});
  const layoutsRef = useRef(layouts);
  const baseConfigRef = useRef<VisualEditorConfig>({ blocks: {} });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isPreview, setIsPreview] = useState(false);
  const [viewportMode, setViewportMode] = useState<ViewportMode>("desktop");
  const [isDirty, setIsDirty] = useState(false);
  const [history, setHistory] = useState<LayoutMap[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const historyIndexRef = useRef(-1);
  const clipboardRef = useRef<Pick<
    BlockLayout,
    "width" | "height" | "style"
  > | null>(null);
  const [hasClipboard, setHasClipboard] = useState(false);
  useStudioInterception(isEditMode && !isPreview);
  useEffect(() => {
    layoutsRef.current = layouts;
  }, [layouts]);
  useEffect(() => {
    if (!saved.data) return;
    baseConfigRef.current = saved.data.config;
    const initial = configToLayouts(saved.data.config);
    setLayouts((previous) => ({ ...initial, ...previous }));
    setHistory([snapshot(initial)]);
    setHistoryIndex(0);
    historyIndexRef.current = 0;
    setIsDirty(false);
  }, [saved.data]);
  const pushHistory = useCallback((next: LayoutMap) => {
    setHistory((previous) => {
      const output = [
        ...previous.slice(0, historyIndexRef.current + 1),
        snapshot(next),
      ].slice(-60);
      historyIndexRef.current = output.length - 1;
      setHistoryIndex(historyIndexRef.current);
      return output;
    });
    setIsDirty(true);
  }, []);
  const updateBatch = useCallback(
    (updater: (previous: LayoutMap) => LayoutMap, push = true) => {
      setLayouts((previous) => {
        const next = updater(previous);
        if (next === previous) return previous;
        layoutsRef.current = next;
        if (push) pushHistory(next);
        else setIsDirty(true);
        return next;
      });
    },
    [pushHistory],
  );
  const registerBlock = useCallback(
    (id: string, defaults: Omit<BlockLayout, "id">) =>
      setLayouts((previous) =>
        previous[id]
          ? previous
          : {
              ...previous,
              [id]: {
                id,
                ...defaults,
                responsive: defaults.responsive ?? {
                  desktop: {
                    x: defaults.x,
                    y: defaults.y,
                    width: defaults.width,
                    height: defaults.height,
                  },
                  mobile: {
                    x: defaults.x,
                    y: defaults.y,
                    width: defaults.width,
                    height: defaults.height,
                  },
                },
              },
            },
      ),
    [],
  );
  const updateActiveLayout = useCallback(
    (id: string, patch: Partial<ResponsiveLayout>) =>
      updateBatch((previous) => {
        const block = previous[id];
        if (!block || block.locked) return previous;
        const current: ResponsiveLayout = block.responsive?.[viewportMode] ?? {
          x: block.x,
          y: block.y,
          width: block.width,
          height: block.height,
        };
        const active = { ...current, ...patch };
        return {
          ...previous,
          [id]: {
            ...block,
            ...(viewportMode === "desktop" ? active : {}),
            responsive: {
              ...(block.responsive ?? {
                desktop: {
                  x: block.x,
                  y: block.y,
                  width: block.width,
                  height: block.height,
                },
                mobile: {
                  x: block.x,
                  y: block.y,
                  width: block.width,
                  height: block.height,
                },
              }),
              [viewportMode]: active,
            },
          },
        };
      }),
    [updateBatch, viewportMode],
  );
  const updateBlock = useCallback(
    (
      id: string,
      patch: Partial<Omit<BlockLayout, "id">>,
      options?: { moveGroup?: boolean; pushHistory?: boolean },
    ) =>
      updateBatch((previous) => {
        const current = previous[id];
        if (!current || current.locked) return previous;
        const active: ResponsiveLayout = current.responsive?.[viewportMode] ?? {
          x: current.x,
          y: current.y,
          width: current.width,
          height: current.height,
          hidden: current.style?.hidden,
        };
        const layoutPatch = {
          x: patch.x ?? active.x,
          y: patch.y ?? active.y,
          width: patch.width ?? active.width,
          height: patch.height ?? active.height,
          hidden: patch.style?.hidden ?? active.hidden,
        };
        const nextCurrent = {
          ...current,
          ...patch,
          ...(viewportMode === "desktop" ? layoutPatch : {}),
          responsive: current.responsive
            ? { ...current.responsive, [viewportMode]: layoutPatch }
            : undefined,
        };
        const next: LayoutMap = { ...previous, [id]: nextCurrent };
        if (
          options?.moveGroup &&
          current.groupId &&
          (patch.x !== undefined || patch.y !== undefined)
        ) {
          const dx = layoutPatch.x - active.x;
          const dy = layoutPatch.y - active.y;
          Object.values(previous).forEach((block) => {
            if (
              block.groupId === current.groupId &&
              block.id !== id &&
              !block.locked
            ) {
              const other: ResponsiveLayout = block.responsive?.[
                viewportMode
              ] ?? {
                x: block.x,
                y: block.y,
                width: block.width,
                height: block.height,
                hidden: block.style?.hidden,
              };
              const moved = {
                ...other,
                x: snapToGrid(other.x + dx),
                y: snapToGrid(other.y + dy),
              };
              next[block.id] = {
                ...block,
                ...(viewportMode === "desktop" ? moved : {}),
                responsive: block.responsive
                  ? { ...block.responsive, [viewportMode]: moved }
                  : undefined,
              };
            }
          });
        }
        return next;
      }, options?.pushHistory ?? true),
    [updateBatch, viewportMode],
  );
  const select = useCallback(
    (id: string, additive: boolean) =>
      setSelectedIds((previous) =>
        additive
          ? previous.includes(id)
            ? previous.filter((item) => item !== id)
            : [...previous, id]
          : [id],
      ),
    [],
  );
  const clearSelection = useCallback(() => setSelectedIds([]), []);
  const groupSelected = useCallback(() => {
    if (selectedIds.length < 2) return;
    const groupId = crypto.randomUUID();
    updateBatch((previous) => {
      const next = { ...previous };
      selectedIds.forEach((id) => {
        if (next[id] && !next[id].locked) next[id] = { ...next[id], groupId };
      });
      return next;
    });
  }, [selectedIds, updateBatch]);
  const splitSelectedGroup = useCallback(
    () =>
      updateBatch((previous) => {
        const groups = new Set(
          selectedIds
            .map((id) => previous[id]?.groupId)
            .filter((group): group is string => Boolean(group)),
        );
        if (!groups.size) return previous;
        const next = { ...previous };
        Object.values(previous).forEach((block) => {
          if (block.groupId && groups.has(block.groupId)) {
            const { groupId: _removed, ...rest } = block;
            next[block.id] = rest;
          }
        });
        return next;
      }),
    [selectedIds, updateBatch],
  );
  const copySelected = useCallback(() => {
    const block = selectedIds[0]
      ? layoutsRef.current[selectedIds[0]]
      : undefined;
    if (!block) return;
    clipboardRef.current = {
      width: block.width,
      height: block.height,
      style: block.style,
    };
    setHasClipboard(true);
  }, [selectedIds]);
  const pasteToSelected = useCallback(() => {
    if (!clipboardRef.current) return;
    updateBatch((previous) => {
      const next = { ...previous };
      selectedIds.forEach((id) => {
        if (next[id] && !next[id].locked)
          next[id] = { ...next[id], ...clipboardRef.current! };
      });
      return next;
    });
  }, [selectedIds, updateBatch]);
  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    const nextIndex = historyIndexRef.current - 1;
    historyIndexRef.current = nextIndex;
    setHistoryIndex(nextIndex);
    setLayouts(snapshot(history[nextIndex]!));
    setIsDirty(true);
  }, [history]);
  const redo = useCallback(() => {
    if (historyIndexRef.current >= history.length - 1) return;
    const nextIndex = historyIndexRef.current + 1;
    historyIndexRef.current = nextIndex;
    setHistoryIndex(nextIndex);
    setLayouts(snapshot(history[nextIndex]!));
    setIsDirty(true);
  }, [history]);
  const saveNow = useCallback(async () => {
    const raw = layoutsToConfig(layoutsRef.current, baseConfigRef.current);
    const config: VisualEditorConfig = {
      blocks: Object.fromEntries(
        Object.entries(raw.blocks).map(([id, block]) => {
          const desktop = {
            ...block.responsive?.desktop,
            height: Math.max(
              40,
              block.responsive?.desktop?.height ??
                block.layout?.minHeight ??
                40,
            ),
          };
          const mobile = {
            ...block.responsive?.mobile,
            height: Math.max(
              40,
              block.responsive?.mobile?.height ?? desktop.height,
            ),
          };
          return [
            id,
            {
              ...block,
              layout: { ...block.layout, minHeight: desktop.height },
              responsive: { desktop, mobile },
            },
          ];
        }),
      ),
    };
    await save.mutateAsync({ page: pageKey, config });
    baseConfigRef.current = config;
    setIsDirty(false);
  }, [pageKey, save]);
  const toggleLock = useCallback(
    (target?: string) =>
      updateBatch((previous) => {
        const next = { ...previous };
        (target ? [target] : selectedIds).forEach((id) => {
          if (next[id]) next[id] = { ...next[id], locked: !next[id].locked };
        });
        return next;
      }),
    [selectedIds, updateBatch],
  );
  const bringToFront = useCallback(
    () =>
      updateBatch((previous) => {
        const max = Math.max(
          0,
          ...Object.values(previous).map((block) => block.style?.zIndex ?? 0),
        );
        const next = { ...previous };
        selectedIds.forEach((id) => {
          if (next[id])
            next[id] = {
              ...next[id],
              style: { ...next[id].style, zIndex: max + 1 },
            };
        });
        return next;
      }),
    [selectedIds, updateBatch],
  );
  const sendToBack = useCallback(
    () =>
      updateBatch((previous) => {
        const next = { ...previous };
        selectedIds.forEach((id) => {
          if (next[id])
            next[id] = { ...next[id], style: { ...next[id].style, zIndex: 0 } };
        });
        return next;
      }),
    [selectedIds, updateBatch],
  );
  const nudge = useCallback(
    (dx: number, dy: number) =>
      updateBatch((previous) => {
        const next = { ...previous };
        selectedIds.forEach((id) => {
          const block = next[id];
          if (block && !block.locked)
            next[id] = {
              ...block,
              x: snapToGrid(block.x + dx),
              y: snapToGrid(block.y + dy),
            };
        });
        return next;
      }),
    [selectedIds, updateBatch],
  );
  const alignSelected = useCallback(
    (type: AlignType) => {
      if (selectedIds.length < 2) return;
      updateBatch((previous) => {
        const blocks = selectedIds.map((id) => previous[id]).filter(Boolean);
        const next = { ...previous };
        const x =
          type === "left"
            ? Math.min(...blocks.map((block) => block.x))
            : type === "right"
              ? Math.max(...blocks.map((block) => block.x + block.width))
              : Math.round(
                  (Math.min(...blocks.map((block) => block.x)) +
                    Math.max(...blocks.map((block) => block.x + block.width))) /
                    2,
                );
        const y =
          type === "top"
            ? Math.min(...blocks.map((block) => block.y))
            : type === "bottom"
              ? Math.max(...blocks.map((block) => block.y + block.height))
              : Math.round(
                  (Math.min(...blocks.map((block) => block.y)) +
                    Math.max(
                      ...blocks.map((block) => block.y + block.height),
                    )) /
                    2,
                );
        blocks.forEach((block) => {
          if (block.locked) return;
          if (type === "left") next[block.id] = { ...block, x };
          if (type === "right")
            next[block.id] = { ...block, x: x - block.width };
          if (type === "center")
            next[block.id] = { ...block, x: x - Math.round(block.width / 2) };
          if (type === "top") next[block.id] = { ...block, y };
          if (type === "bottom")
            next[block.id] = { ...block, y: y - block.height };
          if (type === "middle")
            next[block.id] = { ...block, y: y - Math.round(block.height / 2) };
        });
        return next;
      });
    },
    [selectedIds, updateBatch],
  );
  const distributeSelected = useCallback(
    (type: DistributeType) => {
      if (selectedIds.length < 3) return;
      updateBatch((previous) => {
        const blocks = selectedIds
          .map((id) => previous[id])
          .filter(Boolean)
          .sort((a, b) => (type === "horizontal" ? a.x - b.x : a.y - b.y));
        const next = { ...previous };
        const first = blocks[0]!;
        const last = blocks[blocks.length - 1]!;
        const occupied = blocks.reduce(
          (sum, block) =>
            sum + (type === "horizontal" ? block.width : block.height),
          0,
        );
        const span =
          type === "horizontal"
            ? last.x + last.width - first.x
            : last.y + last.height - first.y;
        const gap = (span - occupied) / (blocks.length - 1);
        let cursor = type === "horizontal" ? first.x : first.y;
        blocks.forEach((block) => {
          if (!block.locked)
            next[block.id] =
              type === "horizontal"
                ? { ...block, x: Math.round(cursor) }
                : { ...block, y: Math.round(cursor) };
          cursor += (type === "horizontal" ? block.width : block.height) + gap;
        });
        return next;
      });
    },
    [selectedIds, updateBatch],
  );
  useEffect(() => {
    if (!isEditMode) return;
    const keydown = (event: KeyboardEvent) => {
      if (
        ["INPUT", "TEXTAREA", "SELECT"].includes(
          (event.target as HTMLElement).tagName,
        )
      )
        return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        event.shiftKey ? redo() : undo();
      } else if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "s"
      ) {
        event.preventDefault();
        void saveNow();
      } else if (event.key === "Tab") {
        event.preventDefault();
        setIsPreview((previous) => !previous);
      } else if (
        ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
      ) {
        event.preventDefault();
        const step = event.shiftKey ? GRID_SIZE : 1;
        if (event.key === "ArrowLeft") nudge(-step, 0);
        if (event.key === "ArrowRight") nudge(step, 0);
        if (event.key === "ArrowUp") nudge(0, -step);
        if (event.key === "ArrowDown") nudge(0, step);
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [isEditMode, nudge, redo, saveNow, undo]);
  return (
    <VisualEditorContext.Provider
      value={{
        isEditMode,
        isPreview,
        viewportMode,
        setViewportMode,
        layouts,
        selectedIds,
        hasClipboard,
        isSaving: save.isPending,
        isDirty,
        canUndo: historyIndex > 0,
        canRedo: historyIndex < history.length - 1,
        registerBlock,
        updateBlock,
        updateActiveLayout,
        updateBatch,
        select,
        clearSelection,
        groupSelected,
        splitSelectedGroup,
        copySelected,
        pasteToSelected,
        undo,
        redo,
        saveNow,
        setIsPreview,
        toggleLock,
        bringToFront,
        sendToBack,
        alignSelected,
        distributeSelected,
        nudge,
      }}
    >
      <div
        className={
          isEditMode && !isPreview ? "studio-viewport-locked" : undefined
        }
      >
        {children}
      </div>
    </VisualEditorContext.Provider>
  );
}
export function useVisualEditor() {
  const context = useContext(VisualEditorContext);
  if (!context)
    throw new Error(
      "useVisualEditor doit être utilisé dans un VisualEditorProvider",
    );
  return context;
}
