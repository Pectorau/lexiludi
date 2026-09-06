import React, { useMemo } from "react";
import { Crown, Sparkles, UserPlus, CheckCircle2, Clock } from "lucide-react";
import type { RoomPlayerSummary } from "./types";
import "@/pages/lobby-table.css";

const DEFAULT_MAX_SEATS = 8;

// Type étendu si RoomPlayerSummary n'a pas encore seatIndex explicite
type TablePlayer = RoomPlayerSummary & { seatIndex?: number };

interface LobbyTableProps {
  players: TablePlayer[];
  viewerId: number;
  viewerReady: boolean;
  maxSeats?: number;
  onSeatClick?: (seatIndex: number) => void;
}

export function LobbyTable({
  players,
  viewerId,
  viewerReady,
  maxSeats = DEFAULT_MAX_SEATS,
  onSeatClick,
}: LobbyTableProps) {
  // 1. Mappe les joueurs sur leurs sièges réels (0 à maxSeats - 1)
  const seats = useMemo(() => {
    const grid: (TablePlayer | null)[] = Array(maxSeats).fill(null);

    players.forEach((player, fallbackIdx) => {
      // Priorité au seatIndex explicite s'il existe dans le backend, sinon index de secours
      const targetIndex =
        typeof player.seatIndex === "number" ? player.seatIndex : fallbackIdx;
      if (targetIndex >= 0 && targetIndex < maxSeats) {
        grid[targetIndex] = player;
      }
    });

    return grid;
  }, [players, maxSeats]);

  const readyCount = players.filter((p) =>
    p.id === viewerId ? viewerReady : Boolean(p.isReady),
  ).length;

  return (
    <section
      className="lobby-table"
      aria-label="Table de jeu"
      style={{ "--total-seats": maxSeats } as React.CSSProperties}
    >
      {/* Tapis central avec statistiques de la table */}
      <div className="lobby-table-felt">
        <Sparkles size={18} aria-hidden="true" />
        <div className="lobby-felt-info">
          <strong>
            {players.length} / {maxSeats} Joueurs
          </strong>
          <small>{readyCount} prêts</small>
        </div>
      </div>

      {/* Sièges répartis autour du tapis */}
      <div className="lobby-table-seats">
        {seats.map((player, index) => {
          // Angle calculé dynamiquement pour positionnement polaire en CSS
          const angleDeg = (360 / maxSeats) * index;
          const seatStyle = {
            "--seat-angle": `${angleDeg}deg`,
          } as React.CSSProperties;

          return player ? (
            <PlayerSeat
              key={player.id}
              player={player}
              seatIndex={index}
              style={seatStyle}
              isViewer={player.id === viewerId}
              isReady={
                player.id === viewerId ? viewerReady : Boolean(player.isReady)
              }
            />
          ) : (
            <EmptySeat
              key={`empty-seat-${index}`}
              seatIndex={index}
              style={seatStyle}
              onSelect={onSeatClick ? () => onSeatClick(index) : undefined}
            />
          );
        })}
      </div>
    </section>
  );
}

// --- Sous-composants ---

function PlayerSeat({
  player,
  seatIndex,
  isViewer,
  isReady,
  style,
}: {
  player: TablePlayer;
  seatIndex: number;
  isViewer: boolean;
  isReady: boolean;
  style?: React.CSSProperties;
}) {
  const initial = player.nickname?.trim().charAt(0).toUpperCase() || "?";
  const status = isReady ? "Prêt" : (player.presence ?? "En attente");

  const classNames = [
    "lobby-seat",
    `seat-${seatIndex}`,
    isReady ? "is-ready" : "is-waiting",
    isViewer ? "is-viewer" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article
      className={classNames}
      style={style}
      aria-current={isViewer ? "true" : undefined}
    >
      <div className="lobby-seat-avatar">
        {initial}
        {isReady ? (
          <CheckCircle2 size={14} className="lobby-status-badge ready" />
        ) : (
          <Clock size={14} className="lobby-status-badge waiting" />
        )}
      </div>

      <div className="lobby-seat-info">
        <span className="lobby-seat-name" title={player.nickname}>
          {player.nickname}
        </span>
        <span className="lobby-seat-status">{status}</span>
      </div>

      {player.isHost && (
        <Crown
          size={14}
          className="lobby-host-icon"
          aria-label="Hôte de la partie"
        />
      )}
    </article>
  );
}

function EmptySeat({
  seatIndex,
  style,
  onSelect,
}: {
  seatIndex: number;
  style?: React.CSSProperties;
  onSelect?: () => void;
}) {
  return (
    <button
      type="button"
      className={`lobby-seat seat-${seatIndex} is-empty`}
      style={style}
      onClick={onSelect}
      disabled={!onSelect}
      aria-label={`Siège ${seatIndex + 1} libre`}
    >
      <div className="lobby-seat-placeholder">
        <UserPlus size={16} />
        <span>Libre</span>
      </div>
    </button>
  );
}
