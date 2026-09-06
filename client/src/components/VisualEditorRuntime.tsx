import { useMemo } from "react";
import { useVisualPageConfig } from "@/hooks/useVisualPageConfig";
import { buildVisualEditorPageCss } from "@/lib/visualEditorDom";
import type { VisualEditorPage } from "../../../shared/visualEditor";

function PageStyles({ page }: { page: Exclude<VisualEditorPage, "home"> }) {
  const { config } = useVisualPageConfig(page);
  const css = useMemo(
    () => buildVisualEditorPageCss(page, config.blocks),
    [page, config.blocks],
  );
  return css ? <style data-visual-editor-page={page}>{css}</style> : null;
}

export default function VisualEditorRuntime() {
  return (
    <>
      <PageStyles page="quiz" />
      <PageStyles page="motus" />
      <PageStyles page="definitions" />
      <PageStyles page="multiplayer" />
    </>
  );
}
