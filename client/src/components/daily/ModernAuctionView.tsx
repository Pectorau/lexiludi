import { useState, type FormEvent } from "react";
import { Banknote, Eye, Lock, Send, TriangleAlert } from "lucide-react";

type AuctionClue = "vowel_count" | "pattern";
type AuctionStatus = "active" | "won" | "lost" | "abandoned" | "last_chance";
export type AuctionBoard = {
  runId: string;
  mode: "auction";
  budget: number;
  revealedPositions: Record<string, string>;
  boughtClues: AuctionClue[];
  attempts: Array<{ guess: string; isCorrect: boolean }>;
  maxAttempts: number;
  status: AuctionStatus;
  score: number;
  length: number;
  maxBuyablePositions: number;
  nextLetterCost: number;
  revealLimitReached: boolean;
  availableClues: { vowelCount: number | null; pattern: string | null };
  lemma?: string;
};

type AuctionResult = AuctionBoard & { valid: boolean; lemma?: string };

export function ModernAuctionView({
  board,
  pending,
  onBuyPosition,
  onBuyClue,
  onAttempt,
  onFinished,
}: {
  board: AuctionBoard;
  pending: boolean;
  onBuyPosition: (index: number) => Promise<AuctionBoard>;
  onBuyClue: (clue: AuctionClue) => Promise<AuctionBoard>;
  onAttempt: (word: string) => Promise<AuctionResult>;
  onFinished: (result: AuctionResult) => void;
}) {
  const [guess, setGuess] = useState("");
  const [notice, setNotice] = useState("");
  const interactive =
    board.status === "active" || board.status === "last_chance";
  const attemptsRemaining = Math.max(
    0,
    board.maxAttempts - board.attempts.length,
  );

  async function buyPosition(index: number) {
    try {
      await onBuyPosition(index);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Achat indisponible.");
    }
  }
  async function buyClue(clue: AuctionClue) {
    try {
      await onBuyClue(clue);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Indice indisponible.",
      );
    }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    const word = guess.trim();
    if (!word || !interactive || word.length !== board.length) return;
    try {
      const result = await onAttempt(word);
      setGuess("");
      if (result.status === "won" || result.status === "lost")
        onFinished(result);
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
      className="modern-daily modern-auction"
      aria-label="Défi Enchères de lettres"
    >
      <div className="modern-daily-status">
        <div>
          <span className="mini-label">Capital d’enchère</span>
          <b>
            <Banknote size={18} /> {board.budget} <small>PM</small>
          </b>
        </div>
        <p>
          Droit à l’erreur : <b>{attemptsRemaining}</b>
        </p>
      </div>
      {board.status === "last_chance" && (
        <p className="modern-bankrupt">
          <TriangleAlert size={15} /> Fonds épuisés : une dernière proposition,
          sans nouvel achat.
        </p>
      )}
      <div
        className="modern-auction-grid"
        aria-label="Positions à déverrouiller"
      >
        {Array.from({ length: board.length }, (_, index) => {
          const letter = board.revealedPositions[index];
          const allowed =
            interactive &&
            !pending &&
            !letter &&
            !board.revealLimitReached &&
            board.budget >= board.nextLetterCost;
          return (
            <button
              key={index}
              type="button"
              className={letter ? "is-revealed" : ""}
              disabled={!allowed}
              onClick={() => void buyPosition(index)}
              aria-label={
                letter
                  ? `Lettre ${index + 1} : ${letter}`
                  : board.revealLimitReached
                    ? "Quota de lettres atteint"
                    : `Acheter la position ${index + 1} pour ${board.nextLetterCost} PM`
              }
            >
              <span>
                {letter ??
                  (board.revealLimitReached ? (
                    <Lock size={14} />
                  ) : (
                    `#${index + 1}`
                  ))}
              </span>
              {!letter && !board.revealLimitReached && (
                <small>−{board.nextLetterCost}</small>
              )}
            </button>
          );
        })}
      </div>
      <p className="modern-auction-note">
        <Eye size={14} /> Lettres achetées :{" "}
        <b>
          {Object.keys(board.revealedPositions).length}/
          {board.maxBuyablePositions}
        </b>{" "}
        · prochain achat :{" "}
        <b>
          {board.revealLimitReached
            ? "quota atteint"
            : `${board.nextLetterCost} PM`}
        </b>
        .
      </p>
      <div className="modern-auction-clues" aria-label="Indices de déduction">
        <p className="mini-label">Indices logiques</p>
        <button
          type="button"
          disabled={
            !interactive ||
            pending ||
            board.boughtClues.includes("vowel_count") ||
            board.budget < 15
          }
          onClick={() => void buyClue("vowel_count")}
        >
          Voyelles{" "}
          <b>
            {board.boughtClues.includes("vowel_count")
              ? (board.availableClues.vowelCount ?? "?")
              : "−15 PM"}
          </b>
        </button>
        <button
          type="button"
          disabled={
            !interactive ||
            pending ||
            board.boughtClues.includes("pattern") ||
            board.budget < 20
          }
          onClick={() => void buyClue("pattern")}
        >
          Structure{" "}
          <b>
            {board.boughtClues.includes("pattern")
              ? (board.availableClues.pattern ?? "?")
              : "−20 PM"}
          </b>
        </button>
      </div>
      {board.attempts.length > 0 && (
        <div className="modern-attempt-history">
          <p className="mini-label">Essais précédents</p>
          {board.attempts.map((attempt, index) => (
            <span
              className={attempt.isCorrect ? "is-correct" : "is-failed"}
              key={`${attempt.guess}-${index}`}
            >
              {attempt.guess}
            </span>
          ))}
        </div>
      )}
      {interactive ? (
        <form
          className="modern-daily-form"
          onSubmit={(event) => void submit(event)}
        >
          <label htmlFor="auction-answer">Mot de {board.length} lettres</label>
          <div>
            <input
              id="auction-answer"
              maxLength={board.length}
              value={guess}
              onChange={(event) =>
                setGuess(event.target.value.toLocaleUpperCase("fr-FR"))
              }
              placeholder="PROPOSER UN MOT…"
              autoComplete="off"
              spellCheck="false"
            />
            <button
              type="submit"
              disabled={pending || guess.trim().length !== board.length}
            >
              <Send size={15} /> Tenter
            </button>
          </div>
        </form>
      ) : (
        <p
          className={`modern-auction-finish ${board.status === "won" ? "is-won" : "is-lost"}`}
        >
          {board.status === "won" ? "Mot trouvé." : "Manche terminée."}
          {board.lemma
            ? ` La réponse était « ${board.lemma.toUpperCase()} ».`
            : ""}
        </p>
      )}
      {notice && (
        <p className="modern-daily-notice" role="status">
          {notice}
        </p>
      )}
    </section>
  );
}
