import {
  ArrowLeft,
  Check,
  ExternalLink,
  Heart,
  RotateCcw,
  Timer,
} from "lucide-react";
import { useCallback, useEffect, useReducer, useState } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { buildQuizPlayPath, readQuizMode } from "@/lib/gameRoutes";
import { canSubmitQuizChoice, quizShortcutIndex } from "@/lib/quizInteraction";
import {
  initialQuizCampaign,
  quizCampaignReducer,
  QUIZ_CAMPAIGN,
} from "@/lib/quizCampaign";
import "./quiz-intense.css";

type QuizProgress = {
  answered: number;
  correct: number;
  streak: number;
  bestStreak: number;
  review: string[];
};
type QuizRound = {
  sessionId: string;
  status: "active" | "resolved" | "abandoned" | "expired";
  attempts: number;
  maxAttempts: number;
  score: number;
  kind: "category" | "truefalse" | "gender";
  term: string;
  prompt: string;
  choices: string[];
  context: string;
  statementCategory?: string;
  source: { name: string; license: string; cnrtlUrl: string };
  valid?: boolean;
  answer?: string;
  correction?: string;
  lemma?: string;
};
function readQuizProgress(): QuizProgress {
  if (typeof window === "undefined")
    return { answered: 0, correct: 0, streak: 0, bestStreak: 0, review: [] };
  try {
    const value = JSON.parse(
      window.localStorage.getItem("motif-quiz-progress") ?? "{}",
    );
    return {
      answered: Number(value.answered) || 0,
      correct: Number(value.correct) || 0,
      streak: Number(value.streak) || 0,
      bestStreak: Number(value.bestStreak) || 0,
      review: Array.isArray(value.review)
        ? value.review
            .filter((item: unknown): item is string => typeof item === "string")
            .slice(0, 6)
        : [],
    };
  } catch {
    return { answered: 0, correct: 0, streak: 0, bestStreak: 0, review: [] };
  }
}

