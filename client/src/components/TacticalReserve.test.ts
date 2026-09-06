import { describe, expect, it } from "vitest";
import { TACTICAL_CARDS } from "./TacticalReserve";

describe("configuration du deck tactique", () => {
  it("répertorie chaque joker utilisable avec une catégorie et un niveau", () => {
    expect(Object.keys(TACTICAL_CARDS)).toHaveLength(14);
    expect(TACTICAL_CARDS.fog).toMatchObject({ category: "attack", cost: 2, targeted: true });
    expect(TACTICAL_CARDS.shield).toMatchObject({ category: "defense", cost: 1, targeted: false });
    expect(TACTICAL_CARDS.exact_letter).toMatchObject({ category: "utility", cost: 3, targeted: false });
    expect(TACTICAL_CARDS.mana_siphon).toMatchObject({ category: "attack", cost: 2, targeted: true });
    expect(TACTICAL_CARDS.blackout).toMatchObject({ category: "attack", cost: 3, targeted: true });
    expect(TACTICAL_CARDS.overclock).toMatchObject({ category: "utility", cost: 2, targeted: false });
    expect(TACTICAL_CARDS.exact_letter).toMatchObject({ requiresSelectedLetter: true });
  });
});
