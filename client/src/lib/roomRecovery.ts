export function getRoomRecoveryPath(mode: string | null | undefined) {
  if (mode === "motus") return "/motus/multijoueur";
  if (mode === "definition") return "/definitions/multijoueur";
  return "/quiz/multijoueur";
}
