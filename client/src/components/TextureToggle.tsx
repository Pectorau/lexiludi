import { EyeOff, Grid2X2 } from "lucide-react";
import { useEffect, useState } from "react";

export default function TextureToggle() {
  const [disabled, setDisabled] = useState(
    () =>
      typeof window !== "undefined" &&
      window.localStorage.getItem("motif-textures") === "off",
  );

  useEffect(() => {
    document.documentElement.classList.toggle("no-texture", disabled);
    window.localStorage.setItem("motif-textures", disabled ? "off" : "on");
  }, [disabled]);

  return (
    <button
      className="texture-toggle"
      type="button"
      onClick={() => setDisabled((value) => !value)}
      aria-pressed={disabled}
      title={
        disabled
          ? "Réactiver la texture de feuille"
          : "Réduire la texture de feuille"
      }
    >
      {disabled ? <EyeOff size={14} /> : <Grid2X2 size={14} />}
      <span>{disabled ? "Texture réduite" : "Texture"}</span>
    </button>
  );
}
