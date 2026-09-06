import { describe, expect, it } from "vitest";
import { getMotusFeedback } from "./motusFeedback";

describe("retours Game Feel Motus", () => {
  it("réserve la séquence ascendante et l’haptique longue à une victoire", () => {
    expect(getMotusFeedback("win")).toEqual({ notes: [523, 659, 784], vibration: [12, 35, 20] });
    expect(getMotusFeedback("typing")).toEqual({ notes: [520], vibration: 4 });
  });

  it("différencie une piste utile d’un essai absent", () => {
    expect(getMotusFeedback("near").notes[0]).toBeGreaterThan(getMotusFeedback("miss").notes[0]);
    expect(getMotusFeedback("error").notes).toEqual([]);
  });
});
