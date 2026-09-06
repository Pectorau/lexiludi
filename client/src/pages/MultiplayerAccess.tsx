import {
  ArrowLeft,
  ArrowRight,
  Globe2,
  LockKeyhole,
  Users,
} from "lucide-react";
import { Link } from "wouter";
import "./multiplayer-setup.css";

type GameMode = "quiz" | "motus" | "definition";

const gameInfo: Record<
  GameMode,
  { label: string; backHref: string; baseHref: string; description: string }
> = {
  quiz: {
    label: "Quiz",
    backHref: "/quiz",
    baseHref: "/quiz/multijoueur",
    description:
      "Une même question, des réponses synchronisées et un classement de table.",
  },
  motus: {
    label: "Motus",
    backHref: "/motus",
    baseHref: "/motus/multijoueur",
    description:
      "Un mot commun à trouver, des essais limités et des indices à jouer.",
  },
  definition: {
    label: "Mots liés",
    backHref: "/definitions",
    baseHref: "/definitions/multijoueur",
    description: "Des termes et des nuances à relier au même rythme.",
  },
};

export default function MultiplayerAccess({
  gameMode,
}: {
  gameMode: GameMode;
}) {
  const game = gameInfo[gameMode];
  const stageClass =
    gameMode === "quiz"
      ? "quiz-stage"
      : gameMode === "motus"
        ? "motus-stage"
        : "definition-stage";
  return (
    <main className="motif-app is-playing">
      <section className={`game-stage ${stageClass}`}>
        <Link className="back-control" href={game.backHref}>
          <ArrowLeft size={17} />
          <span>Modes</span>
        </Link>
        <div className="stage-logo">
          <span>m</span> motif.
        </div>
        <section className="multiplayer-access-page">
          <div className="multiplayer-kicker">
            <Users size={15} /> {game.label} partagé
          </div>
          <p className="mini-label">Choisir un accès</p>
          <h1>
            Entrez dans
            <br />
            <em>la partie.</em>
          </h1>
          <p>{game.description}</p>
          <div className="multiplayer-access-choice">
            <Link href={`${game.baseHref}/creer`}>
              <span className="access-symbol">
                <LockKeyhole size={20} />
              </span>
              <div>
                <b>Créer une table</b>
                <small>Réglez la partie, puis invitez votre groupe.</small>
              </div>
              <ArrowRight size={18} />
            </Link>
            <Link href={`${game.baseHref}/rejoindre`}>
              <span className="access-symbol">
                <Globe2 size={20} />
              </span>
              <div>
                <b>Rejoindre une table</b>
                <small>
                  Utilisez un code ou explorez les tables publiques.
                </small>
              </div>
              <ArrowRight size={18} />
            </Link>
          </div>
        </section>
      </section>
    </main>
  );
}
