import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Lightbulb, Users, X } from "lucide-react";
import { getGameQuickGuide, type RuleGame } from "@/lib/gameRules";

type GameIntroSheetProps = {
  game: RuleGame;
  variant: { label: string; detail: string };
  onClose: () => void;
};

function RuleDiagram({ game }: { game: RuleGame }) {
  if (game === "quiz")
    return (
      <div className="intro-diagram intro-quiz-diagram" aria-hidden="true">
        <span>A</span>
        <span>B</span>
        <span>C</span>
        <span>D</span>
        <ArrowRight size={18} />
        <i>
          <Check size={16} />
        </i>
      </div>
    );
  if (game === "motus")
    return (
      <div className="intro-diagram intro-motus-diagram" aria-hidden="true">
        <span className="is-exact">M</span>
        <span className="is-present">O</span>
        <span className="is-absent">T</span>
        <span>U</span>
        <span>S</span>
      </div>
    );
  return (
    <div className="intro-diagram intro-definition-diagram" aria-hidden="true">
      <span>mot</span>
      <i />
      <span>sens</span>
      <i />
      <span>lien</span>
    </div>
  );
}

export default function GameIntroSheet({
  game,
  variant,
  onClose,
}: GameIntroSheetProps) {
  const guide = getGameQuickGuide(game);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div className="game-intro-overlay" role="presentation">
      <section
        className={`game-intro-sheet game-intro-${game}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="game-intro-title"
        aria-describedby="game-intro-goal"
      >
        <button
          ref={closeRef}
          className="game-intro-close"
          type="button"
          onClick={onClose}
          aria-label="Fermer les règles et préparer la partie"
        >
          <X size={20} />
        </button>
        <header className="game-intro-header">
          <div>
            <p className="mini-label">Fiche de règles</p>
            <h1 id="game-intro-title">{guide.title}</h1>
            <p>{guide.eyebrow}</p>
          </div>
          <i className="game-intro-annotation" aria-hidden="true">
            Une règle à la fois
          </i>
        </header>
        <div className="game-intro-visual">
          <RuleDiagram game={game} />
          <div>
            <span>But</span>
            <b id="game-intro-goal">{guide.goal}</b>
          </div>
        </div>
        <ol className="game-intro-steps">
          {guide.steps.map((step) => (
            <li key={step.title}>
              <b>{step.title}</b>
              <span>{step.text}</span>
            </li>
          ))}
        </ol>
        <div className="game-intro-format">
          <span>Votre format</span>
          <b>{variant.label}</b>
          <small>{variant.detail}</small>
        </div>
        <section
          className="game-intro-jokers game-intro-multiplayer-note"
          aria-label="Règle de salon"
        >
          <div className="game-intro-joker-heading">
            <Users size={17} />
            <div>
              <p>En salon</p>
              <span>
                Les joueurs suivent la même manche et le même chronomètre. Les
                jokers tactiques ne sont pas utilisés en multijoueur.
              </span>
            </div>
          </div>
        </section>
        <div className="game-intro-solo">
          <Lightbulb size={16} />
          <span>{guide.soloNote}</span>
        </div>
        <button className="game-intro-start" type="button" onClick={onClose}>
          C’est compris, préparer la partie <ArrowRight size={17} />
        </button>
      </section>
    </div>
  );
}
