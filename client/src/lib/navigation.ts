export type ChapterId = "home" | "quiz" | "motus" | "definitions" | "mixed" | "multiplayer" | "not-found";

export function getNavigationMeta(location: string): { chapter: ChapterId; label: string; title: string } {
  const pathname = location.split("?")[0] ?? "/";
  if (pathname === "/") return { chapter: "home", label: "Accueil", title: "LexiLudi — Atelier des mots" };
  if (pathname.startsWith("/quiz")) return { chapter: "quiz", label: "Quiz", title: "LexiLudi — Quiz" };
  if (pathname.startsWith("/motus")) return { chapter: "motus", label: "Motus", title: "LexiLudi — Motus" };
  if (pathname.startsWith("/definitions")) return { chapter: "definitions", label: "Mots liés", title: "LexiLudi — Mots liés" };
  if (pathname.startsWith("/jeu-du-jour")) return { chapter: "home", label: "Jeu du jour", title: "LexiLudi — Jeu du jour" };
  if (pathname.startsWith("/atelier-mixte")) return { chapter: "mixed", label: "Atelier Mixte", title: "LexiLudi — Atelier Mixte" };
  if (pathname.startsWith("/atelier")) return { chapter: "home", label: "Atelier visuel", title: "LexiLudi — Atelier visuel" };
  if (pathname.startsWith("/editor")) return { chapter: "home", label: "Éditeur de code", title: "LexiLudi — Éditeur de code" };
  if (pathname.startsWith("/multijoueur")) return { chapter: "multiplayer", label: "Salon multijoueur", title: "LexiLudi — Salon" };
  return { chapter: "not-found", label: "Page introuvable", title: "LexiLudi — Page introuvable" };
}

export function nextTabIndex(currentIndex: number, key: string, total: number) {
  if (key === "Home") return 0;
  if (key === "End") return total - 1;
  if (key === "ArrowRight" || key === "ArrowDown") return (currentIndex + 1) % total;
  if (key === "ArrowLeft" || key === "ArrowUp") return (currentIndex - 1 + total) % total;
  return currentIndex;
}
