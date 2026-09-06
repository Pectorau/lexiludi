import { Check, ExternalLink } from "lucide-react";

export interface QuizViewProps {
  variant: string;
  lemma: string;
  statementCategory?: string;
  choices: string[];
  active: boolean;
  canAnswer: boolean;
  busy: boolean;
  latestAnswer?: { payload: string; isCorrect: boolean };
  revealedAnswer?: string | null;
  sourceCnrtlUrl?: string | null;
  onAnswer: (choice: string) => void;
}

export function QuizView({
  variant,
  lemma,
  statementCategory,
  choices,
  active,
  canAnswer,
  busy,
  latestAnswer,
  revealedAnswer,
  sourceCnrtlUrl,
  onAnswer,
}: QuizViewProps) {
  const isBinary = variant === "truefalse" || variant === "gender";
  const title =
    variant === "truefalse" ? (
      <>
        <i>{lemma}</i> est-il de
        <br />
        <em>
          catégorie {(statementCategory ?? "").toLocaleLowerCase("fr-FR")} ?
        </em>
      </>
    ) : variant === "gender" ? (
      <>
        <i>{lemma}</i> est
        <br />
        <em>masculin ou féminin ?</em>
      </>
    ) : (
      <>
        {lemma} <em>?</em>
      </>
    );
  return (
    <div className="room-quiz">
      <p className="mini-label">Même question pour tous</p>
      <h1>{title}</h1>
      <p className="quiz-question">
        {active
          ? canAnswer
            ? "Répondez : les scores apparaissent au prochain rafraîchissement."
            : "Utilisez Seconde chance après une erreur pour pouvoir répondre à nouveau."
          : `Réponse : ${revealedAnswer ?? "—"}.`}
      </p>
      <div className={`answer-list ${isBinary ? "binary-list" : ""}`}>
        {choices.map((choice, index) => (
          <button
            key={choice}
            type="button"
            disabled={!canAnswer || !active || busy}
            onClick={() => onAnswer(choice)}
            className={[
              "answer-choice",
              latestAnswer?.payload === choice && latestAnswer.isCorrect
                ? "is-correct"
                : "",
              latestAnswer?.payload === choice && !latestAnswer.isCorrect
                ? "is-wrong"
                : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <span>
              {variant === "truefalse"
                ? choice === "Vrai"
                  ? "✓"
                  : "×"
                : String.fromCharCode(65 + index)}
            </span>
            <b>{choice}</b>
            {latestAnswer?.payload === choice && latestAnswer.isCorrect && (
              <Check size={18} />
            )}
          </button>
        ))}
      </div>
      {!active && sourceCnrtlUrl && (
        <a
          className="cnrtl-term room-cnrtl"
          href={sourceCnrtlUrl}
          target="_blank"
          rel="noreferrer"
        >
          Consulter le terme au CNRTL <ExternalLink size={13} />
        </a>
      )}
    </div>
  );
}
