import { describe, expect, it } from "vitest";
import { addsExactlyOnePyramidLetter } from "./db";

describe("règle de la Pyramide quotidienne", () => {
  it("accepte un mot qui conserve les lettres précédentes et en ajoute une", () => {
    expect(addsExactlyOnePyramidLetter("car", "cran")).toBe(true);
    expect(addsExactlyOnePyramidLetter("cran", "ancre")).toBe(true);
  });

  it("refuse les mots qui retirent une lettre, en ajoutent plusieurs ou changent la base", () => {
    expect(addsExactlyOnePyramidLetter("vol", "sol")).toBe(false);
    expect(addsExactlyOnePyramidLetter("vol", "voiler")).toBe(false);
    expect(addsExactlyOnePyramidLetter("car", "part")).toBe(false);
    expect(addsExactlyOnePyramidLetter("cran", "crane")).toBe(false);
    expect(addsExactlyOnePyramidLetter("car", "car")).toBe(false);
  });
});
