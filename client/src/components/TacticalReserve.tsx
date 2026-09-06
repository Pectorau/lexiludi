import type { ComponentType } from "react";
import {
  Clock3,
  CloudFog,
  Compass,
  BatteryCharging,
  Eye,
  Gauge,
  PlusCircle,
  Radar,
  RotateCcw,
  Shield,
  Skull,
  Sparkles,
  Zap,
} from "lucide-react";
import "@/pages/tactical-reserve.css";

export type TacticalJoker =
  | "compass"
  | "tempo"
  | "second_chance"
  | "fog"
  | "shield"
  | "bonus_attempt"
  | "random_letter"
  | "peek"
  | "opponent_progress"
  | "exact_letter"
  | "mana_siphon"
  | "blackout"
  | "overclock"
  | "curse_trap";

export type CardCategory = "attack" | "defense" | "utility";

export interface TacticalReward {
  id: number;
  joker: TacticalJoker;
  cooldownUntil?: number;
}

export interface TargetPlayer {
  id: number;
  nickname: string;
  presence?: "connecté" | "occupé" | "déconnecté" | string;
  hpRemaining?: number;
  score?: number;
}

export interface TradeOffer {
  id: number;
  fromPlayerId: number;
  fromNickname: string;
  toPlayerId: number;
  toNickname: string;
  offeredLetter: string;
  requestedLetter?: string;
  expiresAt: string;
}

export interface CardConfig {
  label: string;
  detail: string;
  category: CardCategory;
  cost: number;
  targeted: boolean;
  Icon: ComponentType<{ size?: number; className?: string }>;
  requiresSelectedLetter?: boolean;
}

export const TACTICAL_CARDS: Record<TacticalJoker, CardConfig> = {
  compass: {
    label: "Boussole",
    detail: "Révèle la présence d'une voyelle/consonne clé.",
    category: "defense",
    cost: 1,
    targeted: false,
    Icon: Compass,
  },
  tempo: {
    label: "Gel Temporel",
    detail: "+10s au chrono de votre manche.",
    category: "defense",
    cost: 1,
    targeted: false,
    Icon: Clock3,
  },
  second_chance: {
    label: "Seconde Chance",
    detail: "Annule la dernière faute.",
    category: "defense",
    cost: 2,
    targeted: false,
    Icon: RotateCcw,
  },
  fog: {
    label: "Brouillard Noir",
    detail: "Masque l'écran adverse pendant 5s.",
    category: "attack",
    cost: 2,
    targeted: true,
    Icon: CloudFog,
  },
  shield: {
    label: "Bouclier Miroir",
    detail: "Bloque et renvoie le prochain malus.",
    category: "defense",
    cost: 1,
    targeted: false,
    Icon: Shield,
  },
  bonus_attempt: {
    label: "Essai Critique",
    detail: "+1 essai gratuit sur le mot courant.",
    category: "utility",
    cost: 1,
    targeted: false,
    Icon: PlusCircle,
  },
  random_letter: {
    label: "Révélation",
    detail: "Dévoile une lettre non découverte.",
    category: "utility",
    cost: 1,
    targeted: false,
    Icon: Sparkles,
  },
  peek: {
    label: "Infiltration",
    detail: "Copie les 2 derniers indices de la cible.",
    category: "attack",
    cost: 2,
    targeted: true,
    Icon: Eye,
  },
  opponent_progress: {
    label: "Radar Tactique",
    detail: "Affiche le nombre d'essais adverses.",
    category: "utility",
    cost: 1,
    targeted: false,
    Icon: Radar,
  },
  exact_letter: {
    label: "Oeil du Lynx",
    detail: "Place instantanément une lettre verte.",
    category: "utility",
    cost: 3,
    targeted: false,
    Icon: Zap,
    requiresSelectedLetter: true,
  },
  mana_siphon: {
    label: "Siphon énergétique",
    detail: "Transfère jusqu’à 25 PM depuis un adversaire.",
    category: "attack",
    cost: 2,
    targeted: true,
    Icon: BatteryCharging,
  },
  blackout: {
    label: "Blackout",
    detail: "Empêche la cible de valider pendant 4 secondes.",
    category: "attack",
    cost: 3,
    targeted: true,
    Icon: Eye,
  },
  overclock: {
    label: "Overclock",
    detail: "Double les points de votre prochain Motus trouvé.",
    category: "utility",
    cost: 2,
    targeted: false,
    Icon: Gauge,
  },
  curse_trap: {
    label: "Piège maudit",
    detail: "Marque le prochain contrat tactique de la cible.",
    category: "attack",
    cost: 2,
    targeted: true,
    Icon: Skull,
  },
};

