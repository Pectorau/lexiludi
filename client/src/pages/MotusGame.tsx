import { ArrowLeft, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { motusModes, readMotusMode } from "@/lib/gameRoutes";
import {
  getMotusKeyboardStates,
  MOTUS_KEYBOARD,
  normalizeGameWord,
  type MotusLetterState,
} from "@shared/motus";
import "./motus-direct-grid.css";

type MotusRow = { guess: string; states: MotusLetterState[] };
type MotusRound = {
  sessionId: string;
  status: "active" | "resolved" | "abandoned" | "expired";
  length: number;
  maxAttempts: number;
  attempts: number;
  score: number;
  history: MotusRow[];
  source: { cnrtlUrl: string };
};
type MotusResult = MotusRound & { valid: boolean; answer?: string };

export default function MotusGame() {
  const [location] = useLocation();
  const modeId = readMotusMode(
    `${location}${typeof window !== "undefined" ? window.location.search : ""}`,
  );
  const mode = motusModes.find((item) => item.id === modeId) ?? motusModes[0]!;
  const [round, setRound] = useState<MotusRound | null>(null);
  const [guess, setGuess] = useState("");
  const [notice, setNotice] = useState("");
  const start = trpc.solo.startMotus.useMutation();
  const submit = trpc.solo.submitMotus.useMutation();
  const field = useRef<HTMLInputElement>(null);

  async function loadRound() {
    setRound(null);
    setGuess("");
    setNotice("");
    try {
      setRound(
        (await start.mutateAsync({
          minLength: mode.minLength,
          maxLength: mode.maxLength,
          maxAttempts: mode.attempts,
        })) as MotusRound,
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Impossible de charger une grille.",
      );
    }
  }
  useEffect(() => {
    void loadRound();
  }, [mode.id]);
  const history = round?.history ?? [];
  const resolvedAnswer = (round as MotusResult | null)?.answer;
  const won =
    round?.status === "resolved" &&
    Boolean(resolvedAnswer) &&
    history.at(-1)?.guess === resolvedAnswer;
  const lost = round?.status === "resolved" && !won;
  const keyboardStates = useMemo(
    () =>
      getMotusKeyboardStates(
        history.map((row) => ({ payload: row.guess, feedback: row.states })),
      ),
    [history],
  );
  const remaining = round ? Math.max(0, round.maxAttempts - round.attempts) : 0;

  async function submitGuess() {
    if (!round || round.status !== "active" || submit.isPending) return;
    const word = normalizeGameWord(guess);
    if (word.length !== round.length) {
      setNotice(`Mot incomplet : entrez ${round.length} lettres.`);
      return;
    }
    try {
      const response = (await submit.mutateAsync({
        sessionId: round.sessionId,
        word,
      })) as MotusResult;
      setRound(response);
      setGuess("");
      setNotice(
        response.valid
          ? "Mot trouvé."
          : response.status === "resolved"
            ? `Grille terminée : le mot était « ${response.answer ?? ""} ».`
            : "Proposition enregistrée.",
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "La proposition n’a pas pu être vérifiée.",
      );
    }
  }
  function append(letter: string) {
    if (!round || round.status !== "active") return;
    setGuess((value) =>
      normalizeGameWord(value).length >= round.length
        ? value
        : `${normalizeGameWord(value)}${letter.toLocaleLowerCase("fr-FR")}`,
    );
    field.current?.focus();
  }

  if (!round)
    return (
      <main className="motif-app is-playing">
        <section className="game-stage motus-stage">
          <Link className="back-control" href="/motus">
            <ArrowLeft size={17} />
            <span>Feuille de manche</span>
          </Link>
          <div className="stage-logo">
            <span>m</span> motif.
          </div>
          <div className="stage-loading" role="status">
            {notice || "Le mot arrive…"}
          </div>
        </section>
      </main>
    );
  return (
    <main className="motif-app is-playing">
      <section className="game-stage motus-stage">
        <Link className="back-control" href="/motus">
          <ArrowLeft size={17} />
          <span>Feuille de manche</span>
        </Link>
        <div className="stage-logo">
          <span>m</span> motif.
        </div>
        <div className="motus-play motus-sheet">
          <aside className="motus-margin">
            <p>Grille</p>
            <b>{round.maxAttempts}</b>
            <small>essais</small>
            <span>{mode.label}</span>
            <span>{round.score} pts</span>
          </aside>
          <div className="motus-sheet-content">
            <div className="play-meta">
              <span>Motus · {mode.label}</span>
              <span>
                {remaining} essai{remaining > 1 ? "s" : ""}
              </span>
            </div>
            <div className="motus-title">
              <div>
                <p className="mini-label">Trouvez le mot</p>
                <h1>
                  Faites parler
                  <br />
                  <em>les lettres.</em>
                </h1>
                <p className="motus-objective">
                  Chaque proposition est validée et corrigée par le serveur.
                </p>
              </div>
              <div className="word-length">
                <b>{round.length}</b>
                <span>lettres</span>
              </div>
            </div>
            <div
              className="motus-grid"
              style={{
                gridTemplateColumns: `repeat(${round.length}, minmax(32px, 48px))`,
              }}
              aria-label={`Grille Motus de ${round.length} lettres`}
            >
              {Array.from({ length: round.maxAttempts }, (_, rowIndex) => {
                const row = history[rowIndex];
                const typing =
                  round.status === "active" && rowIndex === history.length;
                return Array.from({ length: round.length }, (_, index) => {
                  const letter =
                    row?.guess[index] ??
                    (typing ? (normalizeGameWord(guess)[index] ?? "") : "");
                  return (
                    <span
                      key={`${rowIndex}-${index}`}
                      className={`motus-cell ${row ? `state-${row.states[index]} is-revealed` : ""} ${typing ? "is-typing" : ""}`}
                    >
                      {letter.toLocaleUpperCase("fr-FR")}
                    </span>
                  );
                });
              })}
              {round.status === "active" && (
                <input
                  ref={field}
                  className="motus-grid-input"
                  style={{ gridColumn: "1 / -1", gridRow: history.length + 1 }}
                  autoFocus
                  value={guess.toLocaleUpperCase("fr-FR")}
                  onChange={(event) => setGuess(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void submitGuess();
                    }
                  }}
                  maxLength={round.length}
                  disabled={submit.isPending}
                  aria-label={`Proposez un mot de ${round.length} lettres`}
                />
              )}
            </div>
            <section className="motus-used-letters">
              <p>Lettres essayées</p>
              <div>
                {Object.entries(keyboardStates).length ? (
                  Object.entries(keyboardStates)
                    .sort(([left], [right]) => left.localeCompare(right, "fr"))
                    .map(([letter, state]) => (
                      <span
                        className={`used-letter state-${state}`}
                        key={letter}
                      >
                        {letter.toUpperCase()}
                      </span>
                    ))
                ) : (
                  <small>Aucune lettre validée pour l’instant.</small>
                )}
              </div>
            </section>
            <div className="motus-entry-actions">
              <button
                className="motus-submit-inline"
                type="button"
                onClick={() => void submitGuess()}
                disabled={
                  round.status !== "active" ||
                  submit.isPending ||
                  normalizeGameWord(guess).length !== round.length
                }
              >
                Vérifier le mot
              </button>
              <button
                className="motus-clear-all"
                type="button"
                onClick={() => setGuess("")}
                disabled={round.status !== "active"}
              >
                Effacer
              </button>
            </div>
            <div className="keyboard" aria-label="Clavier Motus">
              {MOTUS_KEYBOARD.map((letter) => (
                <button
                  type="button"
                  onClick={() => append(letter)}
                  disabled={round.status !== "active" || submit.isPending}
                  className={`key ${keyboardStates[normalizeGameWord(letter)] ? `key-${keyboardStates[normalizeGameWord(letter)]}` : ""}`}
                  key={letter}
                >
                  {letter}
                </button>
              ))}
              <button
                className="key key-wide"
                type="button"
                onClick={() =>
                  setGuess((value) => normalizeGameWord(value).slice(0, -1))
                }
                disabled={round.status !== "active"}
              >
                ⌫
              </button>
              <button
                className="key key-wide key-enter"
                type="button"
                onClick={() => void submitGuess()}
                disabled={round.status !== "active"}
              >
                ↵
              </button>
            </div>
            {notice && (
              <p className="motus-message" role="status">
                {notice}
              </p>
            )}
            {(won || lost) && (
              <div
                className={`motus-result ${won ? "won" : "lost"}`}
                role="status"
              >
                <p>
                  {won
                    ? "Trouvé."
                    : `Le mot était ${resolvedAnswer?.toLocaleUpperCase("fr-FR") ?? ""}.`}
                </p>
                <button
                  className="refresh-game"
                  type="button"
                  onClick={() => void loadRound()}
                >
                  Nouvelle grille <RotateCcw size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
