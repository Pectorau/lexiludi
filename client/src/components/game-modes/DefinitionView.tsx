import { Check } from "lucide-react";

export interface DefinitionWord {
  entryId: number;
  lemma: string;
}
export interface DefinitionItem {
  definitionId: number;
  text: string;
}
export interface DefinitionViewProps {
  relationMode: boolean;
  relationVariant?: string;
  sourceLemma?: string;
  options: DefinitionWord[];
  words: DefinitionWord[];
  definitions: DefinitionItem[];
  matches: Map<number, number>;
  attemptedEntryIds: Set<number>;
  usedDefinitionIds: Set<number>;
  selectedEntryId: number | null;
  active: boolean;
  busy: boolean;
  hasSecondChance: boolean;
  submissionCount: number;
  relationAnswers: Array<{ payload: string; isCorrect: boolean }>;
  revealedAnswer?: string | null;
  onSelectEntry: (entryId: number) => void;
  onMatch: (entryId: number, definitionId: number) => void;
  onRelationAnswer: (entryId: number) => void;
}

export function DefinitionView({
  relationMode,
  relationVariant,
  sourceLemma,
  options,
  words,
  definitions,
  matches,
  attemptedEntryIds,
  usedDefinitionIds,
  selectedEntryId,
  active,
  busy,
  hasSecondChance,
  submissionCount,
  relationAnswers,
  revealedAnswer,
  onSelectEntry,
  onMatch,
  onRelationAnswer,
}: DefinitionViewProps) {
  if (relationMode)
    return (
      <div className="room-definition relation-round">
        <div className="motus-title">
          <div>
            <p className="mini-label">Choix partagé</p>
            <h1>
              {relationVariant === "intruder" ? (
                <>
                  Trouvez
                  <br />
                  <em>l’intrus.</em>
                </>
              ) : (
                <>
                  <i>{sourceLemma}</i> : quel
                  <br />
                  <em>
                    {relationVariant === "synonym" ? "synonyme" : "antonyme"} ?
                  </em>
                </>
              )}
            </h1>
          </div>
          <div className="word-length">
            <b>{options.length}</b>
            <span>mots</span>
          </div>
        </div>
        <p className="definition-intro">
          Les options trop proches de la même famille sont exclues. Choisissez
          une seule réponse.
        </p>
        <div
          className={`relation-options ${relationVariant === "intruder" ? "is-intruder" : ""}`}
        >
          {options.map((option, index) => {
            const own = relationAnswers.find((submission) => {
              try {
                return (
                  JSON.parse(submission.payload).entryId === option.entryId
                );
              } catch {
                return false;
              }
            });
            const disabled =
              (submissionCount > 0 &&
                !(
                  hasSecondChance &&
                  submissionCount === 1 &&
                  !relationAnswers[0]?.isCorrect
                )) ||
              !active ||
              busy;
            return (
              <button
                key={option.entryId}
                type="button"
                disabled={disabled}
                onClick={() => onRelationAnswer(option.entryId)}
                className={`${own?.isCorrect ? "is-correct" : own ? "is-wrong" : ""}`}
              >
                <span>{String.fromCharCode(65 + index)}</span>
                <b>{option.lemma}</b>
                {own?.isCorrect && <Check size={16} />}
              </button>
            );
          })}
        </div>
        {!active && revealedAnswer && (
          <p className="room-revealed-answer">
            La bonne réponse était <b>{revealedAnswer}</b>.
          </p>
        )}
      </div>
    );
  return (
    <div className="room-definition">
      <div className="motus-title">
        <div>
          <p className="mini-label">Mêmes indices pour tous</p>
          <h1>
            Reliez les
            <br />
            <em>bonnes idées.</em>
          </h1>
        </div>
        <div className="word-length">
          <b>{matches.size}</b>
          <span>/ {words.length}</span>
        </div>
      </div>
      <p className="definition-intro">
        Choisissez un mot puis son indice de sens. Votre grille reste
        personnelle, les points sont partagés.
      </p>
      <div className="definition-board">
        <div className="definition-column">
          <p className="mini-label">Mots</p>
          {words.map((word, index) => {
            const matched = matches.has(word.entryId);
            const attempted = attemptedEntryIds.has(word.entryId);
            return (
              <button
                key={word.entryId}
                type="button"
                disabled={attempted || !active || busy}
                onClick={() => onSelectEntry(word.entryId)}
                className={`match-word ${selectedEntryId === word.entryId ? "is-selected" : ""} ${matched ? "is-correct" : attempted ? "is-attempted" : ""}`}
              >
                <span>{String.fromCharCode(65 + index)}</span>
                <b>{word.lemma}</b>
                {matched ? (
                  <Check size={16} />
                ) : attempted ? (
                  <span aria-label="Essai enregistré">—</span>
                ) : null}
              </button>
            );
          })}
        </div>
        <div className="definition-column">
          <p className="mini-label">Indices de sens</p>
          {definitions.map((definition, index) => (
            <button
              key={definition.definitionId}
              type="button"
              disabled={
                usedDefinitionIds.has(definition.definitionId) ||
                !selectedEntryId ||
                !active ||
                busy
              }
              onClick={() => {
                if (selectedEntryId)
                  onMatch(selectedEntryId, definition.definitionId);
              }}
              className={`match-definition ${usedDefinitionIds.has(definition.definitionId) ? "is-used" : ""}`}
            >
              <span>{index + 1}</span>
              <b>{definition.text}</b>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
