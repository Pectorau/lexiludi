import { ArrowLeft, ArrowRight } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import GameIntroSheet from "@/components/GameIntroSheet";
import { EditableBlock } from "@/components/editable-block";
import { VisualEditablePage } from "@/components/visual-editable-page";
import { buildQuizPlayPath, quizModes, type QuizMode } from "@/lib/gameRoutes";

export default function QuizSetup() {
  const [quizMode, setQuizMode] = useState<QuizMode>("category");
  const [showIntro, setShowIntro] = useState(true);
  const activeQuizMode =
    quizModes.find((mode) => mode.id === quizMode) ?? quizModes[0];

  return (
    <VisualEditablePage pageKey="quiz">
      <main className="motif-app is-playing">
        <section className="game-stage quiz-stage">
          <div className="mode-setup">
            <EditableBlock
              id="quiz.heading"
              defaultLayout={{ x: 0, y: 0, width: 100, height: 40 }}
            >
              <div>
                <Link className="back-control" href="/">
                  <ArrowLeft size={17} />
                  <span>Jeux</span>
                </Link>
                <div className="stage-logo">
                  <span>m</span> motif.
                </div>
                <p className="mini-label">Quiz aléatoire</p>
                <h1>
                  Choisissez votre
                  <br />
                  <em>défi.</em>
                </h1>
                <p>Le tirage démarre quand vous êtes prêt.</p>
              </div>
            </EditableBlock>
            <EditableBlock
              id="quiz.prompt"
              defaultLayout={{ x: 0, y: 0, width: 100, height: 40 }}
            >
              <div className="setup-guidance">
                <span>À savoir</span>
                <b>
                  Les défis puisent dans les noms, adjectifs, verbes et formes
                  fléchies de Morphalou.
                </b>
              </div>
            </EditableBlock>
            <EditableBlock
              id="quiz.answers"
              defaultLayout={{ x: 0, y: 0, width: 100, height: 40 }}
            >
              <div className="setup-options variant-options quiz-variant-options">
                {quizModes.map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setQuizMode(mode.id)}
                    className={quizMode === mode.id ? "is-active" : ""}
                  >
                    <span
                      className={`variant-mini quiz-mini ${mode.id}`}
                      aria-hidden="true"
                    >
                      {mode.id === "category" ? (
                        <>
                          <i>A</i>
                          <i>B</i>
                          <i>C</i>
                          <i>D</i>
                        </>
                      ) : mode.id === "truefalse" ? (
                        <>
                          <i>✓</i>
                          <i>×</i>
                        </>
                      ) : (
                        <>
                          <i>m.</i>
                          <i>f.</i>
                        </>
                      )}
                    </span>
                    <b>{mode.label}</b>
                    <span>{mode.detail}</span>
                  </button>
                ))}
              </div>
            </EditableBlock>
            <EditableBlock
              id="quiz.trace"
              defaultLayout={{ x: 0, y: 0, width: 100, height: 40 }}
            >
              <div className="setup-actions">
                <Link
                  className="setup-start"
                  href={buildQuizPlayPath(quizMode)}
                >
                  Lancer le quiz <ArrowRight size={17} />
                </Link>
                <Link className="multiplayer-link" href="/quiz/multijoueur">
                  Jouer en salon <span>Multijoueur</span>
                  <ArrowRight size={15} />
                </Link>
              </div>
            </EditableBlock>
          </div>
          {showIntro && (
            <GameIntroSheet
              game="quiz"
              variant={activeQuizMode}
              onClose={() => setShowIntro(false)}
            />
          )}
        </section>
      </main>
    </VisualEditablePage>
  );
}
