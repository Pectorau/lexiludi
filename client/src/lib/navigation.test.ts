import { describe, expect, it } from "vitest";
import { getNavigationMeta, nextTabIndex } from "./navigation";

describe("navigation globale", () => {
  it("associe chaque famille de route à un chapitre et un titre cohérents", () => {
    expect(getNavigationMeta("/quiz/jouer?mode=gender")).toMatchObject({ chapter: "quiz", label: "Quiz" });
    expect(getNavigationMeta("/definitions/multijoueur")).toMatchObject({ chapter: "definitions", label: "Mots liés" });
    expect(getNavigationMeta("/multijoueur/ABC123")).toMatchObject({ chapter: "multiplayer", label: "Salon multijoueur" });
    expect(getNavigationMeta("/editor")).toMatchObject({ chapter: "home", label: "Éditeur de code", title: "LexiLudi — Éditeur de code" });
  });

  it("fait circuler les onglets avec les flèches et les touches Home/End", () => {
    expect(nextTabIndex(0, "ArrowLeft", 3)).toBe(2);
    expect(nextTabIndex(2, "ArrowRight", 3)).toBe(0);
    expect(nextTabIndex(1, "Home", 3)).toBe(0);
    expect(nextTabIndex(1, "End", 3)).toBe(2);
  });
});
