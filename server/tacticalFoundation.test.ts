import { describe, expect, it } from "vitest";
import { getMultiplayerManaCap, multiplayerArchetypes } from "./multiplayerDb";

describe("socle tactique de mana", () => {
  it("répertorie les quatre archétypes et réserve la capacité étendue au Banquier", () => {
    expect(multiplayerArchetypes).toEqual(["cryptographer", "berserker", "banker", "necromancer"]);
    expect(getMultiplayerManaCap("banker")).toBe(120);
    expect(getMultiplayerManaCap("cryptographer")).toBe(100);
    expect(getMultiplayerManaCap("berserker")).toBe(100);
    expect(getMultiplayerManaCap("necromancer")).toBe(100);
  });
});
