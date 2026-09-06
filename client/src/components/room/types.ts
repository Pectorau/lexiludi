export type MultiplayerJokerId = "compass" | "tempo" | "second_chance" | "fog" | "shield" | "bonus_attempt" | "random_letter" | "peek" | "opponent_progress" | "exact_letter" | "mana_siphon" | "blackout" | "overclock" | "curse_trap";

export interface RoomPlayerSummary {
  id: number;
  nickname: string;
  isHost?: boolean;
  isReady?: boolean;
  presence?: string;
  score?: number;
  archetype?: "cryptographer" | "berserker" | "banker" | "necromancer";
  mana?: number;
  manaCap?: number;
}

export interface RoomReward {
  id: number;
  joker: MultiplayerJokerId;
}

export interface RoomRoundSummary {
  status?: "active" | "resolved" | "countdown" | string;
  id?: number;
  startedAt?: Date | string | null;
  endsAt?: Date | string | null;
}
