import { ArrowLeft, ArrowRight, GitFork } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import GameIntroSheet from "@/components/GameIntroSheet";
import { EditableBlock } from "@/components/editable-block";
import { VisualEditablePage } from "@/components/visual-editable-page";
import {
  buildDefinitionPlayPath,
  definitionModes,
  type DefinitionMode,
} from "@/lib/gameRoutes";
import "./definition-match.css";

const miniature = (mode: DefinitionMode) => {
  if (mode === "match")
    return (
      <>
        <i>mot</i>
        <i>sens</i>
      </>
    );
  if (mode === "synonym")
    return (
      <>
        <i>≈</i>
        <i>≈</i>
      </>
    );
  if (mode === "antonym")
    return (
      <>
        <i>+</i>
        <i>−</i>
      </>
    );
  return (
    <>
      <i>○</i>
      <i>×</i>
    </>
  );
};

export default function DefinitionSetup() {
  const [definitionMode, setDefinitionMode] = useState<DefinitionMode>("match");
  const [showIntro, setShowIntro] = useState(true);
  const activeDefinitionMode =
    definitionModes.find((mode) => mode.id === definitionMode) ??
    definitionModes[0];

  return (
    <VisualEditablePage pageKey="definitions">
      <main className="motif-app is-playing">
        <section className="game-stage definition-stage">
          <div className="mode-setup definition-setup">
            <EditableBlock
              id="definitions.heading"
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
                <p className="mini-label">Mots liés</p>
                <h1>
                  Choisissez votre
                  <br />
                  <em>liaison.</em>
                </h1>
                <p>
                  Une feuille, une relation de sens, puis un retour utile dans
                  votre carnet.
                </p>
              </div>
            </EditableBlock>
            <EditableBlock
              id="definitions.board"
              locked
              defaultLayout={{ x: 0, y: 0, width: 100, height: 40 }}
            >
              <div className="setup-guidance">
                <span>À savoir</span>
                <b>
                  Les pistes viennent des définitions et relations lexicales
                  vérifiées ; une réponse révèle toujours sa nuance.
                </b>
              </div>
            </EditableBlock>
            <EditableBlock
              id="definitions.actions"
              defaultLayout={{ x: 0, y: 0, width: 100, height: 40 }}
            >
              <div
                className="setup-options variant-options definition-setup-options"
                role="radiogroup"
                aria-label="Choisir une variante Mots liés"
              >
                {definitionModes.map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    role="radio"
                    aria-checked={definitionMode === mode.id}
                    onClick={() => setDefinitionMode(mode.id)}
                    className={definitionMode === mode.id ? "is-active" : ""}
                  >
                    <span
                      className={`variant-mini definition-mini ${mode.id}`}
                      aria-hidden="true"
                    >
                      {miniature(mode.id)}
                    </span>
                    <b>{mode.label}</b>
                    <span>{mode.detail}</span>
                  </button>
                ))}
              </div>
              <div className="setup-actions">
                <Link
                  className="setup-start"
                  href={buildDefinitionPlayPath(definitionMode)}
                >
                  Lancer la liaison <ArrowRight size={17} />
                </Link>
                <Link
                  className="multiplayer-link"
                  href="/definitions/multijoueur"
                >
                  Jouer en salon <span>Multijoueur</span>
                  <ArrowRight size={15} />
                </Link>
              </div>
            </EditableBlock>
          </div>
          {showIntro && (
            <GameIntroSheet
              game="definition"
              variant={activeDefinitionMode}
              onClose={() => setShowIntro(false)}
            />
          )}
        </section>
      </main>
    </VisualEditablePage>
  );
}
