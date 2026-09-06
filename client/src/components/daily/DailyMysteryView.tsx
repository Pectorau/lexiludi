import { motion } from "framer-motion";

interface DailyMysteryViewProps {
  tokens: readonly string[];
  revealedWords: number;
  score: number;
}

export function DailyMysteryView({
  tokens,
  revealedWords,
  score,
}: DailyMysteryViewProps) {
  return (
    <div
      className="daily-mystery-board"
      aria-labelledby="mystery-progress-title"
    >
      <p id="mystery-progress-title" className="mini-label">
        Définition progressive
      </p>
      <p className="daily-definition">
        {tokens.map((token, index) => (
          <motion.span
            key={`${index}-${token}`}
            initial={{ opacity: 0, filter: "blur(6px)", y: 4 }}
            animate={{
              opacity: index < revealedWords ? 1 : 0.1,
              filter: index < revealedWords ? "blur(0px)" : "blur(6px)",
              y: 0,
            }}
            transition={{ duration: 0.18 }}
            aria-hidden={index >= revealedWords}
          >
            {index < revealedWords ? `${token} ` : "··· "}
          </motion.span>
        ))}
      </p>
      <small aria-live="polite">
        {revealedWords}/{tokens.length} mots affichés · {score} pts en jeu
      </small>
    </div>
  );
}
