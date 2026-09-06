import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Play,
  RotateCcw,
  Share2,
  Sparkles,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { validateDailyAnswer } from "@/lib/dailyAnswerValidation";
import {
  ModernMysteryView,
  type MysteryBoard,
} from "@/components/daily/ModernMysteryView";
import {
  ModernAuctionView,
  type AuctionBoard,
} from "@/components/daily/ModernAuctionView";
import { DailyPyramidView } from "@/components/daily/DailyPyramidView";
import { DailyShareModal } from "@/components/daily/DailyShareModal";
import "./daily-game.css";
import "./daily-modern.css";
import "./daily-answer-validation.css";

type DailyModeId = "mystery" | "pyramid" | "auction";
type PyramidBoard = {
  runId: string;
  mode: "pyramid";
  status: "active" | "won" | "lost" | "abandoned";
  score: number;
  startWord: string;
  finalLength: number;
  words: string[];
};
type Board = MysteryBoard | AuctionBoard | PyramidBoard;
type DailyModeConfig = {
  id: DailyModeId;
  name: string;
  kicker: string;
  goal: string;
  rules: readonly string[];
  note: string;
};
const DAILY_MODES: readonly DailyModeConfig[] = [
  {
    id: "mystery",
    name: "Mot Mystère",
    kicker: "Définition évolutive",
    goal: "Devinez avant que la définition ne se découvre.",
    rules: [
      "Le serveur calcule le temps et le score.",
      "Un mot se révèle toutes les 3 secondes.",
      "Un voile coûte 25 points ; la catégorie grammaticale coûte 50 points.",
    ],
    note: "La réponse ne quitte jamais le serveur avant la résolution.",
  },
  {
    id: "pyramid",
    name: "Pyramide de Lettres",
    kicker: "3 → 8 lettres",
    goal: "Ajoutez une lettre et réorganisez le mot à chaque palier.",
    rules: [
      "Le mot de départ compte trois lettres.",
      "Chaque étape conserve toutes les lettres précédentes.",
      "Morphalou vérifie chaque proposition côté serveur.",
    ],
    note: "La progression et le score sont enregistrés par le serveur.",
  },
  {
    id: "auction",
    name: "Enchères de Lettres",
    kicker: "Budget et déduction",
    goal: "Achetez peu de positions et déduisez le mot avec des indices indirects.",
    rules: [
      "Le budget initial est de 100 PM.",
      "Les positions coûtent 20, puis 35, puis 45 PM.",
      "Le quota de 40 % est atteignable ; une erreur coûte 15 PM.",
    ],
    note: "Le mot ne quitte jamais le serveur.",
  },
];

function today() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const offset = Math.floor(
    (Date.parse(`${date}T00:00:00Z`) - Date.UTC(2026, 0, 1)) / 86_400_000,
  );
  return { date, index: Math.abs(offset) % DAILY_MODES.length };
}

