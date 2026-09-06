import {
  AlignCenter,
  AlignLeft,
  ClipboardPaste,
  Copy,
  Eye,
  Group,
  Layers,
  LockKeyhole,
  Redo2,
  Save,
  Scissors,
  SendToBack,
  Undo2,
} from "lucide-react";
import { useVisualEditor } from "./visual-editor-context";
import "./edit-toolbar.css";

export function EditToolbar() {
  const {
    isEditMode,
    isPreview,
    selectedIds,
    groupSelected,
    splitSelectedGroup,
    copySelected,
    pasteToSelected,
    hasClipboard,
    isSaving,
    isDirty,
    canUndo,
    canRedo,
    undo,
    redo,
    saveNow,
    setIsPreview,
    toggleLock,
    bringToFront,
    sendToBack,
    alignSelected,
  } = useVisualEditor();
  if (!isEditMode) return null;
  return (
    <div
      data-editor-ui
      className="edit-toolbar"
      role="toolbar"
      aria-label="Actions de composition"
    >
      <button
        type="button"
        onClick={() => setIsPreview((value) => !value)}
        className={isPreview ? "is-preview" : ""}
      >
        <Eye size={15} /> {isPreview ? "Éditer" : "Aperçu"}
      </button>
      <i />
      <button type="button" onClick={undo} disabled={!canUndo}>
        <Undo2 size={15} /> Annuler
      </button>
      <button type="button" onClick={redo} disabled={!canRedo}>
        <Redo2 size={15} /> Rétablir
      </button>
      {selectedIds.length > 0 && (
        <>
          <i />
          <button type="button" onClick={bringToFront}>
            <Layers size={15} /> Avant
          </button>
          <button type="button" onClick={sendToBack}>
            <SendToBack size={15} /> Arrière
          </button>
          <button type="button" onClick={() => toggleLock()}>
            <LockKeyhole size={15} /> Verrou
          </button>
        </>
      )}
      {selectedIds.length > 1 && (
        <>
          <button type="button" onClick={() => alignSelected("left")}>
            <AlignLeft size={15} /> Aligner
          </button>
          <button type="button" onClick={() => alignSelected("center")}>
            <AlignCenter size={15} /> Centrer
          </button>
        </>
      )}
      <i />
      <button
        type="button"
        onClick={groupSelected}
        disabled={selectedIds.length < 2}
      >
        <Group size={15} /> Grouper
      </button>
      <button
        type="button"
        onClick={splitSelectedGroup}
        disabled={!selectedIds.length}
      >
        <Scissors size={15} /> Scinder
      </button>
      <button
        type="button"
        onClick={copySelected}
        disabled={selectedIds.length !== 1}
      >
        <Copy size={15} /> Copier
      </button>
      <button
        type="button"
        onClick={pasteToSelected}
        disabled={!hasClipboard || !selectedIds.length}
      >
        <ClipboardPaste size={15} /> Coller
      </button>
      <button
        type="button"
        className={isDirty ? "is-dirty" : ""}
        onClick={() => void saveNow()}
        disabled={isSaving}
      >
        <Save size={15} />{" "}
        {isSaving ? "Enreg." : isDirty ? "Sauvegarder" : "Sauvegardé"}
      </button>
    </div>
  );
}
