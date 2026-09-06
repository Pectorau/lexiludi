import { describe, expect, it } from "vitest";
import { gradeSandboxMotus, normalizeSandboxWord } from "./adminMotusSandbox";

describe("bac à sable Motus administratif", () => {
  it("normalise les accents sans accepter les caractères non alphabétiques", () => {
    expect(normalizeSandboxWord("é-lan 2")).toBe("ELAN");
  });

  it("traite correctement les lettres répétées", () => {
    expect(gradeSandboxMotus("MOTUS", "MOMES")).toEqual(["exact", "exact", "absent", "absent", "exact"]);
  });

  it("refuse les essais dont la longueur diffère de celle du mot", () => {
    expect(gradeSandboxMotus("MOTUS", "MOT")).toBeNull();
  });
});
