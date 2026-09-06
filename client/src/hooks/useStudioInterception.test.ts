import { describe, expect, it } from "vitest";
import { shouldInterceptStudioAction } from "./useStudioInterception";

function target(matches: string[]) {
  return { closest: (selector: string) => matches.includes(selector) ? {} as Element : null };
}

describe("shouldInterceptStudioAction", () => {
  it("laisse les commandes de l’éditeur actives", () => {
    expect(shouldInterceptStudioAction(target(["[data-editor-ui]", "a,button,input,select,textarea,label"]))).toBe(false);
  });

  it("bloque les contrôles métier sous-jacents", () => {
    expect(shouldInterceptStudioAction(target(["a,button,input,select,textarea,label"]))).toBe(true);
  });

  it("ne bloque pas une surface de composition non interactive", () => {
    expect(shouldInterceptStudioAction(target([]))).toBe(false);
  });
});
