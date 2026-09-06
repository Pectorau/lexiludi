import { describe, expect, it } from "vitest";
import { buildVisualEditorPageCss, pageForVisualEditorPath } from "./visualEditorDom";

describe("éditeur direct", () => {
  it("associe les vraies routes aux surfaces éditables", () => {
    expect(pageForVisualEditorPath("/")).toBe("home");
    expect(pageForVisualEditorPath("/quiz")).toBe("quiz");
    expect(pageForVisualEditorPath("/motus")).toBe("motus");
    expect(pageForVisualEditorPath("/definitions")).toBe("definitions");
    expect(pageForVisualEditorPath("/multijoueur/8L4B22")).toBe("multiplayer");
    expect(pageForVisualEditorPath("/jeu-du-jour")).toBeNull();
  });

  it("produit des règles de déplacement et de dimensions pour les blocs réels", () => {
    const css = buildVisualEditorPageCss("multiplayer", {
      "multiplayer.activity": { layout: { x: 16, y: -8, width: 75, minHeight: 180 } },
    });
    expect(css).toContain(".player-activity");
    expect(css).toContain("translate(16px,-8px)");
    expect(css).toContain("width:75%");
    expect(css).toContain("min-height:180px");
  });

  it("produit les réglages d’apparence choisis dans l’éditeur", () => {
    const css = buildVisualEditorPageCss("home", {
      "home.quiz": { appearance: { backgroundColor: "#123456", textColor: "#ffffff", borderColor: "#345678", font: "mono", fontSize: 21 } },
    });
    expect(css).toContain("background-color:#123456");
    expect(css).toContain("color:#ffffff");
    expect(css).toContain("font-family:\"IBM Plex Mono\"");
    expect(css).toContain("font-size:21px");
  });

  it("produit une composition mobile distincte avec visibilité par format", () => {
    const css = buildVisualEditorPageCss("home", { "home.quiz": { responsive: { desktop: { x: 8, y: 0, width: 70, height: 160 }, mobile: { x: 0, y: 24, width: 100, height: 240, hidden: true } } } });
    expect(css).toContain("translate(8px,0px)");
    expect(css).toContain("@media(max-width:760px)");
    expect(css).toContain("display:none!important");
  });
});
