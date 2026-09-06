export const FOG_NOTICE_DURATION_MS = 3_500;

export function isFogSoundEnabled(storedPreference: string | null) {
  return storedPreference !== "off";
}

export function toFogSoundPreference(enabled: boolean) {
  return enabled ? "on" : "off";
}
