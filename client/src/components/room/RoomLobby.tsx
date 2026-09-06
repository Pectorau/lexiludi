import { ArrowRight, RotateCcw, Users } from "lucide-react";
import type { ReactNode } from "react";
import type { RoomPlayerSummary } from "./types";
import { LobbyTable } from "./LobbyTable";
import { EditableBlock } from "@/components/editable-block";

export interface RoomLobbyProps {
  gameLabel: string;
  code: string;
  players: RoomPlayerSummary[];
  viewerId: number;
  viewerReady: boolean;
  isHost: boolean;
  preparationAvailable: boolean;
  canStart: boolean;
  launchLabel: string;
  busy: boolean;
  pendingReady: boolean;
  shareBlock: ReactNode;
  onReady: (nextReady: boolean) => void;
  onStart: () => void;
}

export function RoomLobby({
  gameLabel,
  players,
  viewerId,
  viewerReady,
  isHost,
  preparationAvailable,
  canStart,
  launchLabel,
  busy,
  pendingReady,
  shareBlock,
  onReady,
  onStart,
}: RoomLobbyProps) {
  const readyPlayers = players.filter((player) =>
    player.id === viewerId ? viewerReady : player.isReady,
  ).length;
  return (
    <>
      <EditableBlock
        id="multiplayer.ready"
        locked
        defaultLayout={{ x: 0, y: 0, width: 100, height: 0 }}
      >
        <section className="room-preparation" aria-label="Préparation du salon">
          <div>
            <p className="mini-label">Préparation</p>
            <b>{`${readyPlayers}/${players.length} prêts`}</b>
            <span>
              {preparationAvailable
                ? "Chaque joueur confirme qu’il est prêt avant le lancement."
                : "Vous pouvez vous déclarer prêt : la table attend simplement un invité."}
            </span>
          </div>
          <div className="ready-list">
            {players.map((player) => {
              const isViewer = player.id === viewerId;
              const isReady = isViewer ? viewerReady : Boolean(player.isReady);
              return (
                <span
                  key={player.id}
                  className={`${isReady ? "is-ready" : ""} ${player.presence === "hors ligne" ? "is-offline" : ""}`}
                >
                  <i>{isReady ? "✓" : "·"}</i>
                  {player.nickname}
                  <small>{player.presence}</small>
                </span>
              );
            })}
          </div>
          <button
            type="button"
            className="ready-button"
            disabled={busy}
            onClick={() => onReady(!viewerReady)}
          >
            {pendingReady
              ? "Enregistrement…"
              : viewerReady
                ? preparationAvailable
                  ? "Prêt — annuler"
                  : "Prêt — en attente d’un invité"
                : "Je suis prêt"}
          </button>
        </section>
      </EditableBlock>
      <EditableBlock
        id="multiplayer.lobby"
        locked
        defaultLayout={{ x: 0, y: 0, width: 100, height: 0 }}
      >
        <div className="room-lobby">
          <div className="multiplayer-kicker">
            <Users size={15} /> {gameLabel} partagé
          </div>
          <h1>
            La salle est
            <br />
            <em>ouverte.</em>
          </h1>
          <LobbyTable
            players={players}
            viewerId={viewerId}
            viewerReady={viewerReady}
          />
          {shareBlock}
          {isHost ? (
            <button
              className="room-primary"
              type="button"
              disabled={!canStart || busy}
              onClick={onStart}
            >
              {players.length < 2 ? (
                "En attente d’un joueur…"
              ) : readyPlayers !== players.length ? (
                `En attente des prêts · ${readyPlayers}/${players.length}`
              ) : (
                <>
                  {launchLabel} <ArrowRight size={17} />
                </>
              )}
            </button>
          ) : (
            <div className="room-wait">
              <RotateCcw size={17} /> En attente du lancement.
            </div>
          )}
        </div>
      </EditableBlock>
    </>
  );
}
