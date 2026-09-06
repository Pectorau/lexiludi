import { TacticalReserve } from "@/components/TacticalReserve";
import { useState } from "react";
import { ChevronUp, Layers3 } from "lucide-react";
import { useGameAudio } from "@/hooks/useGameAudio";
import type {
  MultiplayerJokerId,
  RoomPlayerSummary,
  RoomReward,
} from "./types";
import "@/pages/joker-deck.css";

export interface JokerDockProps {
  rewards: RoomReward[];
  targets: RoomPlayerSummary[];
  disabled: boolean;
  usedJokers: Set<string>;
  lastMessage?: string | null;
  onUse: (joker: MultiplayerJokerId, targetPlayerId?: number) => void;
}

/** Dock local aux manches actives : aucun joker n’est présenté pendant le lobby. */
export function JokerDock({
  rewards,
  targets,
  disabled,
  usedJokers,
  lastMessage,
  onUse,
}: JokerDockProps) {
  const [open, setOpen] = useState(false);
  const play = useGameAudio();
  const attackCount = rewards.filter(
    (reward) => reward.joker === "fog" || reward.joker === "peek",
  ).length;
  const defenseCount = rewards.filter(
    (reward) =>
      reward.joker === "shield" ||
      reward.joker === "compass" ||
      reward.joker === "second_chance",
  ).length;
  return (
    <aside
      className={`joker-deck ${open ? "is-open" : ""}`}
      aria-label="Deck de jokers"
    >
      <button
        className="joker-deck-trigger"
        type="button"
        aria-expanded={open}
        onClick={() => {
          play("card");
          setOpen((current) => !current);
        }}
      >
        <span className="joker-deck-icon">
          <Layers3 size={16} />
        </span>
        <span>
          <b>Deck tactique</b>
          <small>{rewards.length}/3 cartes</small>
        </span>
        <span
          className="joker-tension"
          aria-label={`Tension offensive ${attackCount} sur 3`}
        >
          <i
            className="is-attack"
            style={{ width: `${(attackCount / 3) * 100}%` }}
          />
        </span>
        <span
          className="joker-tension"
          aria-label={`Tension défensive ${defenseCount} sur 3`}
        >
          <i
            className="is-defense"
            style={{ width: `${(defenseCount / 3) * 100}%` }}
          />
        </span>
        <ChevronUp className="joker-deck-chevron" size={15} />
      </button>
      <div className="joker-deck-content">
        <TacticalReserve
          rewards={rewards}
          targets={targets}
          disabled={disabled}
          usedJokers={usedJokers}
          lastMessage={lastMessage}
          onUse={(joker, targetPlayerId) => {
            play(joker === "fog" || joker === "peek" ? "warning" : "success");
            onUse(joker, targetPlayerId);
          }}
        />
      </div>
    </aside>
  );
}
