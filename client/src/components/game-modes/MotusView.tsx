import { ExternalLink } from "lucide-react";
import type { RefObject } from "react";
import {
  MOTUS_KEYBOARD,
  normalizeGameWord,
  type MotusLetterState,
} from "@shared/motus";

export interface MotusGridCell {
  letter: string;
  state: MotusLetterState | null;
}
export interface MotusViewProps {
  length: number;
  cells: MotusGridCell[][];
  activeRowIndex: number;
  canType: boolean;
  guess: string;
  attempts: number;
  hasBonusAttempt: boolean;
  keyboardStates: Record<string, MotusLetterState>;
  inputRef: RefObject<HTMLInputElement | null>;
  resolved: boolean;
  revealedAnswer?: string | null;
  sourceCnrtlUrl?: string | null;
  feedback?: { kind: "error" | "success"; message: string } | null;
  onGuessChange: (value: string) => void;
  onAppend: (letter: string) => void;
  onErase: () => void;
  onClear: () => void;
  onSubmit: () => void;
}

export function MotusView({
  length,
  cells,
  activeRowIndex,
  canType,
  guess,
  attempts,
  hasBonusAttempt,
  keyboardStates,
  inputRef,
  resolved,
  revealedAnswer,
  sourceCnrtlUrl,
  feedback,
  onGuessChange,
  onAppend,
  onErase,
  onClear,
  onSubmit,
}: MotusViewProps) {
  return (
    <div className="room-motus">
      <div className="motus-title">
        <div>
          <p className="mini-label">Même mot pour tous</p>
          <h1>
            Faites parler
            <br />
            <em>les lettres.</em>
          </h1>
        </div>
        <div className="word-length">
          <b>{length}</b>
          <span>lettres</span>
        </div>
      </div>
      <div
        className={`motus-grid multiplayer-motus-grid ${feedback ? `is-${feedback.kind}` : ""}`}
        style={{ gridTemplateColumns: `repeat(${length}, minmax(32px, 48px))` }}
        aria-label={`Grille Motus de ${length} lettres`}
        onClick={() => inputRef.current?.focus()}
      >
        {cells.map((row, rowIndex) =>
          row.map((cell, index) => {
            const isTyping = canType && rowIndex === activeRowIndex;
            const letter =
              cell.letter ||
              (isTyping ? (normalizeGameWord(guess)[index] ?? "") : "");
            return (
              <span
                className={`motus-cell ${cell.state ? `state-${cell.state} is-revealed` : ""} ${isTyping ? "is-typing" : ""}`}
                aria-label={
                  letter
                    ? `${letter.toUpperCase()}${cell.state ? ` : ${cell.state === "exact" ? "bien placée" : cell.state === "present" ? "présente ailleurs" : "absente"}` : ""}`
                    : isTyping
                      ? "Ligne de saisie active"
                      : undefined
                }
                key={`${rowIndex}-${index}`}
              >
                {letter.toUpperCase()}
              </span>
            );
          }),
        )}
        {canType && (
          <input
            ref={inputRef}
            className="motus-grid-input"
            value={guess.toUpperCase()}
            onChange={(event) => onGuessChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onSubmit();
              }
            }}
            maxLength={length}
            aria-label={`Écrivez votre proposition dans la ligne active de ${length} lettres`}
          />
        )}
      </div>
      {feedback && (
        <p
          className={`motus-attempt-feedback is-${feedback.kind}`}
          role="status"
        >
          {feedback.message}
        </p>
      )}
      <p className="motus-help">
        Écrivez directement dans la ligne active · {attempts} essais{" "}
        {hasBonusAttempt ? "· 1 essai bonus disponible" : ""}
      </p>
      <div
        className="motus-feedback-guide"
        aria-label="Signification des couleurs Motus"
      >
        <span>
          <i className="state-exact" />✓ bien placée
        </span>
        <span>
          <i className="state-present" />↔ présente ailleurs
        </span>
        <span>
          <i className="state-absent" />× absente
        </span>
      </div>
      {canType && (
        <button className="motus-clear-all" type="button" onClick={onClear}>
          Effacer toutes les lettres
        </button>
      )}
      <div
        className="multiplayer-keyboard"
        aria-label="Clavier Motus interactif"
      >
        {MOTUS_KEYBOARD.map((letter) => (
          <button
            type="button"
            key={letter}
            onClick={() => onAppend(letter)}
            disabled={!canType}
            className={`multiplayer-key ${keyboardStates[letter.toLocaleLowerCase("fr-FR")] ? `key-${keyboardStates[letter.toLocaleLowerCase("fr-FR")]}` : ""}`}
          >
            {letter}
          </button>
        ))}
        <button
          className="multiplayer-key multiplayer-key-wide"
          type="button"
          onClick={onErase}
          disabled={!canType}
          aria-label="Effacer la dernière lettre"
        >
          ⌫
        </button>
        <button
          className="multiplayer-key multiplayer-key-wide multiplayer-key-enter"
          type="button"
          onClick={onSubmit}
          disabled={!canType}
          aria-label="Valider le mot proposé"
        >
          ↵
        </button>
      </div>
      {resolved && (
        <div className="motus-result">
          <p>
            Le mot était <b>{revealedAnswer}</b>.
          </p>
          {sourceCnrtlUrl && (
            <a
              className="cnrtl-term"
              href={sourceCnrtlUrl}
              target="_blank"
              rel="noreferrer"
            >
              CNRTL <ExternalLink size={13} />
            </a>
          )}
        </div>
      )}
    </div>
  );
}
