export type SandboxMotusFeedback = "exact" | "present" | "absent";

export function normalizeSandboxWord(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleUpperCase("fr-FR")
    .replace(/[^A-Z]/g, "");
}

export function gradeSandboxMotus(targetInput: string, guessInput: string): SandboxMotusFeedback[] | null {
  const target = normalizeSandboxWord(targetInput);
  const guess = normalizeSandboxWord(guessInput);
  if (target.length < 3 || target.length > 12 || target.length !== guess.length) return null;
  const result: SandboxMotusFeedback[] = Array.from({ length: target.length }, () => "absent");
  const remaining = target.split("");
  guess.split("").forEach((letter, index) => {
    if (target[index] === letter) {
      result[index] = "exact";
      remaining[index] = "";
    }
  });
  guess.split("").forEach((letter, index) => {
    if (result[index] === "exact") return;
    const position = remaining.indexOf(letter);
    if (position >= 0) {
      result[index] = "present";
      remaining[position] = "";
    }
  });
  return result;
}