export default function QuizGame() {
  const [location, setLocation] = useLocation();
  const quizMode = readQuizMode(
    `${location}${typeof window !== "undefined" ? window.location.search : ""}`,
  );
  const [round, setRound] = useState<QuizRound | null>(null);
  const [choice, setChoice] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [notice, setNotice] = useState("");
  const [progress, setProgress] = useState<QuizProgress>(readQuizProgress);
  const [campaign, dispatchCampaign] = useReducer(
    quizCampaignReducer,
    initialQuizCampaign,
  );
  const startQuiz = trpc.solo.startQuiz.useMutation();
  const submitQuiz = trpc.solo.submitQuiz.useMutation();
  const isResolved = round?.status === "resolved";
  const isBoss =
    campaign.status === "BOSS_PLAYING" || campaign.status === "BOSS_TRANSITION";
  const ended =
    campaign.status === "GAME_OVER" || campaign.status === "VICTORY";

  const loadQuestion = useCallback(
    async (updateAddress = true) => {
      setRound(null);
      setChoice(null);
      setNotice("");
      if (updateAddress) setLocation(buildQuizPlayPath(quizMode));
      try {
        setRound(
          (await startQuiz.mutateAsync({ mode: quizMode })) as QuizRound,
        );
      } catch (error) {
        setNotice(
          error instanceof Error
            ? error.message
            : "Impossible de charger cette question.",
        );
      }
    },
    [quizMode, setLocation, startQuiz],
  );
  useEffect(() => {
    void loadQuestion(false);
  }, [quizMode]);
  useEffect(() => {
    if (campaign.status !== "BOSS_TRANSITION") return;
    const timer = window.setTimeout(() => {
      dispatchCampaign({ type: "START_BOSS" });
      void loadQuestion(false);
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [campaign.status, loadQuestion]);
  useEffect(() => {
    if (
      campaign.status !== "BOSS_PLAYING" ||
      isResolved ||
      campaign.timeLeft === null
    )
      return;
    if (campaign.timeLeft === 0) {
      dispatchCampaign({ type: "TIME_OUT" });
      setAnnouncement("Temps écoulé : une vie est retirée.");
      return;
    }
    const timer = window.setInterval(
      () => dispatchCampaign({ type: "TICK" }),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [campaign.status, campaign.timeLeft, isResolved]);
  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      if (
        !round ||
        isResolved ||
        ended ||
        campaign.status === "BOSS_TRANSITION" ||
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLButtonElement
      )
        return;
      const index = quizShortcutIndex(event.key, round.choices.length);
      if (index !== null) {
        event.preventDefault();
        setChoice(round.choices[index] ?? null);
      }
      if (event.key === "Enter" && choice) {
        event.preventDefault();
        void submit();
      }
    }
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [round, choice, isResolved, ended, campaign.status]);

  async function submit() {
    if (
      !round ||
      !choice ||
      isResolved ||
      ended ||
      campaign.status === "BOSS_TRANSITION"
    )
      return;
    try {
      const response = (await submitQuiz.mutateAsync({
        sessionId: round.sessionId,
        choice,
      })) as QuizRound;
      setRound(response);
      dispatchCampaign({
        type: "SUBMIT_ANSWER",
        correct: Boolean(response.valid),
      });
      setProgress((current) => {
        const review = response.valid
          ? current.review
          : Array.from(
              new Set([response.lemma ?? round.term, ...current.review]),
            ).slice(0, 6);
        const next = {
          answered: current.answered + 1,
          correct: current.correct + (response.valid ? 1 : 0),
          streak: response.valid ? current.streak + 1 : 0,
          bestStreak: response.valid
            ? Math.max(current.bestStreak, current.streak + 1)
            : current.bestStreak,
          review,
        };
        window.localStorage.setItem(
          "motif-quiz-progress",
          JSON.stringify(next),
        );
        return next;
      });
      setAnnouncement(
        response.valid
          ? "Bonne réponse confirmée."
          : `Réponse à revoir : ${response.correction ?? ""}`,
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "La réponse n’a pas pu être enregistrée.",
      );
    }
  }
  function continueQuiz() {
    if (ended) {
      dispatchCampaign({ type: "RESET" });
      void loadQuestion();
      return;
    }
    if (!isResolved || campaign.status === "BOSS_TRANSITION") return;
    if (campaign.status === "BOSS_PLAYING")
      dispatchCampaign({ type: "PREPARE_BOSS_RETRY" });
    void loadQuestion(false);
  }
  const currentQuestion = campaign.questionIndex + 1;

  return (
    <main className="motif-app is-playing">
      <div className="sr-only" aria-live="polite">
        {announcement}
      </div>
      <section className="game-stage quiz-stage">
        <Link className="back-control" href="/quiz">
          <ArrowLeft size={17} />
          <span>Feuille de manche</span>
        </Link>
        <div className="stage-logo">
          <span>m</span> motif.
        </div>
        {!round && (
          <div className="stage-loading">{notice || "Nouvelle question…"}</div>
        )}
        {round && (
          <div
            className={`quiz-play observation-sheet ${isBoss ? "is-boss" : ""}`}
          >
            <aside className="quiz-margin">
              <p>{isBoss ? "Épreuve finale" : "Fiche active"}</p>
              <div>
                <small>Session</small>
                <b>{currentQuestion}/10</b>
              </div>
              <div>
                <small>Précision</small>
                <b>
                  {progress.answered
                    ? `${Math.round((progress.correct / progress.answered) * 100)} %`
                    : "—"}
                </b>
              </div>
              <div>
                <small>Série</small>
                <b>{campaign.streak}</b>
              </div>
            </aside>
            <div className="quiz-sheet-content">
              <div className="quiz-intense-hud">
                <div
                  className="quiz-hearts"
                  aria-label={`${campaign.hearts} vies restantes`}
                >
                  {Array.from(
                    { length: QUIZ_CAMPAIGN.maxHearts },
                    (_, index) => (
                      <Heart
                        key={index}
                        size={18}
                        fill={index < campaign.hearts ? "currentColor" : "none"}
                        className={index < campaign.hearts ? "" : "is-empty"}
                      />
                    ),
                  )}
                </div>
                <p>
                  Série : <b>{campaign.streak}</b>
                  {campaign.status === "BOSS_PLAYING" && (
                    <span
                      className={`quiz-boss-timer ${campaign.timeLeft !== null && campaign.timeLeft <= 3 ? "is-critical" : ""}`}
                    >
                      <Timer size={14} /> 00:
                      {String(campaign.timeLeft ?? 0).padStart(2, "0")}
                    </span>
                  )}
                </p>
              </div>
              {campaign.status === "BOSS_TRANSITION" ? (
                <div className="quiz-boss-transition">
                  <p className="mini-label">Question 10 · accès verrouillé</p>
                  <b>ÉPREUVE FINALE</b>
                  <span>Préparation de la dernière question…</span>
                </div>
              ) : ended ? (
                <div
                  className={`quiz-campaign-end ${campaign.status === "VICTORY" ? "is-victory" : ""}`}
                >
                  <p className="mini-label">
                    {campaign.status === "VICTORY"
                      ? "Session validée"
                      : "Fin de séance"}
                  </p>
                  <h2>
                    {campaign.status === "VICTORY"
                      ? "Épreuve finale réussie."
                      : "Vos trois vies sont épuisées."}
                  </h2>
                  <button
                    className="refresh-game"
                    type="button"
                    onClick={continueQuiz}
                  >
                    Nouvelle campagne <RotateCcw size={16} />
                  </button>
                </div>
              ) : (
                <>
                  <div className="play-meta">
                    <span>
                      {isBoss
                        ? "Épreuve finale · question réelle"
                        : `Quiz aléatoire · ${round.kind === "gender" ? "genre" : round.kind === "truefalse" ? "vrai / faux" : "catégorie"}`}
                    </span>
                    <span className="quiz-progress-line">
                      {currentQuestion}/10 · {campaign.hearts} vies ·{" "}
                      {campaign.streak} de série
                    </span>
                    {isResolved && (
                      <a
                        className="cnrtl-term"
                        href={round.source.cnrtlUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Approfondir l’entrée <ExternalLink size={13} />
                      </a>
                    )}
                  </div>
                  <div className="quiz-main">
                    <p className="mini-label">
                      {isBoss ? "Dernière vérification" : "Fiche d’observation"}
                    </p>
                    {round.kind !== "gender" && round.context && (
                      <p className="quiz-context">{round.context}</p>
                    )}
                    <h1>
                      {round.kind === "truefalse" ? (
                        <>
                          <i>{round.term}</i> est-il de
                          <br />
                          <em>
                            catégorie{" "}
                            {round.statementCategory?.toLocaleLowerCase(
                              "fr-FR",
                            )}{" "}
                            ?
                          </em>
                        </>
                      ) : (
                        <>
                          {round.term} <em>?</em>
                        </>
                      )}
                    </h1>
                    <p className="quiz-question">{round.prompt}</p>
                  </div>
                  <p className="quiz-shortcuts">
                    Raccourcis : <kbd>A</kbd> à{" "}
                    <kbd>{String.fromCharCode(64 + round.choices.length)}</kbd>{" "}
                    pour choisir · <kbd>Entrée</kbd> pour valider.
                  </p>
                  <div
                    className={`answer-list answer-bands ${round.choices.length === 2 ? "binary-list" : ""}`}
                    role="radiogroup"
                  >
                    {round.choices.map((item, index) => {
                      const correct = isResolved && item === round.answer;
                      const wrong =
                        isResolved && choice === item && item !== round.answer;
                      return (
                        <button
                          key={item}
                          type="button"
                          role="radio"
                          aria-checked={choice === item}
                          disabled={isResolved || submitQuiz.isPending}
                          onClick={() => setChoice(item)}
                          className={[
                            "answer-choice",
                            choice === item ? "is-selected" : "",
                            correct ? "is-correct" : "",
                            wrong ? "is-wrong" : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        >
                          <span>{String.fromCharCode(65 + index)}</span>
                          <b>{item}</b>
                          {correct && <Check size={18} />}
                        </button>
                      );
                    })}
                  </div>
                  <div
                    className={`play-footer quiz-trace ${isResolved ? (round.valid ? "is-correct" : "is-wrong") : ""}`}
                  >
                    <p role="status">
                      {isResolved ? (
                        round.valid ? (
                          <>
                            <strong className="quiz-stamp">✓ JUSTE</strong> Bien
                            vu : {round.answer?.toLocaleLowerCase("fr-FR")}.
                          </>
                        ) : (
                          <>
                            <strong className="quiz-stamp">↳ À REVOIR</strong>{" "}
                            {round.correction}
                          </>
                        )
                      ) : choice ? (
                        <>
                          <strong className="quiz-stamp">○ SÉLECTIONNÉE</strong>{" "}
                          Vérifiez votre choix puis validez.
                        </>
                      ) : (
                        "Choisissez une piste : vous pourrez la modifier avant validation."
                      )}
                    </p>
                    <div className="quiz-footer-actions">
                      {!isResolved && (
                        <button
                          className="refresh-game quiz-submit"
                          type="button"
                          onClick={() => void submit()}
                          disabled={
                            !canSubmitQuizChoice(choice, false) ||
                            submitQuiz.isPending
                          }
                        >
                          Valider la réponse <Check size={16} />
                        </button>
                      )}
                      {isResolved && (
                        <button
                          className="refresh-game"
                          type="button"
                          onClick={continueQuiz}
                        >
                          {campaign.status === "BOSS_PLAYING"
                            ? "Nouvelle question finale"
                            : "Question suivante"}{" "}
                          <RotateCcw size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