export default function DailyGame({
  modeOverride,
}: {
  modeOverride?: DailyModeId;
}) {
  const { date, index } = useMemo(today, []);
  const mode = modeOverride
    ? (DAILY_MODES.find((item) => item.id === modeOverride) ?? DAILY_MODES[0]!)
    : DAILY_MODES[index]!;
  const scope = modeOverride ? ("practice" as const) : ("official" as const);
  const [runId, setRunId] = useState<string | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [answer, setAnswer] = useState("");
  const [message, setMessage] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const start = trpc.daily.start.useMutation();
  const state = trpc.daily.state.useQuery(
    { runId: runId ?? "invalid-run-id" },
    {
      enabled: Boolean(runId),
      refetchInterval:
        mode.id === "mystery" && board?.status === "active" ? 1_000 : false,
      retry: false,
    },
  );
  const revealMystery = trpc.daily.revealMystery.useMutation();
  const attemptMystery = trpc.daily.attemptMystery.useMutation();
  const attemptPyramid = trpc.daily.attemptPyramid.useMutation();
  const revealAuctionLetter = trpc.daily.revealAuctionLetter.useMutation();
  const revealAuctionClue = trpc.daily.revealAuctionClue.useMutation();
  const attemptAuction = trpc.daily.attemptAuction.useMutation();
  const pending =
    start.isPending ||
    revealMystery.isPending ||
    attemptMystery.isPending ||
    attemptPyramid.isPending ||
    revealAuctionLetter.isPending ||
    revealAuctionClue.isPending ||
    attemptAuction.isPending;

  async function startRun() {
    setMessage("");
    setAnswer("");
    setBoard(null);
    setRunId(null);
    try {
      const next = await start.mutateAsync({ mode: mode.id, scope });
      setRunId(next.runId);
      setBoard(next as Board);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Impossible de démarrer le défi.",
      );
    }
  }

  useEffect(() => {
    void startRun();
  }, [mode.id, scope]);
  useEffect(() => {
    if (state.data) setBoard(state.data as Board);
  }, [state.data]);

  async function refresh<T>(action: () => Promise<T>) {
    const next = await action();
    setBoard(next as unknown as Board);
    return next;
  }

  async function submitPyramid(event: FormEvent) {
    event.preventDefault();
    if (!board || board.mode !== "pyramid" || board.status !== "active") return;
    const validation = validateDailyAnswer("pyramid", answer);
    if (!validation.valid) {
      setMessage(validation.message);
      return;
    }
    try {
      const result = (await refresh(() =>
        attemptPyramid.mutateAsync({
          runId: board.runId,
          word: validation.answer,
        }),
      )) as { valid: boolean; solved?: boolean; reason?: string };
      setAnswer("");
      setMessage(
        result.valid
          ? result.solved
            ? "Pyramide complète."
            : "Palier validé : ajoutez une lettre et réorganisez-les toutes."
          : (result.reason ?? "Étape invalide."),
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "La vérification a échoué.",
      );
    }
  }

  const done =
    board !== null &&
    board.status !== "active" &&
    board.status !== "last_chance";
  const practiceHref = `/jeu-du-jour/${mode.id === "mystery" ? "mystere" : mode.id === "pyramid" ? "pyramide" : "encheres"}`;

  return (
    <main className="motif-app is-playing">
      <section className="game-stage daily-stage">
        <Link className="back-control" href="/">
          <ArrowLeft size={17} />
          <span>Retour aux jeux</span>
        </Link>
        <div className="stage-logo" aria-hidden="true">
          <span>m</span> motif.
        </div>
        <article className="daily-sheet">
          <header className="daily-header">
            <p className="daily-kicker">
              <CalendarDays size={15} />{" "}
              {scope === "practice"
                ? "Plateau d’entraînement"
                : `Défi quotidien · ${date}`}
            </p>
            <h1>{mode.name}</h1>
            <p className="daily-subtitle">{mode.kicker}</p>
          </header>
          <section className="daily-goal">
            <Sparkles size={18} />
            <div>
              <p className="mini-label">But de la manche</p>
              <b>{mode.goal}</b>
            </div>
          </section>
          <section className="daily-rules">
            <p className="mini-label">Règles</p>
            <ol>
              {mode.rules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ol>
            <small>{mode.note}</small>
          </section>
          {!board || start.isPending ? (
            <div className="daily-loading" role="status">
              <RotateCcw className="animate-spin" size={16} />
              <span>Chargement de la manche…</span>
            </div>
          ) : done ? (
            <section
              className="daily-completion"
              aria-labelledby="daily-completion-title"
            >
              <p className="mini-label">
                {scope === "practice"
                  ? "Entraînement terminé"
                  : "Défi du jour terminé"}
              </p>
              <h2 id="daily-completion-title">{board.score} points</h2>
              <p>
                {scope === "practice"
                  ? "Vous pouvez recommencer avec une session neuve."
                  : "Votre résultat officiel est enregistré par le serveur pour cette identité de jeu."}
              </p>
              <div className="daily-completion-actions">
                <button
                  type="button"
                  className="daily-share-trigger"
                  onClick={() => setShareOpen(true)}
                >
                  <Share2 size={16} /> Partager
                </button>
                {scope === "practice" ? (
                  <button
                    type="button"
                    className="daily-practice-restart"
                    onClick={() => void startRun()}
                  >
                    <RotateCcw size={16} /> Nouvel entraînement
                  </button>
                ) : (
                  <Link className="daily-practice-restart" href={practiceHref}>
                    <Play size={16} /> S’entraîner
                  </Link>
                )}
              </div>
            </section>
          ) : (
            <section
              className="daily-play"
              aria-label={`Plateau de jeu ${mode.name}`}
            >
              {board.mode === "mystery" && (
                <ModernMysteryView
                  board={board}
                  pending={pending}
                  onRevealWord={(wordIndex) =>
                    refresh(() =>
                      revealMystery.mutateAsync({
                        runId: board.runId,
                        action: "word",
                        index: wordIndex,
                      }),
                    ) as Promise<MysteryBoard>
                  }
                  onRevealGrammar={() =>
                    refresh(() =>
                      revealMystery.mutateAsync({
                        runId: board.runId,
                        action: "grammar",
                      }),
                    ) as Promise<MysteryBoard>
                  }
                  onAttempt={(word) =>
                    refresh(() =>
                      attemptMystery.mutateAsync({ runId: board.runId, word }),
                    ) as Promise<
                      MysteryBoard & { valid: boolean; lemma?: string }
                    >
                  }
                  onFinished={(result) =>
                    setMessage(
                      `Félicitations ! Le mot était « ${result.lemma ?? ""} ».`,
                    )
                  }
                />
              )}
              {board.mode === "pyramid" && (
                <>
                  <DailyPyramidView words={[board.startWord, ...board.words]} />
                  <form
                    className="daily-form"
                    onSubmit={(event) => void submitPyramid(event)}
                    noValidate
                  >
                    <label htmlFor="daily-answer">
                      Ajoutez une lettre et réorganisez le mot
                    </label>
                    <div className="daily-input-group">
                      <input
                        id="daily-answer"
                        type="text"
                        value={answer}
                        onChange={(event) => setAnswer(event.target.value)}
                        disabled={pending}
                        placeholder={`À partir de ${(board.words.at(-1) ?? board.startWord).toUpperCase()}…`}
                        autoComplete="off"
                        autoCapitalize="characters"
                        spellCheck="false"
                      />
                      <button
                        type="submit"
                        disabled={!answer.trim() || pending}
                      >
                        {pending ? (
                          "Vérification…"
                        ) : (
                          <>
                            Valider <Check size={16} />
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </>
              )}
              {board.mode === "auction" && (
                <ModernAuctionView
                  board={board}
                  pending={pending}
                  onBuyPosition={(position) =>
                    refresh(() =>
                      revealAuctionLetter.mutateAsync({
                        runId: board.runId,
                        index: position,
                      }),
                    ) as Promise<AuctionBoard>
                  }
                  onBuyClue={(clue) =>
                    refresh(() =>
                      revealAuctionClue.mutateAsync({
                        runId: board.runId,
                        clue,
                      }),
                    ) as Promise<AuctionBoard>
                  }
                  onAttempt={(word) =>
                    refresh(() =>
                      attemptAuction.mutateAsync({ runId: board.runId, word }),
                    ) as Promise<
                      AuctionBoard & { valid: boolean; lemma?: string }
                    >
                  }
                  onFinished={(result) =>
                    setMessage(
                      result.valid
                        ? `Mot trouvé : « ${result.lemma ?? ""} »`
                        : `Manche terminée. Le mot était « ${result.lemma ?? ""} ».`,
                    )
                  }
                />
              )}
              {message && (
                <p className="daily-result" role="status">
                  {message}
                </p>
              )}
            </section>
          )}
          <footer className="daily-sheet-footer">
            <Link className="daily-exit" href="/">
              <ArrowLeft size={15} /> Quitter le jeu du jour
            </Link>
            <p className="daily-note">
              Les réponses, aides, score et état de la partie sont vérifiés côté
              serveur.
            </p>
          </footer>
        </article>
      </section>
      <DailyShareModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        modeName={mode.name}
        date={date}
        score={board?.score ?? 0}
        jokerUsed={false}
      />
    </main>
  );
}
