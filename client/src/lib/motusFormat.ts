import { MOTUS_KEYBOARD, type MotusLetterState } from "@shared/motus";

export type MotusKeyboardLayout = "azerty" | "qwerty" | "bepo";

export const MOTUS_KEYBOARD_LAYOUTS: Record<MotusKeyboardLayout, readonly string[]> = {
  azerty: MOTUS_KEYBOARD,
  qwerty: ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P", "A", "S", "D", "F", "G", "H", "J", "K", "L", "Z", "X", "C", "V", "B", "N", "M"],
  bepo: ["B", "É", "P", "O", "È", "V", "D", "L", "J", "Z", "W", "A", "U", "I", "E", "C", "T", "S", "R", "N", "M", "Ç"],
};

export function canRevealMotusAnswer(remainingAttempts: number, won: boolean, lost: boolean) {
  return remainingAttempts <= 1 && !won && !lost;
}

export function shouldConfirmMotusRestart(rowCount: number, won: boolean, lost: boolean) {
  return rowCount > 0 && !won && !lost;
}

export function describeMotusAttempt(states: MotusLetterState[], remainingAttempts: number) {
  const exact = states.filter((state) => state === "exact").length;
  const present = states.filter((state) => state === "present").length;
  const absent = states.filter((state) => state === "absent").length;
  return `Proposition enregistrée : ${exact} lettre${exact > 1 ? "s" : ""} bien placée${exact > 1 ? "s" : ""}, ${present} présente${present > 1 ? "s" : ""} ailleurs, ${absent} absente${absent > 1 ? "s" : ""}. ${remainingAttempts} essais restants.`;
}
