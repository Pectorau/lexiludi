import type { ReactNode } from "react";
import type { VisualEditorPage } from "../../../shared/visualEditor";
import { EditToolbar } from "./edit-toolbar";
import { ResponsiveEditorSidebar } from "./responsive-editor-sidebar";
import { VisualEditorProvider } from "./visual-editor-context";

/** Cadre unique utilisé par toutes les vraies pages ouvertes depuis l’atelier. */
export function VisualEditablePage({
  pageKey,
  children,
}: {
  pageKey: VisualEditorPage;
  children: ReactNode;
}) {
  return (
    <VisualEditorProvider pageKey={pageKey}>
      {children}
      <EditToolbar />
      <ResponsiveEditorSidebar />
    </VisualEditorProvider>
  );
}
