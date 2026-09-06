import { Check, CopyPlus, Send, X } from "lucide-react";
import { useMemo, useState } from "react";
import "@/pages/knowledge-exchange.css";

export type IncomingTradeOffer = {
  id: number;
  fromPlayerId: number;
  fromNickname: string;
  offeredLetter: string;
  expiresAt: string;
};
export type OutgoingTradeOffer = {
  id: number;
  toPlayerId: number;
  toNickname: string;
  offeredLetter: string;
  expiresAt: string;
};
export type TradePlayerTarget = {
  id: number;
  nickname: string;
  presence?: string;
};

function normalizeLetters(letters: string[]) {
  return Array.from(
    new Set(
      letters
        .map((letter) => letter.trim().toLocaleUpperCase("fr-FR"))
        .filter((letter) => /^[A-Z]$/.test(letter)),
    ),
  ).sort();
}

export function LetterTradeDock({
  players,
  currentUserId,
  knownLetters,
  incoming,
  outgoing,
  disabled,
  onPropose,
  onRespond,
  onCancel,
}: {
  players: TradePlayerTarget[];
  currentUserId: number;
  knownLetters: string[];
  incoming: IncomingTradeOffer | null;
  outgoing: OutgoingTradeOffer | null;
  disabled?: boolean;
  onPropose: (targetPlayerId: number, letter: string) => Promise<void>;
  onRespond: (
    tradeId: number,
    accept: boolean,
    returnLetter?: string,
  ) => Promise<void>;
  onCancel: (tradeId: number) => Promise<void>;
}) {
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  const [selectedReplyLetter, setSelectedReplyLetter] = useState<string | null>(
    null,
  );
  const [draggedLetter, setDraggedLetter] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const letters = useMemo(() => normalizeLetters(knownLetters), [knownLetters]);
  const targets = useMemo(
    () => players.filter((player) => player.id !== currentUserId),
    [players, currentUserId],
  );
  const replyLetters = useMemo(
    () =>
      incoming
        ? letters.filter((letter) => letter !== incoming.offeredLetter)
        : [],
    [incoming, letters],
  );
  const outgoingIsActive = Boolean(
    outgoing && new Date(outgoing.expiresAt).getTime() > Date.now(),
  );

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 2_800);
  }

  async function propose(target: TradePlayerTarget, letter: string) {
    if (disabled || pending || outgoingIsActive || !letters.includes(letter))
      return;
    setPending(true);
    try {
      await onPropose(target.id, letter);
      setSelectedLetter(null);
      notify(
        `Proposition de connaissance « ${letter} » envoyée à @${target.nickname}`,
      );
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "La proposition n’a pas été envoyée.",
      );
    } finally {
      setDraggedLetter(null);
      setPending(false);
    }
  }

  async function reply(accept: boolean) {
    if (!incoming || pending) return;
    if (accept && !selectedReplyLetter) {
      notify("Choisissez la connaissance que vous partagez en retour.");
      return;
    }
    setPending(true);
    try {
      await onRespond(incoming.id, accept, selectedReplyLetter ?? undefined);
      setSelectedReplyLetter(null);
      notify(
        accept
          ? "Échange accepté : vos deux connaissances restent actives."
          : "Proposition refusée.",
      );
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "La réponse n’a pas été enregistrée.",
      );
    } finally {
      setPending(false);
    }
  }

  async function cancelOutgoing() {
    if (!outgoing || pending) return;
    setPending(true);
    try {
      await onCancel(outgoing.id);
      notify("Proposition de connaissance annulée.");
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "La proposition n’a pas pu être annulée.",
      );
    } finally {
      setPending(false);
    }
  }

  if (!targets.length) return null;
  return (
    <aside
      className="knowledge-exchange"
      aria-label="Échange de connaissances Motus"
    >
      <div className="knowledge-exchange-line">
        <span className="knowledge-exchange-label">
          <CopyPlus size={14} /> Connaissances
        </span>
        <div
          className="knowledge-letter-strip"
          aria-label="Vos lettres vérifiées à partager"
        >
          {letters.length ? (
            letters.map((letter) => (
              <button
                key={letter}
                type="button"
                draggable={!disabled && !outgoingIsActive}
                className={`${selectedLetter === letter ? "is-selected" : ""} ${draggedLetter === letter ? "is-dragging" : ""}`}
                disabled={disabled || pending || outgoingIsActive}
                onClick={() =>
                  setSelectedLetter((current) =>
                    current === letter ? null : letter,
                  )
                }
                onDragStart={(event) => {
                  setDraggedLetter(letter);
                  event.dataTransfer.effectAllowed = "copy";
                  event.dataTransfer.setData("text/plain", letter);
                }}
                onDragEnd={() => setDraggedLetter(null)}
                aria-label={`Copier la connaissance ${letter}`}
              >
                {letter}
              </button>
            ))
          ) : (
            <small>Une lettre vérifiée suffit.</small>
          )}
        </div>
        <div className="knowledge-targets" aria-label="Partager avec">
          {targets.map((target) => (
            <button
              key={target.id}
              type="button"
              className={draggedLetter ? "is-drop-target" : ""}
              disabled={
                disabled || pending || outgoingIsActive || !letters.length
              }
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const letter =
                  event.dataTransfer.getData("text/plain") || draggedLetter;
                if (letter) void propose(target, letter);
              }}
              onClick={() => {
                if (selectedLetter) void propose(target, selectedLetter);
              }}
            >
              <i
                className={
                  target.presence === "connecté" ? "is-online" : "is-idle"
                }
                aria-hidden="true"
              />
              {target.nickname}
            </button>
          ))}
        </div>
      </div>
      {outgoingIsActive && outgoing && (
        <div className="knowledge-outgoing" role="status">
          <span>
            Proposition <strong>{outgoing.offeredLetter}</strong> envoyée à{" "}
            <b>@{outgoing.toNickname}</b>
          </span>
          <button
            type="button"
            disabled={disabled || pending}
            onClick={() => void cancelOutgoing()}
            title="Annuler la proposition"
            aria-label="Annuler la proposition de connaissance"
          >
            <X size={14} />
          </button>
        </div>
      )}
      {incoming && (
        <div className="knowledge-reply" role="status">
          <span>
            <b>{incoming.fromNickname}</b> copie{" "}
            <strong>{incoming.offeredLetter}</strong>
          </span>
          <div className="knowledge-reply-letters">
            {replyLetters.map((letter) => (
              <button
                key={letter}
                type="button"
                disabled={disabled || pending}
                className={selectedReplyLetter === letter ? "is-selected" : ""}
                onClick={() => setSelectedReplyLetter(letter)}
              >
                {letter}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={disabled || pending || !selectedReplyLetter}
            onClick={() => void reply(true)}
            title="Partager la lettre choisie"
          >
            <Check size={14} />
          </button>
          <button
            type="button"
            disabled={disabled || pending}
            onClick={() => void reply(false)}
            title="Refuser l’échange"
          >
            <X size={14} />
          </button>
        </div>
      )}
      {toast && (
        <p className="knowledge-toast" role="status">
          {pending ? <Send size={13} /> : <Check size={13} />}
          {toast}
        </p>
      )}
    </aside>
  );
}
