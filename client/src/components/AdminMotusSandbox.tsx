import { useState } from "react";
import { Eraser, Play, RotateCcw } from "lucide-react";
import {
  gradeSandboxMotus,
  normalizeSandboxWord,
  type SandboxMotusFeedback,
} from "@/lib/adminMotusSandbox";

type Attempt = { guess: string; feedback: SandboxMotusFeedback[] };

export default function AdminMotusSandbox() {
  const [target, setTarget] = useState("LECTURE");
  const [guess, setGuess] = useState("");
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const normalizedTarget = normalizeSandboxWord(target);
  const submit = () => {
    const normalizedGuess = normalizeSandboxWord(guess);
    const feedback = gradeSandboxMotus(normalizedTarget, normalizedGuess);
    if (!feedback) {
      setError(
        `Saisissez ${normalizedTarget.length || "un"} lettre${normalizedTarget.length > 1 ? "s" : ""} pour tester la grille.`,
      );
      return;
    }
    setAttempts((items) =>
      [...items, { guess: normalizedGuess, feedback }].slice(-6),
    );
    setGuess("");
    setError(null);
  };
  return (
    <section className="admin-sandbox">
      <header>
        <div>
          <p>Bac à sable</p>
          <h2>Test Motus local</h2>
        </div>
        <button
          type="button"
          onClick={() => {
            setAttempts([]);
            setGuess("");
            setError(null);
          }}
        >
          <RotateCcw size={14} />
          Réinitialiser
        </button>
      </header>
      <p>
        Ce test ne modifie aucun salon ni aucune partie : il permet seulement de
        vérifier la correction des lettres d’un mot français.
      </p>
      <div className="admin-sandbox-inputs">
        <label>
          Mot de référence
          <input
            value={target}
            onChange={(event) => {
              setTarget(normalizeSandboxWord(event.target.value).slice(0, 12));
              setAttempts([]);
            }}
            maxLength={12}
          />
        </label>
        <label>
          Essai
          <input
            value={guess}
            onChange={(event) =>
              setGuess(normalizeSandboxWord(event.target.value).slice(0, 12))
            }
            onKeyDown={(event) => {
              if (event.key === "Enter") submit();
            }}
            maxLength={12}
          />
        </label>
        <button type="button" onClick={submit}>
          <Play size={14} />
          Tester
        </button>
      </div>
      {error && (
        <p className="admin-sandbox-error">
          <Eraser size={14} />
          {error}
        </p>
      )}
      <div
        className="admin-sandbox-grid"
        aria-label="Résultats du bac à sable Motus"
      >
        {attempts.map((attempt, attemptIndex) => (
          <div
            className="admin-sandbox-row"
            key={`${attempt.guess}-${attemptIndex}`}
          >
            {attempt.guess.split("").map((letter, index) => (
              <span
                className={`is-${attempt.feedback[index]}`}
                key={`${letter}-${index}`}
              >
                {letter}
              </span>
            ))}
          </div>
        ))}
        {!attempts.length && (
          <p>
            Les essais apparaîtront ici avec la correction exacte, présente ou
            absente.
          </p>
        )}
      </div>
    </section>
  );
}