const categoryLabels: Record<CardCategory, string> = {
  attack: "Attaque",
  defense: "Défense",
  utility: "Utilitaire",
};

function cooldownLabel(cooldownUntil?: number) {
  if (!cooldownUntil || cooldownUntil <= Date.now()) return null;
  return `Recharge · ${Math.ceil((cooldownUntil - Date.now()) / 1_000)} s`;
}

export function TacticalReserve({
  rewards,
  targets,
  disabled,
  usedJokers,
  lastMessage,
  onUse,
}: {
  rewards: TacticalReward[];
  targets: TargetPlayer[];
  disabled: boolean;
  usedJokers: Set<string>;
  lastMessage?: string | null;
  onUse: (joker: TacticalJoker, targetPlayerId?: number) => void;
}) {
  return (
    <aside
      className="tactical-reserve"
      aria-label="Réserve de cartes tactiques"
    >
      <div className="tactical-reserve-head">
        <div>
          <p>Jokers</p>
          <b>Réserve tactique</b>
        </div>
        <span>
          {rewards.length}
          <small>/3</small>
        </span>
      </div>
      {rewards.length ? (
        <div className="tactical-card-grid">
          {rewards.map((reward) => {
            const card = TACTICAL_CARDS[reward.joker];
            const Icon = card.Icon;
            const cooldown = cooldownLabel(reward.cooldownUntil);
            const unavailable =
              disabled || usedJokers.has(reward.joker) || Boolean(cooldown);
            return (
              <article
                key={reward.id}
                className={`tactical-card is-${card.category} ${unavailable ? "is-unavailable" : ""}`}
              >
                <div className="tactical-card-title">
                  <i>
                    <Icon size={17} />
                  </i>
                  <div>
                    <div className="tactical-card-name">
                      <b>{card.label}</b>
                      <span className="tactical-category">
                        {categoryLabels[card.category]}
                      </span>
                    </div>
                    <small>{card.detail}</small>
                  </div>
                </div>
                <div className="tactical-card-footer">
                  <span
                    className="tactical-cost"
                    aria-label={`Niveau tactique ${card.cost}`}
                  >
                    <Zap size={12} /> Niveau {card.cost}
                  </span>
                  {cooldown ? (
                    <span className="tactical-cooldown">{cooldown}</span>
                  ) : card.targeted ? (
                    <div
                      className="tactical-target-list"
                      aria-label={`Cible pour ${card.label}`}
                    >
                      {targets.length ? (
                        targets.map((target) => (
                          <button
                            key={target.id}
                            type="button"
                            disabled={unavailable}
                            onClick={() => onUse(reward.joker, target.id)}
                          >
                            Viser {target.nickname}
                          </button>
                        ))
                      ) : (
                        <span>Aucun adversaire</span>
                      )}
                    </div>
                  ) : (
                    <button
                      className="tactical-activate"
                      type="button"
                      disabled={unavailable}
                      onClick={() => onUse(reward.joker)}
                    >
                      Activer
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="tactical-empty">
          Réserve vide · Trouvez un mot ou remportez une manche pour piocher un
          joker
        </p>
      )}
      {lastMessage && (
        <p className="tactical-reward-message" role="status">
          {lastMessage}
        </p>
      )}
    </aside>
  );
}
