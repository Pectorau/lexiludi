import { Lightbulb } from "lucide-react";
import { motion } from "framer-motion";

interface DailyAuctionViewProps {
  length: number;
  score: number;
  letters: Record<number, string>;
  disabled: boolean;
  pending: boolean;
  onBuy: (index: number) => void;
}

export function DailyAuctionView({
  length,
  score,
  letters,
  disabled,
  pending,
  onBuy,
}: DailyAuctionViewProps) {
  return (
    <div className="daily-auction-board" aria-labelledby="auction-title">
      <p id="auction-title" className="mini-label">
        Capital restant : {score} points
      </p>
      <p className="auction-instruction">
        Choisissez une case inconnue pour acheter précisément cette lettre.
      </p>
      <div className="auction-letters" aria-label="Lettres découvertes">
        {Array.from({ length }, (_, index) => {
          const letter = letters[index];
          return (
            <motion.button
              key={index}
              type="button"
              className="auction-tile"
              disabled={disabled || pending || Boolean(letter) || score < 10}
              onClick={() => onBuy(index)}
              initial={false}
              animate={
                letter
                  ? { rotateY: 360, scale: [1, 1.08, 1] }
                  : { rotateY: 0, scale: 1 }
              }
              transition={{ duration: 0.24 }}
              aria-label={
                letter
                  ? `Lettre ${index + 1}, révélée : ${letter}`
                  : `Acheter la lettre ${index + 1}, 10 points`
              }
            >
              {letter ?? "?"}
            </motion.button>
          );
        })}
      </div>
      <p className="daily-auction-cost">
        <Lightbulb size={15} /> Une lettre ciblée coûte 10 points.
      </p>
    </div>
  );
}
