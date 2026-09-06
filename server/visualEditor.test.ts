import { describe, expect, it } from "vitest";
import { migrateLegacyVisualEditorConfig, normalizeVisualEditorConfig, visualBlockStyle, visualEditorConfigSchema } from "../shared/visualEditor";
import { canEditVisualEditor } from "./visualEditor";

describe("éditeur visuel", () => {
  it("autorise le propriétaire même si son rôle n’a pas encore été élevé", () => {
    expect(canEditVisualEditor({ openId: "owner-1", role: "user" }, "owner-1")).toBe(true);
    expect(canEditVisualEditor({ openId: "guest-1", role: "user" }, "owner-1")).toBe(false);
  });

  it("retient uniquement les blocs autorisés sur la page éditée", () => {
    const config = normalizeVisualEditorConfig("home", {
      blocks: {
        "home.quiz": { text: "Quiz de vocabulaire", order: 2 },
        "motus.grid": { visible: false },
      },
    });

    expect(config.blocks).toEqual({ "home.quiz": { text: "Quiz de vocabulaire", order: 2 } });
  });

  it("empêche de masquer les zones indispensables à une partie", () => {
    const config = normalizeVisualEditorConfig("motus", { blocks: { "motus.grid": { visible: false, spacing: { marginTop: 12 } } } });
    expect(config.blocks["motus.grid"]).toEqual({ visible: undefined, spacing: { marginTop: 12 } });
  });

  it("traduit seulement les paramètres d’espacement et d’ordre validés", () => {
    expect(visualBlockStyle({ order: 1, align: "center", spacing: { marginTop: 24, padding: 12 }, layout: { x: 16, y: -8, width: 75 } })).toEqual({ order: 1, textAlign: "center", marginTop: 24, padding: 12, transform: "translate(16px, -8px)", width: "75%" });
  });

  it("conserve les réglages d’apparence validés", () => {
    expect(normalizeVisualEditorConfig("home", { blocks: { "home.quiz": { appearance: { backgroundColor: "#112233", textColor: "#ffffff", font: "mono", fontSize: 18 } } } }).blocks["home.quiz"]?.appearance).toEqual({ backgroundColor: "#112233", textColor: "#ffffff", font: "mono", fontSize: 18 });
  });

  it("conserve les plans, le verrouillage et les styles bornés de composition", () => {
    const block = normalizeVisualEditorConfig("home", { blocks: { "home.quiz": { locked: true, appearance: { opacity: 0.6, borderRadius: 12 }, layout: { zIndex: 8 }, spacing: { padding: 18 } } } }).blocks["home.quiz"];
    expect(block).toEqual({ locked: true, appearance: { opacity: 0.6, borderRadius: 12 }, layout: { zIndex: 8 }, spacing: { padding: 18 } });
    expect(visualBlockStyle(block)).toMatchObject({ zIndex: 8, opacity: 0.6, borderRadius: 12, padding: 18 });
  });

  it("convertit les hauteurs nulles d’un ancien brouillon au minimum contractuel sur les deux formats", () => {
    const config = visualEditorConfigSchema.parse({ blocks: { "home.copy": { responsive: { desktop: { height: 0 }, mobile: { height: 0 } } } } });
    expect(config.blocks["home.copy"]?.responsive).toEqual({ desktop: { height: 40 }, mobile: { height: 40 } });
  });

  it("adapte les blocs compatibles de l’ancien atelier Motus sans conserver les blocs obsolètes", () => {
    const migrated = migrateLegacyVisualEditorConfig("motus", { blocks: { "motusGame.title": { layout: { y: -88 } }, "motusGame.grid": { layout: { y: -96 } }, "motusGame.margin": { layout: { y: 0 } } } });
    expect(normalizeVisualEditorConfig("motus", migrated)).toEqual({ blocks: { "motus.heading": { layout: { y: -88 } }, "motus.grid": { layout: { y: -96 } } } });
  });
});
