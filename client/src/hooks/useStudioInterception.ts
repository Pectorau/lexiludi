import { useEffect } from "react";

/**
 * Les contrôles marqués data-editor-ui restent actifs. Les contrôles métier
 * (liens, boutons, champs) sont bloqués pendant la composition.
 */
export function shouldInterceptStudioAction(target: Pick<Element, "closest"> | null) {
  if (target?.closest("[data-editor-ui]")) return false;
  return Boolean(target?.closest("a,button,input,select,textarea,label"));
}

export function useStudioInterception(isActive: boolean) {
  useEffect(() => {
    if (!isActive) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (shouldInterceptStudioAction(target)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    const handleSubmit = (event: SubmitEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest("[data-editor-ui]")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("click", handleClick, true);
    window.addEventListener("submit", handleSubmit, true);
    return () => {
      window.removeEventListener("click", handleClick, true);
      window.removeEventListener("submit", handleSubmit, true);
    };
  }, [isActive]);
}
