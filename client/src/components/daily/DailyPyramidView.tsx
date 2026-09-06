import { AnimatePresence, motion } from "framer-motion";

interface DailyPyramidViewProps {
  words: readonly string[];
}

export function DailyPyramidView({ words }: DailyPyramidViewProps) {
  return (
    <div
      className="daily-pyramid-board"
      aria-labelledby="pyramid-current-title"
    >
      <p id="pyramid-current-title" className="mini-label">
        Paliers validés
      </p>
      <div className="daily-pyramid" aria-live="polite">
        <AnimatePresence initial={false}>
          {words.map((word, index) => (
            <motion.span
              key={`${index}-${word}`}
              className="is-done"
              initial={{ opacity: 0, y: 12, rotate: -1.5 }}
              animate={{ opacity: 1, y: 0, rotate: 0 }}
              transition={{ type: "spring", stiffness: 360, damping: 24 }}
            >
              {word.toUpperCase()}
            </motion.span>
          ))}
        </AnimatePresence>
      </div>
      <small>
        Ajoutez une lettre, puis réorganisez-les toutes. Aucun futur palier
        n’est dévoilé.
      </small>
    </div>
  );
}
