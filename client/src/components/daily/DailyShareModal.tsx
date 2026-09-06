import { useState } from "react";
import { Check, Copy, Share2, X } from "lucide-react";
import { shareDailyResult } from "@/lib/dailyShare";

interface DailyShareModalProps {
  open: boolean;
  modeName: string;
  date: string;
  score: number;
  jokerUsed: boolean;
  onClose: () => void;
}

export function DailyShareModal({
  open,
  modeName,
  date,
  score,
  jokerUsed,
  onClose,
}: DailyShareModalProps) {
  const [result, setResult] = useState<
    "idle" | "shared" | "copied" | "unavailable"
  >("idle");
  if (!open) return null;
  const mode = modeName.includes("Mystère")
    ? "mystery"
    : modeName.includes("Pyramide")
      ? "pyramid"
      : ("auction" as const);
  async function share() {
    const next = await shareDailyResult({
      mode,
      score,
      attemptsCount: 1,
      maxAttempts: 1,
      isSuccess: true,
    });
    setResult(next);
  }
  return (
    <div className="daily-share-backdrop" role="presentation">
      <section
        className="daily-share-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="daily-share-title"
      >
        <button
          className="daily-share-close"
          type="button"
          onClick={onClose}
          aria-label="Fermer le partage"
        >
          <X size={18} />
        </button>
        <p className="mini-label">Résultat du jour</p>
        <h2 id="daily-share-title">{modeName}</h2>
        <div className="daily-share-stats">
          <p>
            <span>Score</span>
            <b>{score} pts</b>
          </p>
          <p>
            <span>Date</span>
            <b>{date}</b>
          </p>
          <p>
            <span>Aide</span>
            <b>{jokerUsed ? "Utilisée" : "Non utilisée"}</b>
          </p>
        </div>
        <p className="daily-share-note">
          Le résultat partagé ne révèle jamais le mot du jour.
        </p>
        <button
          className="daily-share-copy"
          type="button"
          onClick={() => void share()}
        >
          {result === "shared" ? (
            <>
              <Check size={16} /> Partagé
            </>
          ) : result === "copied" ? (
            <>
              <Copy size={16} /> Copié
            </>
          ) : (
            <>
              <Share2 size={16} /> Partager le résultat
            </>
          )}
        </button>
        {result === "unavailable" && (
          <p className="daily-share-note">
            Le partage n’est pas disponible dans ce navigateur.
          </p>
        )}
      </section>
    </div>
  );
}
