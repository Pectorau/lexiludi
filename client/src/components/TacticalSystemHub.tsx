import {
  ArrowRightLeft,
  BatteryCharging,
  Check,
  ChevronDown,
  CopyPlus,
  Gavel,
  ScrollText,
  Send,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  TACTICAL_CARDS,
  type TacticalJoker,
  type TacticalReward,
  type TargetPlayer,
} from "@/components/TacticalReserve";
import type {
  IncomingTradeOffer,
  OutgoingTradeOffer,
} from "@/components/TradeDock";
import { useGameAudio } from "@/hooks/useGameAudio";
import "@/pages/tactical-system-hub.css";

export type TacticalContract = {
  id: number;
  type: "letter" | "cryptohint" | "mana";
  fromPlayerId: number;
  fromNickname: string;
  targetPlayerId: number | null;
  offeredLetter: string | null;
  hint: {
    isVowel?: boolean;
    alphabetHalf?: string;
    scrabbleTier?: string;
  } | null;
  minimumBid: number;
  status: "open" | "awarded" | "expired" | "cancelled";
  expiresAt: Date | string;
  highestBid: { playerId: number; nickname: string; manaAmount: number } | null;
};

export type LetterStatus = "correct" | "present" | "absent";
export type MarkedLetter = { letter: string; status: LetterStatus };

type PendingAction =
  | { kind: "joker"; joker: TacticalJoker; targetId?: number }
  | { kind: "trade"; targetId: number };

function cleanMarkedLetters(letters: MarkedLetter[]) {
  const seen = new Map<string, LetterStatus>();
  letters.forEach(({ letter, status }) => {
    const normalized = letter.trim().toLocaleUpperCase("fr-FR");
    if (!/^[A-Z]$/.test(normalized) || status === "absent") return;
    if (status === "correct" || !seen.has(normalized))
      seen.set(normalized, status);
  });
  return Array.from(seen, ([letter, status]) => ({ letter, status })).sort(
    (a, b) => a.letter.localeCompare(b.letter, "fr"),
  );
}

function archetypeLabel(archetype: string) {
  return (
    (
      {
        cryptographer: "Cryptographe",
        berserker: "Berserker",
        banker: "Banquier",
        necromancer: "Nécromancien",
      } as Record<string, string>
    )[archetype] ?? archetype
  );
}

