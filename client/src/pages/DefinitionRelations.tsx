import { Check, ExternalLink, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { semanticSources } from "@shared/semanticSources";
import { canValidateDefinitionChoice } from "@/lib/definitionInteraction";
import "./definition-match.css";

export type DefinitionRelationMode = "synonym" | "antonym" | "intruder";

type RelationBoard = {
  sessionId: string;
  status: "active" | "resolved" | "abandoned" | "expired";
  attempts: number;
  maxAttempts: number;
  score: number;
  kind: DefinitionRelationMode;
  prompt: string;
  sourceLemma: string;
  options: Array<{ entryId: number; lemma: string; cnrtlUrl: string }>;
  source: { name: string; license: string; url: string };
  answerEntryId?: number;
  explanation?: string | null;
};

const relationCopy: Record<
  DefinitionRelationMode,
  { label: string; heading: string; note: string }
> = {
  synonym: {
    label: "Synonymes",
    heading: "Cherchez la\n<proximité.>",
    note: "Les pistes restent dans le même voisinage lexical, sans reprendre une simple variante du mot.",
  },
  antonym: {
    label: "Antonymes",
    heading: "Trouvez le\n<contre-sens.>",
    note: "L’axe relie deux sens opposés : observez la nuance avant de choisir.",
  },
  intruder: {
    label: "Mot intrus",
    heading: "Repérez la\n<rupture.>",
    note: "Huit mots partagent une proximité : une étiquette reste volontairement hors du groupe.",
  },
};

export default function DefinitionRelations({
  mode,
}: {
  mode: DefinitionRelationMode;
}) {
  const start = trpc.solo.startRelation.useMutation();
  const submit = trpc.solo.submitRelation.useMutation();
  const [game, setGame] = useState<RelationBoard | null>(null);
  const [choice, setChoice] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [secondChanceEnabled, setSecondChanceEnabled] = useState(true);
  const [secondChanceUsed, setSecondChanceUsed] = useState(false);
  const [softMistake, setSoftMistake] = useState(false);
  const [herbariumNote, setHerbariumNote] = useState("");
  const [loadError, setLoadError] = useState("");

  async function newRound() {
    setChoice(null);
    setAnnouncement("");
    setSecondChanceUsed(false);
    setSoftMistake(false);
    setHerbariumNote("");
    setLoadError("");
    try {
      setGame((await start.mutateAsync({ variant: mode })) as RelationBoard);
    } catch (error) {
      setGame(null);
      setLoadError(
        error instanceof Error
          ? error.message
          : "Aucune relation adaptée n’est disponible pour le moment.",
      );
    }
  }

  useEffect(() => {
    void newRound();
  }, [mode]);

  const resolved = game?.status === "resolved";
  const correctOption =
    resolved && game?.answerEntryId
      ? game.options.find((option) => option.entryId === game.answerEntryId)
      : undefined;
  const isCorrect = Boolean(
    resolved && choice !== null && choice === game?.answerEntryId,
  );
  const pending = start.isPending || submit.isPending;
  const copy = relationCopy[mode];
  const heading = copy.heading.split("\n");

  async function validateChoice() {
    if (
      !game ||
      choice === null ||
      !canValidateDefinitionChoice(choice, Boolean(resolved))
    )
      return;
    try {
      const result = await submit.mutateAsync({
        sessionId: game.sessionId,
        entryId: choice,
        useSecondChance: secondChanceEnabled && !secondChanceUsed,
      });
      const next = result as RelationBoard & {
        valid: boolean;
        canRetry: boolean;
        discovery: { isNew: boolean; lemma?: string } | null;
      };
      setGame(next);
      if (next.valid) {
        setAnnouncement("Nuance juste confirmée par le serveur.");
        if (next.discovery?.isNew && next.discovery.lemma)
          setHerbariumNote(
            `« ${next.discovery.lemma} » a été gravé dans votre Herbier.`,
          );
      } else if (next.canRetry) {
        setSecondChanceUsed(true);
        setSoftMistake(true);
        setChoice(null);
        setAnnouncement(
          "Cette piste ne convient pas. Votre seconde chance est ouverte : choisissez une autre étiquette.",
        );
      } else {
        setAnnouncement(
          "Piste à revoir. La correction est maintenant affichée.",
        );
      }
    } catch (error) {
      setAnnouncement(
        error instanceof Error
          ? error.message
          : "La nuance n’a pas pu être vérifiée. Réessayez.",
      );
    }
  }

  if (!game && !loadError)
    return (
      <main className="motif-app is-playing">
        <section className="game-stage definition-stage">
          <div className="stage-logo">
            <span>m</span> motif.
          </div>
          <div className="stage-loading">Préparation des nuances…</div>
        </section>
      </main>
    );
  if (!game)
    return (
      <main className="motif-app is-playing">
        <section className="game-stage definition-stage">
          <Link className="back-control" href="/definitions">
            <span>Modes</span>
          </Link>
          <div className="stage-logo">
            <span>m</span> motif.
          </div>
          <div className="stage-error">
            <p>{loadError}</p>
            <button type="button" onClick={() => void newRound()}>
              Réessayer
            </button>
          </div>
        </section>
      </main>
    );

  return (
    <main className="motif-app is-playing">
      <section className="game-stage definition-stage">
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {announcement}
        </div>
        <Link className="back-control" href="/definitions">
          <span>Modes</span>
        </Link>
        <div className="stage-logo">
          <span>m</span> motif.
        </div>
        <div className={`definition-play relation-sheet ${mode}`}>
          <div className="definition-meta">
            <span>{copy.label}</span>
            <span>
              {mode === "intruder"
                ? "1 rupture à trouver"
                : mode === "synonym"
                  ? "1 proximité à trouver"
                  : "1 relation à trouver"}
            </span>
          </div>
          <p className="mini-label">Étude de nuance</p>
          <h1>
            {heading[0]}
            <br />
            <em>{heading[1]?.replace(/[<>]/g, "")}</em>
          </h1>
          <p className="relation-prompt">{game.prompt}</p>
          <p className="definition-intro">{copy.note}</p>
          {mode === "intruder" && (
            <p className="intruder-method-note">
              Série contrôlée : les huit rapprochements et la rupture sont issus
              de relations lexicales attribuées.
            </p>
          )}
          <details className="semantic-sources">
            <summary>Notes de préparation des futures variantes</summary>
            <aside
              className="semantic-variations"
              aria-label="Variantes sémantiques en préparation"
            >
              <div>
                <span>Prochaine feuille</span>
                <b>{semanticSources.intensity.label}</b>
                <p>
                  {semanticSources.intensity.description} La force du sens ne
                  sera activée qu’après import contrôlé des rangs.
                </p>
                <a
                  href={semanticSources.intensity.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Source {semanticSources.intensity.dataset}{" "}
                  <ExternalLink size={11} />
                </a>
              </div>
              <div>
                <span>Prochaine feuille</span>
                <b>{semanticSources.roots.label}</b>
                <p>
                  {semanticSources.roots.description} Les relations ne sont pas
                  confondues avec les sources Morphalou.
                </p>
                <a
                  href={semanticSources.roots.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Source {semanticSources.roots.dataset}{" "}
                  <ExternalLink size={11} />
                </a>
              </div>
            </aside>
          </details>
          <div
            className={`relation-options solo-relation-options ${mode}`}
            role="radiogroup"
            aria-label={copy.label}
          >
            {game.options.map((option, index) => (
              <button
                key={option.entryId}
                type="button"
                role="radio"
                aria-checked={choice === option.entryId}
                disabled={Boolean(resolved) || pending}
                onClick={() => {
                  setChoice(option.entryId);
                  setAnnouncement(
                    `${option.lemma} est sélectionné. Validez la nuance ou choisissez une autre étiquette.`,
                  );
                }}
                className={`${choice === option.entryId ? "is-selected" : ""} ${resolved && option.entryId === game.answerEntryId ? "is-correct" : ""} ${resolved && choice === option.entryId && option.entryId !== game.answerEntryId ? "is-wrong" : ""}`}
              >
                <span>{String.fromCharCode(65 + index)}</span>
                <b>{option.lemma}</b>
                {!resolved && choice === option.entryId && (
                  <small>sélectionnée</small>
                )}
                {resolved && option.entryId === game.answerEntryId && (
                  <Check size={16} />
                )}
              </button>
            ))}
          </div>
          {!resolved && (
            <div className="relation-actions">
              <button
                type="button"
                className="refresh-game"
                disabled={
                  !canValidateDefinitionChoice(choice, false) || pending
                }
                onClick={() => void validateChoice()}
              >
                Valider la nuance <Check size={16} />
              </button>
              {choice !== null && (
                <button
                  type="button"
                  className="relation-cancel"
                  onClick={() => {
                    setChoice(null);
                    setAnnouncement("Sélection annulée.");
                  }}
                >
                  Annuler la sélection
                </button>
              )}
              <label className="second-chance-toggle">
                <input
                  type="checkbox"
                  checked={secondChanceEnabled}
                  disabled={secondChanceUsed || pending}
                  onChange={(event) =>
                    setSecondChanceEnabled(event.target.checked)
                  }
                />{" "}
                Une seconde chance
              </label>
              {softMistake && (
                <p className="relation-soft-mistake" role="status">
                  Rature douce : cette piste ne convient pas. Choisissez une
                  autre étiquette.
                </p>
              )}
            </div>
          )}
          {resolved && (
            <div
              className={`relation-result ${isCorrect ? "is-correct" : "is-wrong"}`}
              role="status"
            >
              <p>
                <b>{isCorrect ? "Nuance juste." : "Piste à revoir."}</b>{" "}
                {mode === "intruder"
                  ? (game.explanation ??
                    `« ${correctOption?.lemma} » rompt la série autour de « ${game.sourceLemma} ».`)
                  : isCorrect
                    ? `« ${game.options.find((option) => option.entryId === choice)?.lemma ?? "Cette étiquette"} » est la bonne relation pour « ${game.sourceLemma} ».`
                    : `La bonne étiquette était « ${correctOption?.lemma ?? "celle indiquée"} » : observez la relation de sens.`}
              </p>
              {herbariumNote && (
                <p className="herbarium-discovery-note">{herbariumNote}</p>
              )}
              {correctOption?.cnrtlUrl && (
                <a
                  className="cnrtl-term"
                  href={correctOption.cnrtlUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Approfondir au CNRTL <ExternalLink size={13} />
                </a>
              )}
            </div>
          )}
          <button
            className="refresh-game"
            type="button"
            disabled={pending}
            onClick={() => void newRound()}
          >
            Nouvelle nuance <RefreshCw size={16} />
          </button>
          <Link className="multiplayer-link" href="/definitions/multijoueur">
            <span>2–8</span> Jouer en salon
          </Link>
        </div>
      </section>
    </main>
  );
}
