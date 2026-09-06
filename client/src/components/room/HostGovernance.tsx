import type { RoomPlayerSummary } from "./types";

export interface HostGovernanceProps {
  players: RoomPlayerSummary[];
  viewerId: number;
  disabled: boolean;
  onTransfer: (playerId: number) => void;
  onLeave: () => void;
  onClose: () => void;
}

/** Commandes explicites de l’hôte : aucun écouteur global du document n’est requis. */
export function HostGovernance({
  players,
  viewerId,
  disabled,
  onTransfer,
  onLeave,
  onClose,
}: HostGovernanceProps) {
  const candidates = players.filter((player) => player.id !== viewerId);
  return (
    <section className="host-governance" aria-label="Gestion de l’hôte">
      <div>
        <p className="mini-label">Hôte</p>
        <b>Gestion de la session</b>
        <span>
          Transférez l’hôte, quittez avec un tirage aléatoire, ou fermez la
          table.
        </span>
      </div>
      {candidates.length > 0 && (
        <div className="host-transfer-list">
          {candidates.map((player) => (
            <button
              key={player.id}
              type="button"
              disabled={disabled}
              onClick={() => onTransfer(player.id)}
            >
              Nommer {player.nickname}
            </button>
          ))}
        </div>
      )}
      <div className="host-governance-actions">
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            if (
              window.confirm(
                "Quitter le salon ? Un joueur sera choisi au hasard comme nouvel hôte.",
              )
            )
              onLeave();
          }}
        >
          Quitter · transfert aléatoire
        </button>
        <button
          className="host-close-session"
          type="button"
          disabled={disabled}
          onClick={() => {
            if (
              window.confirm(
                "Fermer définitivement cette session ? Les joueurs ne pourront plus la rejoindre.",
              )
            )
              onClose();
          }}
        >
          Fermer la session
        </button>
      </div>
    </section>
  );
}
