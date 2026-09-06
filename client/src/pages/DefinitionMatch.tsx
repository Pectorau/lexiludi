import {
  ArrowLeft,
  Check,
  ExternalLink,
  Link2,
  RefreshCw,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import DefinitionRelations, {
  type DefinitionRelationMode,
} from "./DefinitionRelations";
import "./definition-match.css";

type DefinitionBoard = {
  sessionId: string;
  status: "active" | "resolved" | "abandoned" | "expired";
  score: number;
  words: Array<{
    entryId: number;
    lemma: string;
    cnrtlUrl: string;
    category: string | null;
  }>;
  definitions: Array<{ definitionId: number; text: string }>;
  source: { name: string; license: string; url: string };
  matches: Array<{ entryId: number; definitionId: number }>;
  failedEntryIds: number[];
  solutions?: Array<{
    entryId: number;
    definitionId: number;
    lemma: string;
    cnrtlUrl: string;
  }>;
};

export default function DefinitionMatch() {
  const requestedMode = new URLSearchParams(
    typeof window === "undefined" ? "" : window.location.search,
  ).get("mode");
  const relationMode: DefinitionRelationMode | null =
    requestedMode === "synonym" ||
    requestedMode === "antonym" ||
    requestedMode === "intruder"
      ? requestedMode
      : null;
  const start = trpc.solo.startDefinitionMatch.useMutation();
  const submit = trpc.solo.submitDefinitionMatch.useMutation();
  const [game, setGame] = useState<DefinitionBoard | null>(null);
  const [selectedEntryId, setSelectedEntryId] = useState<number | null>(null);
  const [lastWrong, setLastWrong] = useState<{
    entryId: number;
    definitionId: number;
  } | null>(null);
  const [notice, setNotice] = useState("");
  const [loadError, setLoadError] = useState("");

  async function newRound() {
    setSelectedEntryId(null);
    setLastWrong(null);
    setNotice("");
    setLoadError("");
    try {
      setGame((await start.mutateAsync()) as DefinitionBoard);
    } catch (error) {
      setGame(null);
      setLoadError(
        error instanceof Error
          ? error.message
          : "Les définitions ne sont pas disponibles pour le moment.",
      );
    }
  }

  useEffect(() => {
    if (!relationMode) void newRound();
  }, [relationMode]);
  if (relationMode) return <DefinitionRelations mode={relationMode} />;

  const matches = useMemo(
    () =>
      new Map(
        (game?.matches ?? []).map((match) => [
          match.entryId,
          match.definitionId,
        ]),
      ),
    [game],
  );
  const usedDefinitions = useMemo(() => new Set(matches.values()), [matches]);
  const failedWords = useMemo(
    () => new Set(game?.failedEntryIds ?? []),
    [game],
  );
  const resolved = game?.status === "resolved";
  const pending = start.isPending || submit.isPending;

  async function chooseDefinition(definitionId: number) {
    if (
      !game ||
      selectedEntryId === null ||
      matches.has(selectedEntryId) ||
      failedWords.has(selectedEntryId) ||
      usedDefinitions.has(definitionId)
    )
      return;
    try {
      const result = (await submit.mutateAsync({
        sessionId: game.sessionId,
        entryId: selectedEntryId,
        definitionId,
      })) as DefinitionBoard & { valid: boolean; canRetry: boolean };
      setGame(result);
      setLastWrong(
        result.valid ? null : { entryId: selectedEntryId, definitionId },
      );
      setNotice(
        result.valid
          ? "Lien validé par le serveur."
          : result.canRetry
            ? "Cette piste ne convient pas : une tentative reste disponible."
            : "Les deux tentatives de ce mot sont utilisées ; la correction sera révélée à la fin.",
      );
      setSelectedEntryId(null);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Le tracé n’a pas pu être vérifié.",
      );
      setSelectedEntryId(null);
    }
  }

  if (!game && !loadError)
    return (
      <main className="motif-app is-playing">
        <section className="game-stage definition-stage">
          <div className="stage-logo">
            <span>m</span> motif.
          </div>
          <div className="stage-loading">Préparation des définitions…</div>
        </section>
      </main>
    );
  if (!game)
    return (
      <main className="motif-app is-playing">
        <section className="game-stage definition-stage">
          <Link className="back-control" href="/definitions">
            <ArrowLeft size={17} />
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
        <Link className="back-control" href="/definitions">
          <ArrowLeft size={17} />
          <span>Modes</span>
        </Link>
        <div className="stage-logo">
          <span>m</span> motif.
        </div>
        <div className="definition-play association-sheet">
          <div className="definition-meta">
            <span>
              <Link2 size={14} /> Liaison
            </span>
            <span>
              {game.matches.length}/4 liens ·{" "}
              {resolved ? `${game.score} pts` : "4 à trouver"}
            </span>
          </div>
          <p className="mini-label">Un sens, un mot</p>
          <h1>
            Reliez les
            <br />
            <em>bonnes idées.</em>
          </h1>
          <p className="definition-intro">
            Choisissez un mot, puis l’indice de sens qui lui correspond. Les
            associations sont vérifiées côté serveur et la correction n’apparaît
            qu’une fois la fiche terminée.
          </p>
          <div className="definition-board">
            <div className="definition-column">
              <p className="mini-label">Étiquettes lexicales</p>
              {game.words.map((word, index) => {
                const linkedDefinitionId = matches.get(word.entryId);
                const failed = failedWords.has(word.entryId);
                const active = selectedEntryId === word.entryId;
                return (
                  <button
                    key={word.entryId}
                    type="button"
                    disabled={
                      Boolean(resolved) ||
                      Boolean(linkedDefinitionId) ||
                      failed ||
                      pending
                    }
                    onClick={() => {
                      setSelectedEntryId(word.entryId);
                      setNotice(
                        `${word.lemma} est sélectionné. Choisissez son indice de sens.`,
                      );
                    }}
                    className={`match-word ${active ? "is-selected" : ""} ${linkedDefinitionId ? "is-correct" : ""} ${failed ? "is-wrong" : ""}`}
                  >
                    <span>{String.fromCharCode(65 + index)}</span>
                    <b>{word.lemma}</b>
                    {word.category && (
                      <small className="lexical-domain">{word.category}</small>
                    )}
                    {linkedDefinitionId && <small>lié · ✓</small>}
                    {failed && <small>pistes épuisées</small>}
                    {linkedDefinitionId && <Check size={16} />}
                  </button>
                );
              })}
            </div>
            <div className="definition-column">
              <p className="mini-label">Indices de sens</p>
              {game.definitions.map((definition, index) => {
                const used = usedDefinitions.has(definition.definitionId);
                const wrong =
                  lastWrong?.definitionId === definition.definitionId;
                return (
                  <button
                    key={definition.definitionId}
                    type="button"
                    disabled={
                      Boolean(resolved) || !selectedEntryId || used || pending
                    }
                    onClick={() =>
                      void chooseDefinition(definition.definitionId)
                    }
                    className={`match-definition ${used ? "is-used" : ""} ${wrong ? "is-wrong" : ""}`}
                  >
                    <span>{index + 1}</span>
                    <b>{definition.text}</b>
                    {wrong && <X size={16} />}
                  </button>
                );
              })}
            </div>
          </div>
          <p
            className="definition-connector-announcement"
            role="status"
            aria-live="polite"
          >
            {notice}
          </p>
          {resolved ? (
            <div className="definition-result nuance-card">
              <div>
                <b>
                  {game.failedEntryIds.length
                    ? "Fiche corrigée."
                    : "Nuances mémorisées."}
                </b>
                <p>
                  {game.failedEntryIds.length
                    ? "Les associations restantes sont désormais affichées pour la révision."
                    : "Les quatre étiquettes sont reliées à leur sens."}
                </p>
              </div>
              <button
                className="refresh-game"
                type="button"
                onClick={() => void newRound()}
                disabled={pending}
              >
                <RefreshCw size={16} /> Nouvelle fiche
              </button>
            </div>
          ) : (
            <div className="definition-help">
              {selectedEntryId ? (
                <>
                  <span>
                    Étiquette choisie : sélectionnez son indice de sens.
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedEntryId(null);
                      setNotice("Sélection annulée.");
                    }}
                  >
                    Annuler
                  </button>
                </>
              ) : (
                "Choisissez une étiquette pour commencer."
              )}
            </div>
          )}
          {resolved && (
            <p className="definition-attribution">
              Définitions :{" "}
              <a href={game.source.url} target="_blank" rel="noreferrer">
                {game.source.name}
              </a>{" "}
              · {game.source.license}. Les liens CNRTL restent consultables
              après la correction.
            </p>
          )}
          {resolved && (
            <div className="definition-links">
              {game.solutions?.map((solution) => (
                <a
                  key={solution.entryId}
                  href={solution.cnrtlUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {solution.lemma} <ExternalLink size={12} />
                </a>
              ))}
            </div>
          )}
          <Link className="multiplayer-link" href="/definitions/multijoueur">
            <span>2–8</span> Jouer en salon
          </Link>
        </div>
      </section>
    </main>
  );
}
