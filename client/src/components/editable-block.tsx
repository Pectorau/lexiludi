import {
  useEffect,
  useRef,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  GRID_SIZE,
  snapToGrid,
  useVisualEditor,
} from "./visual-editor-context";
import "./editable-block.css";

export function EditableBlock({
  id,
  children,
  locked = false,
  defaultLayout = { x: 0, y: 0, width: 100, height: 0 },
}: {
  id: string;
  children: ReactNode;
  locked?: boolean;
  defaultLayout?: { x: number; y: number; width: number; height: number };
}) {
  const {
    isEditMode,
    isPreview,
    viewportMode,
    layouts,
    registerBlock,
    updateBlock,
    select,
    selectedIds,
  } = useVisualEditor();
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    startX: number;
    startY: number;
    x: number;
    y: number;
  } | null>(null);
  const resize = useRef<{
    startX: number;
    startY: number;
    width: number;
    height: number;
  } | null>(null);
  const block = layouts[id];
  const layout = block
    ? (block.responsive?.[viewportMode] ?? {
        x: block.x,
        y: block.y,
        width: block.width,
        height: block.height,
        hidden: block.style?.hidden,
      })
    : undefined;
  const selected = selectedIds.includes(id);
  const isLocked = locked || block?.locked;
  useEffect(() => {
    if (isEditMode && !layout) registerBlock(id, { ...defaultLayout, locked });
  }, [defaultLayout, id, isEditMode, layout, locked, registerBlock]);
  if (!isEditMode || layout?.hidden || block?.style?.hidden)
    return <>{children}</>;
  const style: CSSProperties = {
    transform: `translate(${layout?.x ?? 0}px,${layout?.y ?? 0}px)`,
    width: `${layout?.width ?? 100}%`,
    minHeight: layout?.height || undefined,
    zIndex: block?.style?.zIndex,
    opacity: block?.style?.opacity,
    padding: block?.style?.padding,
    borderRadius: block?.style?.borderRadius,
  };
  const down = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (isPreview || isLocked || !layout) return;
    event.preventDefault();
    event.stopPropagation();
    select(id, event.ctrlKey || event.metaKey);
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      startX: event.clientX,
      startY: event.clientY,
      x: layout.x,
      y: layout.y,
    };
  };
  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current)
      updateBlock(
        id,
        {
          x: snapToGrid(drag.current.x + event.clientX - drag.current.startX),
          y: snapToGrid(drag.current.y + event.clientY - drag.current.startY),
        },
        { moveGroup: true, pushHistory: false },
      );
    if (resize.current) {
      const parentWidth = Math.max(
        1,
        ref.current?.parentElement?.getBoundingClientRect().width ?? 1,
      );
      const width = Math.max(
        25,
        snapToGrid(
          resize.current.width +
            ((event.clientX - resize.current.startX) / parentWidth) * 100,
        ),
      );
      const height = Math.max(
        GRID_SIZE * 4,
        snapToGrid(
          resize.current.height + event.clientY - resize.current.startY,
        ),
      );
      updateBlock(id, { width, height }, { pushHistory: false });
    }
  };
  const up = (event: ReactPointerEvent<HTMLDivElement>) => {
    const changed = Boolean(drag.current || resize.current);
    drag.current = null;
    resize.current = null;
    if (changed) updateBlock(id, {}, { pushHistory: true });
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return (
    <div
      ref={ref}
      data-visual-block={id}
      className={[
        "editable-block",
        selected && "editable-block--selected",
        isLocked && "editable-block--locked",
      ]
        .filter(Boolean)
        .join(" ")}
      style={style}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
    >
      <div
        className={
          isPreview
            ? "editable-block__content"
            : "editable-block__content is-studio-locked"
        }
      >
        {children}
      </div>
      {!isLocked && (
        <button
          data-editor-ui
          type="button"
          className="editable-block__handle"
          aria-label="Redimensionner le bloc"
          onPointerDown={(event) => {
            event.stopPropagation();
            if (!layout) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            resize.current = {
              startX: event.clientX,
              startY: event.clientY,
              width: layout.width,
              height: layout.height,
            };
          }}
        />
      )}
    </div>
  );
}
