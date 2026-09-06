import { describe, expect, it } from "vitest";
import { FOG_NOTICE_DURATION_MS, isFogSoundEnabled, toFogSoundPreference } from "./fogEffects";

describe("préférences de Brouillard", () => {
  it("active le son par défaut et respecte une désactivation persistée", () => {
    expect(isFogSoundEnabled(null)).toBe(true);
    expect(isFogSoundEnabled("on")).toBe(true);
    expect(isFogSoundEnabled("off")).toBe(false);
  });

  it("sérialise le réglage sonore et conserve une notification brève", () => {
    expect(toFogSoundPreference(true)).toBe("on");
    expect(toFogSoundPreference(false)).toBe("off");
    expect(FOG_NOTICE_DURATION_MS).toBe(3_500);
  });
});
