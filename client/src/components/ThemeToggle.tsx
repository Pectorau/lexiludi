import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  if (!toggleTheme) return null;

  const isDark = theme === "dark";
  return (
    <button
      className="theme-toggle"
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Activer Feuille du jour" : "Activer Bureau de nuit"}
      aria-pressed={isDark}
      title={isDark ? "Feuille du jour" : "Bureau de nuit"}
    >
      {isDark ? <Sun size={15} /> : <Moon size={15} />}
      <span>{isDark ? "Feuille du jour" : "Bureau de nuit"}</span>
    </button>
  );
}
