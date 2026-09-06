import { Archive, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";

export default function SessionArchive() {
  const [location] = useLocation();
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const update = () => {
      const code = /^\/multijoueur\/([A-Z2-9]{6})/i
        .exec(location)?.[1]
        ?.toUpperCase();
      setVisible(
        Boolean(code && window.localStorage.getItem(`motif-room:${code}`)),
      );
    };
    update();
    window.addEventListener("motif-room-token", update);
    return () => window.removeEventListener("motif-room-token", update);
  }, [location]);

  if (!visible) return null;
  async function copyArchive() {
    const text = `motif. · archive de table\n${document.title}\n${window.location.href}`;
    try {
      await navigator.clipboard.writeText(text);
      setMessage("Lien de séance copié.");
    } catch {
      setMessage("Copiez l’adresse de cette feuille pour la conserver.");
    }
  }
  return (
    <aside className="session-archive" aria-label="Archive de séance">
      <button type="button" onClick={() => window.print()}>
        <Archive size={14} /> Imprimer la séance
      </button>
      <button type="button" onClick={() => void copyArchive()}>
        <Copy size={14} /> Copier l’archive
      </button>
      {message && <span role="status">{message}</span>}
    </aside>
  );
}
