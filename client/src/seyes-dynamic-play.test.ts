import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dynamicLayer = readFileSync(new URL("./seyes-dynamic-play.css", import.meta.url), "utf8");
const entrypoint = readFileSync(new URL("./main.tsx", import.meta.url), "utf8");

describe("couche Seyès dynamique", () => {
  it("est chargée après les couches de jeu existantes", () => {
    expect(entrypoint.indexOf('import "./game-seyes-surfaces.css";')).toBeGreaterThanOrEqual(0);
    expect(entrypoint.indexOf('import "./seyes-dynamic-play.css";')).toBeGreaterThan(
      entrypoint.indexOf('import "./game-seyes-surfaces.css";'),
    );
  });

  it("couvre les trois scènes solo, les entrées de table et les vues partagées", () => {
    [
      ".quiz-play",
      ".motus-play",
      ".definition-play",
      ".multiplayer-access-page",
      ".multiplayer-setup",
      ".room-stage .room-side",
      ".room-main > .room-lobby",
      ".lobby-table-felt",
      ".lobby-seat.is-viewer",
      ".host-governance",
    ].forEach((selector) => expect(dynamicLayer).toContain(selector));
  });

  it("préserve un chemin sans animation non essentielle", () => {
    expect(dynamicLayer).toContain("@media (prefers-reduced-motion: reduce)");
  });
});