export function TacticalSystemHub({
  currentUserId,
  players,
  markedLetters,
  rewards,
  usedJokers,
  incomingTrade,
  outgoingTrade,
  roundActive,
  isProcessing = false,
  mana,
  manaCap,
  archetype,
  contracts,
  onUseJoker,
  onSendTrade,
  onRespondTrade,
  onCancelTrade,
  onOpenContract = async () => {
    throw new Error("Contrats indisponibles.");
  },
  onBidContract = async () => {
    throw new Error("Enchères indisponibles.");
  },
  onResolveContract = async () => {
    throw new Error("Contrats indisponibles.");
  },
}: {
  currentUserId: number;
  players: TargetPlayer[];
  markedLetters: MarkedLetter[];
  rewards: TacticalReward[];
  usedJokers: Set<TacticalJoker>;
  incomingTrade: IncomingTradeOffer | null;
  outgoingTrade: OutgoingTradeOffer | null;
  roundActive: boolean;
  isProcessing?: boolean;
  mana?: number;
  manaCap?: number;
  archetype?: string;
  contracts?: TacticalContract[];
  onUseJoker: (joker: TacticalJoker, targetId?: number) => Promise<void>;
  onSendTrade: (targetId: number, letter: string) => Promise<void>;
  onRespondTrade: (
    tradeId: number,
    accept: boolean,
    returnLetter?: string,
  ) => Promise<void>;
  onCancelTrade: (tradeId: number) => Promise<void>;
  onOpenContract?: (
    type: "letter" | "cryptohint",
    letter: string,
  ) => Promise<void>;
  onBidContract?: (contractId: number, manaAmount: number) => Promise<void>;
  onResolveContract?: (contractId: number) => Promise<void>;
}) {
  const [deckOpen, setDeckOpen] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  const [selectedReplyLetter, setSelectedReplyLetter] = useState<string | null>(
    null,
  );
  const [targeting, setTargeting] = useState<TacticalJoker | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null,
  );
  const [toast, setToast] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const play = useGameAudio();
  const letters = useMemo(
    () => cleanMarkedLetters(markedLetters),
    [markedLetters],
  );
  const targets = useMemo(
    () =>
      players.filter(
        (player) =>
          player.id !== currentUserId &&
          player.presence !== "déconnecté" &&
          player.presence !== "hors ligne",
      ),
    [players, currentUserId],
  );
  const outgoingSeconds = outgoingTrade
    ? Math.max(
        0,
        Math.ceil((new Date(outgoingTrade.expiresAt).getTime() - now) / 1_000),
      )
    : 0;
  const incomingSeconds = incomingTrade
    ? Math.max(
        0,
        Math.ceil((new Date(incomingTrade.expiresAt).getTime() - now) / 1_000),
      )
    : 0;
  const openContracts = (contracts ?? []).filter(
    (contract) =>
      contract.status === "open" &&
      new Date(contract.expiresAt).getTime() > now,
  );

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 3_000);
  }

  async function useCard(joker: TacticalJoker, targetId?: number) {
    if (!roundActive || isProcessing || usedJokers.has(joker)) return;
    try {
      if (soundEnabled)
        play(
          TACTICAL_CARDS[joker].category === "attack" ? "warning" : "success",
        );
      await onUseJoker(joker, targetId);
      setTargeting(null);
      notify(`${TACTICAL_CARDS[joker].label} activé.`);
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Activation indisponible.",
      );
    }
  }

  async function sendTrade(targetId: number) {
    if (!selectedLetter || outgoingSeconds || !roundActive) return;
    try {
      await onSendTrade(targetId, selectedLetter);
      if (soundEnabled) play("card");
      notify(`Proposition de connaissance « ${selectedLetter} » envoyée.`);
      setSelectedLetter(null);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Échange indisponible.");
    }
  }

  async function confirmPendingAction() {
    const action = pendingAction;
    if (!action) return;
    setPendingAction(null);
    if (action.kind === "trade") {
      await sendTrade(action.targetId);
      return;
    }
    await useCard(action.joker, action.targetId);
  }

  async function resolveTrade(accept: boolean) {
    if (!incomingTrade || (accept && !selectedReplyLetter)) {
      if (accept) notify("Choisissez la lettre à partager en retour.");
      return;
    }
    try {
      await onRespondTrade(
        incomingTrade.id,
        accept,
        selectedReplyLetter ?? undefined,
      );
      if (soundEnabled) play(accept ? "success" : "card");
      setSelectedReplyLetter(null);
      notify(
        accept
          ? "Échange conclu : chaque connaissance reste disponible."
          : "Proposition déclinée.",
      );
    } catch (error) {
      notify(error instanceof Error ? error.message : "Réponse indisponible.");
    }
  }

  async function openContract(type: "letter" | "cryptohint") {
    if (!selectedLetter) {
      notify("Choisissez une lettre vérifiée à engager.");
      return;
    }
    try {
      await onOpenContract(type, selectedLetter);
      notify(
        type === "letter"
          ? "Contrat de lettre ouvert."
          : "Indice cryptographique mis aux enchères.",
      );
      setSelectedLetter(null);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Contrat indisponible.");
    }
  }

  async function bid(contract: TacticalContract) {
    const bidValue = Math.max(
      contract.minimumBid,
      (contract.highestBid?.manaAmount ?? 0) + 5,
    );
    try {
      await onBidContract(contract.id, bidValue);
      notify(`Enchère de ${bidValue} PM déposée.`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Enchère indisponible.");
    }
  }

  const pendingLabel =
    pendingAction?.kind === "trade"
      ? `Proposer la connaissance « ${selectedLetter ?? "?"} » à @${targets.find((target) => target.id === pendingAction.targetId)?.nickname ?? "ce joueur"} ?`
      : pendingAction
        ? `Activer ${TACTICAL_CARDS[pendingAction.joker].label} ?`
        : "";

  if (mana === undefined || manaCap === undefined || !archetype || !contracts)
    return null;

  return (
    <aside
      className="tactical-system-hub"
      aria-label="Centre tactique de manche"
    >
      <section className="tactical-resource" aria-label="Ressource tactique">
        <span>
          <BatteryCharging size={15} /> {archetypeLabel(archetype)}
        </span>
        <b>
          {mana}
          <small>/{manaCap} PM</small>
        </b>
        <i>
          <em
            style={{
              width: `${Math.min(100, (mana / Math.max(1, manaCap)) * 100)}%`,
            }}
          />
        </i>
      </section>

      <section className="tactical-trade" aria-label="Marché des connaissances">
        <header>
          <span>
            <ArrowRightLeft size={15} /> Marché des connaissances
          </span>
          <button
            type="button"
            onClick={() => setSoundEnabled((enabled) => !enabled)}
            aria-label={soundEnabled ? "Couper les sons" : "Activer les sons"}
          >
            {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
          </button>
        </header>
        <div className="tactical-letter-row">
          {letters.length ? (
            letters.map(({ letter, status }) => (
              <button
                key={letter}
                type="button"
                className={`letter-badge is-${status} ${selectedLetter === letter ? "is-selected" : ""}`}
                disabled={
                  !roundActive || isProcessing || Boolean(outgoingSeconds)
                }
                onClick={() =>
                  setSelectedLetter((current) =>
                    current === letter ? null : letter,
                  )
                }
                title={
                  status === "correct"
                    ? `${letter} : bien placée`
                    : `${letter} : présente ailleurs`
                }
              >
                {letter}
              </button>
            ))
          ) : (
            <small>Aucune lettre vérifiée à partager.</small>
          )}
        </div>
        {selectedLetter && !outgoingSeconds && (
          <div className="tactical-trade-targets">
            <span>
              Proposer <b>{selectedLetter}</b> à
            </span>
            {targets.map((target) => (
              <button
                key={target.id}
                type="button"
                disabled={isProcessing}
                onClick={() =>
                  setPendingAction({ kind: "trade", targetId: target.id })
                }
              >
                @{target.nickname}
              </button>
            ))}
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => void openContract("letter")}
            >
              Contrat
            </button>
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => void openContract("cryptohint")}
            >
              Indice chiffré
            </button>
          </div>
        )}
        {outgoingTrade && outgoingSeconds > 0 && (
          <div className="tactical-offer">
            <span>
              Lettre <b>{outgoingTrade.offeredLetter}</b> en attente ·{" "}
              {outgoingSeconds}s
            </span>
            <button
              type="button"
              onClick={() => void onCancelTrade(outgoingTrade.id)}
              disabled={isProcessing}
            >
              <X size={14} /> Annuler
            </button>
          </div>
        )}
        {incomingTrade && incomingSeconds > 0 && (
          <div className="tactical-incoming">
            <p>
              <b>@{incomingTrade.fromNickname}</b> propose{" "}
              <strong>{incomingTrade.offeredLetter}</strong> · {incomingSeconds}
              s
            </p>
            <div>
              {letters
                .filter(({ letter }) => letter !== incomingTrade.offeredLetter)
                .map(({ letter, status }) => (
                  <button
                    key={letter}
                    type="button"
                    className={`letter-badge is-${status} ${selectedReplyLetter === letter ? "is-selected" : ""}`}
                    onClick={() => setSelectedReplyLetter(letter)}
                  >
                    {letter}
                  </button>
                ))}
            </div>
            <footer>
              <button
                type="button"
                disabled={!selectedReplyLetter || isProcessing}
                onClick={() => void resolveTrade(true)}
              >
                <Check size={14} /> Échanger
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => void resolveTrade(false)}
              >
                <X size={14} />
              </button>
            </footer>
          </div>
        )}
      </section>

      <section className="tactical-contracts" aria-label="Contrats tactiques">
        <header>
          <span>
            <ScrollText size={15} /> Contrats
          </span>
          <small>
            {openContracts.length} ouvert{openContracts.length > 1 ? "s" : ""}
          </small>
        </header>
        {openContracts.length ? (
          openContracts.map((contract) => {
            const seconds = Math.max(
              0,
              Math.ceil((new Date(contract.expiresAt).getTime() - now) / 1_000),
            );
            const isOwner = contract.fromPlayerId === currentUserId;
            const nextBid = Math.max(
              contract.minimumBid,
              (contract.highestBid?.manaAmount ?? 0) + 5,
            );
            return (
              <article key={contract.id}>
                <p>
                  <b>
                    {contract.type === "cryptohint"
                      ? "Indice chiffré"
                      : contract.type === "letter"
                        ? `Lettre ${contract.offeredLetter ?? "?"}`
                        : "Mana"}
                  </b>
                  <span>
                    @{contract.fromNickname} · {seconds}s
                  </span>
                </p>
                {contract.hint && (
                  <small>
                    {contract.hint.isVowel ? "Voyelle" : "Consonne"} ·{" "}
                    {contract.hint.alphabetHalf} · {contract.hint.scrabbleTier}
                  </small>
                )}
                <footer>
                  {contract.highestBid ? (
                    <span>
                      Meilleure offre : {contract.highestBid.manaAmount} PM
                    </span>
                  ) : (
                    <span>Mise min. {contract.minimumBid} PM</span>
                  )}
                  {isOwner ? (
                    <button
                      type="button"
                      disabled={isProcessing || !contract.highestBid}
                      onClick={() => void onResolveContract(contract.id)}
                    >
                      Conclure
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={isProcessing || nextBid > mana}
                      onClick={() => void bid(contract)}
                    >
                      <Gavel size={13} /> {nextBid} PM
                    </button>
                  )}
                </footer>
              </article>
            );
          })
        ) : (
          <p>Engagez une lettre vérifiée pour ouvrir un contrat.</p>
        )}
      </section>

      <section className="tactical-hub-deck" aria-label="Réserve tactique">
        <button
          className="tactical-hub-deck-trigger"
          type="button"
          aria-expanded={deckOpen}
          onClick={() => {
            if (soundEnabled) play("card");
            setDeckOpen((open) => !open);
          }}
        >
          <span>
            <CopyPlus size={15} /> Réserve tactique <b>{rewards.length}/3</b>
          </span>
          <ChevronDown size={17} />
        </button>
        {deckOpen && (
          <div className="tactical-hub-cards">
            {rewards.length ? (
              rewards.map((reward) => {
                const card = TACTICAL_CARDS[reward.joker];
                const Icon = card.Icon;
                const linkedToLetter = Boolean(card.requiresSelectedLetter);
                const disabled =
                  !roundActive ||
                  isProcessing ||
                  usedJokers.has(reward.joker) ||
                  (linkedToLetter && !selectedLetter);
                return (
                  <article
                    key={reward.id}
                    className={`hub-card is-${card.category} ${targeting === reward.joker ? "is-targeting" : ""} ${linkedToLetter && selectedLetter ? "is-linked-highlight" : ""}`}
                  >
                    <div>
                      <Icon size={16} />
                      <b>{card.label}</b>
                    </div>
                    <p>{card.detail}</p>
                    {card.targeted ? (
                      targeting === reward.joker ? (
                        <footer>
                          {targets.map((target) => (
                            <button
                              key={target.id}
                              type="button"
                              disabled={disabled}
                              onClick={() =>
                                setPendingAction({
                                  kind: "joker",
                                  joker: reward.joker,
                                  targetId: target.id,
                                })
                              }
                            >
                              Viser @{target.nickname}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => setTargeting(null)}
                          >
                            Retour
                          </button>
                        </footer>
                      ) : (
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => setTargeting(reward.joker)}
                        >
                          Choisir une cible
                        </button>
                      )
                    ) : (
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() =>
                          setPendingAction({
                            kind: "joker",
                            joker: reward.joker,
                          })
                        }
                      >
                        Activer · Niv. {card.cost}
                      </button>
                    )}
                  </article>
                );
              })
            ) : (
              <p className="tactical-hub-empty">
                Aucun joker en stock. Validez un mot pour piocher.
              </p>
            )}
          </div>
        )}
      </section>

      {pendingAction && (
        <div
          className="tactical-confirm"
          role="dialog"
          aria-live="polite"
          aria-label="Confirmer l’action tactique"
        >
          <span>{pendingLabel}</span>
          <button
            type="button"
            onClick={() => void confirmPendingAction()}
            disabled={isProcessing}
          >
            <Check size={14} /> Confirmer
          </button>
          <button
            type="button"
            onClick={() => setPendingAction(null)}
            disabled={isProcessing}
            aria-label="Annuler l’action tactique"
          >
            <X size={14} />
          </button>
        </div>
      )}
      {toast && (
        <p className="tactical-hub-toast" role="status">
          <Send size={14} />
          {toast}
        </p>
      )}
    </aside>
  );
}
