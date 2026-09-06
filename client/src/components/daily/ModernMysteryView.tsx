import { useRef, useState, type CSSProperties, type FormEvent } from "react";
import { Clock3, Lightbulb, Send, Sparkles } from "lucide-react";
import { MODERN_DAILY_MODES } from "@shared/dailyModes";

export type MysteryBoard = {
  runId: string;
  mode: "mystery";
  status: "active" | "won" | "lost" | "abandoned";
  score: number;
  elapsedSeconds: number;
  tokens: string[];
  revealedIndices: number[];
  grammaticalCategory: string | null;
  attempts: string[];
  intuitionEligible: boolean;
};

type AttemptResult = MysteryBoard & { valid: boolean; lemma?: string };

export function ModernMysteryView({
  board,
  pending,
  onRevealWord,
  onRevealGrammar,
  onAttempt,
  onFinished,
}: {
  board: MysteryBoard;
  pending: boolean;
  onRevealWord: (index: number) => Promise<MysteryBoard>;
  onRevealGrammar: () => Promise<MysteryBoard>;
  onAttempt: (word: string) => Promise<AttemptResult>;
  onFinished: (result: AttemptResult) => void;
}) {
  const [guess, setGuess] = useState("");
  const [notice, setNotice] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const revealed = new Set(board.revealedIndices);
  const scoreRatio = Math.min(
    1,
    board.score / MODERN_DAILY_MODES.mystery.initialScore,
  );
  const active = board.status === "active";

  async function reveal(index: number) {
    if (!active || pending || revealed.has(index)) return;
    try {
      await onRevealWord(index);
      setNotice(`Indice révélé : ${board.tokens[index]}.`);
      inputRef.current?.focus();
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Indice indisponible.",
      );
    }
  }

  async function revealGrammar() {
    if (!active || pending || board.grammaticalCategory) return;
    try {
      await onRevealGrammar();
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Indice indisponible.",
      );
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const word = guess.trim();
    if (!word || !active || pending) return;
    try {
      const result = await onAttempt(word);
      setGuess("");
      if (result.valid) {
        setNotice(`Mot trouvé : ${result.lemma ?? word}.`);
        onFinished(result);
      } else
        setNotice(
          "Ce n’est pas le mot recherché : la pénalité est calculée côté serveur.",
        );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "La proposition n’a pas pu être vérifiée.",
      );
    }
  }

  return (
    <section
      className="modern-daily modern-mystery"
      aria-label="Défi Mot Mystère"
    >
      <div className="modern-daily-status">
        <div>
          <span className="mini-label">Score d’intuition</span>
          <b>
            {board.score} <small>pts</small>
          </b>
          {board.intuitionEligible && (
            <em>
              <Sparkles size={13} /> Intuition préservée
            </em>
          )}
        </div>
        <div
          className="daily-score-ring"
          style={{ "--daily-score": `${scoreRatio * 100}%` } as CSSProperties}
        >
          <Clock3 size={17} />
          <span>{board.elapsedSeconds}s</span>
        </div>
      </div>
      <div className="modern-definition">
        <p className="mini-label">Définition à dévoiler</p>
        <p>
          {board.tokens.map((token, index) => (
            <button
              key={`${index}-${token}`}
              type="button"
              className={revealed.has(index) ? "is-revealed" : ""}
              disabled={!active || pending || revealed.has(index)}
              onClick={() => void reveal(index)}
              aria-label={
                revealed.has(index)
                  ? `Mot révélé : ${token}`
                  : `Révéler un mot, coût ${MODERN_DAILY_MODES.mystery.manualRevealCost} points`
              }
            >
              {revealed.has(index) ? token : "···"}
            </button>
          ))}
        </p>
        <small>
          La révélation automatique et le score sont calculés par le serveur.
        </small>
      </div>
      <div className="modern-daily-hints">
        <button
          type="button"
          disabled={!active || pending || Boolean(board.grammaticalCategory)}
          onClick={() => void revealGrammar()}
        >
          <Lightbulb size={14} /> Catégorie grammaticale · −50 pts
        </button>
        {board.grammaticalCategory && (
          <p>
            Catégorie grammaticale : <b>{board.grammaticalCategory}</b>
          </p>
        )}
      </div>
      {board.attempts.length > 0 && (
        <div className="modern-attempt-history">
          <p className="mini-label">Tentatives</p>
          {board.attempts.map((attempt, index) => (
            <span key={`${attempt}-${index}`}>
              {attempt.toLocaleUpperCase("fr-FR")}
            </span>
          ))}
        </div>
      )}
      {active && (
        <form
          className="modern-daily-form"
          onSubmit={(event) => void submit(event)}
        >
          <label htmlFor="mystery-answer">Votre intuition</label>
          <div>
            <input
              ref={inputRef}
              id="mystery-answer"
              value={guess}
              onChange={(event) =>
                setGuess(event.target.value.toLocaleUpperCase("fr-FR"))
              }
              placeholder="PROPOSER UN MOT…"
              autoComplete="off"
              spellCheck="false"
            />
            <button type="submit" disabled={!guess.trim() || pending}>
              {pending ? (
                "Vérification…"
              ) : (
                <>
                  <Send size={15} /> Tenter
                </>
              )}
            </button>
          </div>
        </form>
      )}
      {notice && (
        <p className="modern-daily-notice" role="status">
          {notice}
        </p>
      )}
    </section>
  );
}
