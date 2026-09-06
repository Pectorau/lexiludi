import { ArrowLeft, ArrowRight } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import GameIntroSheet from "@/components/GameIntroSheet";
import { EditableBlock } from "@/components/editable-block";
import { VisualEditablePage } from "@/components/visual-editable-page";
import {
  buildMotusPlayPath,
  motusModes,
  type MotusMode,
} from "@/lib/gameRoutes";

export default function MotusSetup() {
  const [motusMode, setMotusMode] = useState<MotusMode>("classic");
  const [showIntro, setShowIntro] = useState(true);
  const activeMotusMode =
    motusModes.find((mode) => mode.id === motusMode) ?? motusModes[0];

  return (
    <VisualEditablePage pageKey="motus">
      <main className="motif-app is-playing">
        <section className="game-stage motus-stage">
          <div className="mode-setup">
            <EditableBlock
              id="motus.heading"
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
                <p className="mini-label">Motus</p>
                <h1>
                  Choisissez votre
                  <br />
                  <em>format.</em>
                </h1>
                <p>Une règle simple, trois rythmes de jeu.</p>
              </div>
            </EditableBlock>
            <EditableBlock
              id="motus.grid"
              locked
              defaultLayout={{ x: 0, y: 0, width: 100, height: 40 }}
            >
              <div className="setup-guidance">
                <span>À savoir</span>
                <b>
                  Les indices de lettres restent visibles à chaque nouvel essai.
                </b>
              </div>
            </EditableBlock>
            <EditableBlock
              id="motus.keyboard"
              locked
              defaultLayout={{ x: 0, y: 0, width: 100, height: 40 }}
            >
              <div className="setup-options motus-setup-options variant-options">
                {motusModes.map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setMotusMode(mode.id)}
                    className={motusMode === mode.id ? "is-active" : ""}
                  >
                    <span
                      className={`variant-mini motus-mini ${mode.id}`}
                      aria-hidden="true"
                    >
                      {Array.from({ length: mode.attempts }, (_, index) => (
                        <i key={index} />
                      ))}
                    </span>
                    <b>{mode.label}</b>
                    <span>
                      {mode.attempts} essais · {mode.minLength}–{mode.maxLength}{" "}
                      lettres
                    </span>
                  </button>
                ))}
              </div>
            </EditableBlock>
            <EditableBlock
              id="motus.actions"
              defaultLayout={{ x: 0, y: 0, width: 100, height: 40 }}
            >
              <div className="setup-actions">
                <Link
                  className="setup-start"
                  href={buildMotusPlayPath(motusMode)}
                >
                  Lancer Motus <ArrowRight size={17} />
                </Link>
                <Link className="multiplayer-link" href="/motus/multijoueur">
                  Jouer en salon <span>Multijoueur</span>
                  <ArrowRight size={15} />
                </Link>
              </div>
            </EditableBlock>
          </div>
          {showIntro && (
            <GameIntroSheet
              game="motus"
              variant={{
                label: activeMotusMode.label,
                detail: `${activeMotusMode.attempts} essais · ${activeMotusMode.minLength}–${activeMotusMode.maxLength} lettres`,
              }}
              onClose={() => setShowIntro(false)}
            />
          )}
        </section>
      </main>
    </VisualEditablePage>
  );
}
