import {
  ArrowLeft,
  ArrowRight,
  Check,
  CloudFog,
  Clock3,
  Copy,
  Crown,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  Globe2,
  LockKeyhole,
  PanelLeftClose,
  PanelLeftOpen,
  QrCode as QrCodeIcon,
  RotateCcw,
  Sparkles,
  Timer,
  UserRoundPen,
  Users,
  X,
  Zap,
} from "lucide-react";
import QRCode from "qrcode";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useLocation, useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { RoomLobby } from "@/components/room/RoomLobby";
import { HostGovernance } from "@/components/room/HostGovernance";
import { QuizView } from "@/components/game-modes/QuizView";
import { MotusView } from "@/components/game-modes/MotusView";
import { DefinitionView } from "@/components/game-modes/DefinitionView";
import { EditableBlock } from "@/components/editable-block";
import { EditToolbar } from "@/components/edit-toolbar";
import { ResponsiveEditorSidebar } from "@/components/responsive-editor-sidebar";
import { VisualEditorProvider } from "@/components/visual-editor-context";
import { getRoomRecoveryPath } from "@/lib/roomRecovery";
import {
  getMotusAttemptFeedback,
  type MotusAttemptFeedback,
} from "@/lib/motusAttemptFeedback";
import { getLatestRoomSystemAnnouncement } from "@/lib/roomSystemAnnouncement";
import { useRoomTimers } from "@/hooks/useRoomTimers";
import {
  getMotusKeyboardStates,
  MOTUS_KEYBOARD,
  normalizeGameWord,
  type MotusLetterState,
} from "@shared/motus";
import "./definition-match.css";
import "./lobby-compact.css";
import "./multiplayer-qr.css";
import "./multiplayer-room-extensions.css";
import "./motus-direct-grid.css";
import "./host-governance.css";
import "./room-system-announcement.css";

type LetterState = MotusLetterState;
type Submission = {
  payload: string;
  feedback: LetterState[] | null;
  isCorrect: boolean;
  points: number;
  attemptIndex: number;
};
type SharedSubmission = Submission & { playerId: number; nickname: string };
type DefinitionWord = { entryId: number; lemma: string; cnrtlUrl?: string };
type DefinitionItem = { definitionId: number; text: string };
type DefinitionSolution = {
  entryId: number;
  definitionId: number;
  lemma: string;
  text: string;
  cnrtlUrl?: string;
};

function getStoredToken(code: string) {
  if (typeof window === "undefined") return null;
  const key = `motif-room:${code}`;
  const activeToken = window.sessionStorage.getItem(key);
  if (activeToken) return activeToken;
  // Migration unique des anciens jetons persistants : ils quittent définitivement le disque.
  const legacyToken = window.localStorage.getItem(key);
  if (legacyToken) {
    window.sessionStorage.setItem(key, legacyToken);
    window.localStorage.removeItem(key);
  }
  return legacyToken;
}

function saveToken(code: string, token: string) {
  const key = `motif-room:${code}`;
  window.sessionStorage.setItem(key, token);
  window.localStorage.removeItem(key);
  window.dispatchEvent(new Event("motif-room-token"));
}

function parseDefinitionPayload(payload: string) {
  try {
    return JSON.parse(payload) as { entryId?: number; definitionId?: number };
  } catch {
    return {};
  }
}

function formatRemainingTime(milliseconds: number) {
  const totalSeconds = Math.ceil(milliseconds / 1000);
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

function PlayerActivity({
  submissions,
  gameMode,
  words,
  definitions,
  watching,
  motusMaxAttempts = 0,
}: {
  submissions: SharedSubmission[];
  gameMode: "quiz" | "motus" | "definition";
  words: DefinitionWord[];
  definitions: DefinitionItem[];
  watching?: boolean;
  motusMaxAttempts?: number;
}) {
  if (!submissions.length)
    return (
      <div className="player-activity is-empty">
        <Eye size={14} />
        <span>
          {watching
            ? "Vous avez trouvé : les essais des joueurs restants apparaîtront ici."
            : "Les réponses des autres joueurs apparaîtront ici."}
        </span>
      </div>
    );
  return (
    <section
      className="player-activity"
      aria-label="Réponses des autres joueurs"
    >
      <div className="activity-heading">
        <Eye size={14} />
        <span>{watching ? "Joueurs encore en piste" : "En direct"}</span>
      </div>
      <div className="activity-list">
        {submissions.map((submission, index) => {
          const definitionPayload =
            gameMode === "definition"
              ? parseDefinitionPayload(submission.payload)
              : {};
          const word = words.find(
            (item) => item.entryId === definitionPayload.entryId,
          )?.lemma;
          const definitionIndex = definitions.findIndex(
            (item) => item.definitionId === definitionPayload.definitionId,
          );
          const label =
            gameMode === "definition"
              ? definitions.length
                ? `${word ?? "Mot"} → définition ${definitionIndex >= 0 ? definitionIndex + 1 : "?"}`
                : (word ?? "Choix relationnel")
              : gameMode === "motus"
                ? submission.payload.toUpperCase()
                : submission.payload;
          const isLastAttempt =
            gameMode === "motus" &&
            !submission.isCorrect &&
            motusMaxAttempts > 0 &&
            submission.attemptIndex >= motusMaxAttempts - 1;
          return (
            <div
              className={`activity-entry ${submission.isCorrect ? "is-correct" : "is-wrong"} ${isLastAttempt ? "is-last-attempt" : ""}`}
              key={`${submission.playerId}-${submission.attemptIndex}-${index}`}
            >
              <b>{submission.nickname}</b>
              <span>{label}</span>
              {gameMode === "motus" && submission.feedback && (
                <i>
                  {submission.feedback.map((state, feedbackIndex) => (
                    <em key={feedbackIndex} className={`state-${state}`} />
                  ))}
                </i>
              )}
              <small>
                {submission.isCorrect
                  ? `+${submission.points} pts`
                  : isLastAttempt
                    ? "dernier essai"
                    : "erreur"}
              </small>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function InviteQrCode({ url, onClose }: { url: string; onClose: () => void }) {
  const [imageUrl, setImageUrl] = useState("");
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let active = true;
    void QRCode.toDataURL(url, {
      width: 240,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#15171d", light: "#f8f8f5" },
    }).then((value) => {
      if (active) setImageUrl(value);
    });
    return () => {
      active = false;
    };
  }, [url]);

  useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="qr-popover"
      role="dialog"
      aria-modal="true"
      aria-label="QR code du salon"
    >
      <button
        ref={closeRef}
        className="qr-close"
        type="button"
        onClick={onClose}
        aria-label="Fermer le QR code"
      >
        <X size={16} />
      </button>
      <p className="mini-label">Invitation mobile</p>
      {imageUrl ? (
        <img src={imageUrl} alt="QR code vers ce salon motif." />
      ) : (
        <div className="qr-placeholder">Génération…</div>
      )}
      <b>Scannez pour rejoindre</b>
      <span>Scannez ce code ; appuyez sur Échap pour revenir à la table.</span>
    </div>
  );
}

function InviteQrThumbnail({ url }: { url: string }) {
  const [imageUrl, setImageUrl] = useState("");
  useEffect(() => {
    let active = true;
    void QRCode.toDataURL(url, {
      width: 132,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#15171d", light: "#f8f8f5" },
    }).then((value) => {
      if (active) setImageUrl(value);
    });
    return () => {
      active = false;
    };
  }, [url]);
  return (
    <div className="lobby-qr-thumbnail" aria-label="QR code du salon">
      {imageUrl ? (
        <img src={imageUrl} alt="QR code à scanner pour rejoindre ce salon" />
      ) : (
        <span>QR…</span>
      )}
    </div>
  );
}

function TimedRoomLoading({
  label,
  onRetry,
}: {
  label: string;
  onRetry?: () => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const startedAt = Date.now();
    const timer = window.setInterval(
      () => setElapsed(Date.now() - startedAt),
      500,
    );
    return () => window.clearInterval(timer);
  }, []);
  const isSlow = elapsed >= 3_000;
  const canRetry = elapsed >= 8_000;
  return (
    <div className="stage-loading" role="status" aria-live="polite">
      <p>
        {canRetry
          ? "La connexion semble bloquée."
          : isSlow
            ? "La connexion prend plus de temps que prévu…"
            : label}
      </p>
      {canRetry && (
        <div className="loading-actions">
          <button type="button" onClick={onRetry}>
            Réessayer
          </button>
          <Link className="room-secondary" href="/">
            Retour aux jeux
          </Link>
        </div>
      )}
    </div>
  );
}

export default function MultiplayerRoom() {
  const [, params] = useRoute("/multijoueur/:code");
  const [location, setLocation] = useLocation();
  const code = params?.code?.toUpperCase() ?? "";
  const requestedRecoveryMode = new URLSearchParams(
    location.split("?")[1] ?? "",
  ).get("from");
  const [resumeToken, setResumeToken] = useState(() => getStoredToken(code));
  const [nickname, setNickname] = useState("");
  const [motusGuess, setMotusGuess] = useState("");
  const [motusFeedback, setMotusFeedback] =
    useState<MotusAttemptFeedback | null>(null);
  const [message, setMessage] = useState("");
  const [showQr, setShowQr] = useState(false);
  const [roomInfoOpen, setRoomInfoOpen] = useState(true);
  const [selectedDefinitionEntryId, setSelectedDefinitionEntryId] = useState<
    number | null
  >(null);
  const [editingRoom, setEditingRoom] = useState(false);
  const [roomTitle, setRoomTitle] = useState("");
  const [roomVisibility, setRoomVisibility] = useState<"private" | "public">(
    "private",
  );
  const [roomRoundLimit, setRoomRoundLimit] = useState(5);
  const [roomRoundDuration, setRoomRoundDuration] = useState(75);
  const [roomShowSubmissions, setRoomShowSubmissions] = useState(true);
  const [roomHardcore, setRoomHardcore] = useState(false);
  const [editingNickname, setEditingNickname] = useState(false);
  const [nicknameDraft, setNicknameDraft] = useState("");
  const [optimisticReady, setOptimisticReady] = useState<boolean | null>(null);
  const autoAdvanceRoundRef = useRef<number | null>(null);
  const motusInputField = useRef<HTMLInputElement>(null);
  const motusFeedbackTimerRef = useRef<number | null>(null);
  const queryInput = {
    code: code || "AAAAAA",
    resumeToken: resumeToken ?? "reprise-indisponible-000000",
  };
  const room = trpc.multiplayer.state.useQuery(queryInput, {
    enabled: Boolean(code && resumeToken),
    refetchInterval: 750,
    refetchOnWindowFocus: true,
    retry: false,
  });
  const roomPreview = trpc.multiplayer.preview.useQuery(
    { code: code || "AAAAAA" },
    {
      enabled: Boolean(code && !resumeToken && /^[A-Z2-9]{6}$/.test(code)),
      retry: false,
    },
  );
  const joinRoom = trpc.multiplayer.join.useMutation();
  const startRound = trpc.multiplayer.startRound.useMutation();
  const nextRound = trpc.multiplayer.nextRound.useMutation();
  const finishRoom = trpc.multiplayer.finish.useMutation();
  const closeRoom = trpc.multiplayer.close.useMutation();
  const transferHost = trpc.multiplayer.transferHost.useMutation();
  const leaveRoom = trpc.multiplayer.leave.useMutation();
  const rematchRoom = trpc.multiplayer.rematch.useMutation();
  const answerQuiz = trpc.multiplayer.answerQuiz.useMutation();
  const attemptMotus = trpc.multiplayer.attemptMotus.useMutation();
  const answerDefinition = trpc.multiplayer.answerDefinition.useMutation();
  const updateRoom = trpc.multiplayer.updateRoom.useMutation();
  const renamePlayer = trpc.multiplayer.renamePlayer.useMutation();
  const kickPlayer = trpc.multiplayer.kickPlayer.useMutation();
  const setReady = trpc.multiplayer.setReady.useMutation();
  const state = room.data;
  const latestSystemAnnouncement = getLatestRoomSystemAnnouncement(
    state?.events,
  );
  const {
    now,
    timerMilliseconds: roomTimerMilliseconds,
    countdownMilliseconds: roomCountdownMilliseconds,
    fogMilliseconds: roomFogMilliseconds,
    peekMilliseconds: roomPeekMilliseconds,
  } = useRoomTimers(state?.round);
  useEffect(() => {
    const errorMessage = room.error?.message ?? "";
    if (
      !room.isError ||
      !resumeToken ||
      !errorMessage.includes("Votre accès à ce salon n’est plus valide")
    )
      return;
    window.localStorage.removeItem(`motif-room:${code}`);
    setResumeToken(null);
    setMessage(
      "Votre reprise de table a expiré. Choisissez une signature pour la rejoindre de nouveau.",
    );
  }, [code, resumeToken, room.error?.message, room.isError]);
  const roundData = (state?.round?.data ?? {}) as Record<string, unknown>;
  const mySubmissions = (state?.round?.mySubmissions ?? []) as Submission[];
  const sharedSubmissions = (state?.round?.otherSubmissions ??
    []) as SharedSubmission[];
  const isBusy =
    startRound.isPending ||
    nextRound.isPending ||
    finishRoom.isPending ||
    closeRoom.isPending ||
    transferHost.isPending ||
    leaveRoom.isPending ||
    rematchRoom.isPending ||
    answerQuiz.isPending ||
    attemptMotus.isPending ||
    answerDefinition.isPending ||
    updateRoom.isPending ||
    renamePlayer.isPending ||
    kickPlayer.isPending ||
    setReady.isPending;

  const motusKeyboardStates = useMemo(
    () => getMotusKeyboardStates(mySubmissions),
    [mySubmissions],
  );

  const motusCells = useMemo(() => {
    const length = Number(roundData.length ?? 0);
    const attempts = Number(roundData.attempts ?? 0);
    return Array.from({ length: length ? attempts : 0 }, (_, rowIndex) => {
      const submission = mySubmissions[rowIndex];
      return Array.from({ length }, (_, index) => ({
        letter: submission?.payload[index] ?? "",
        state: submission?.feedback?.[index] ?? null,
      }));
    });
  }, [roundData.length, roundData.attempts, mySubmissions]);

  useEffect(() => {
    setSelectedDefinitionEntryId(null);
  }, [state?.round?.id]);
  useEffect(() => {
    if (state?.status !== "lobby") setShowQr(false);
  }, [state?.status]);
  useEffect(() => {
    if (!state || editingRoom) return;
    setRoomTitle(state.title);
    setRoomVisibility(state.visibility);
    setRoomRoundLimit(state.settings.roundLimit);
    setRoomRoundDuration(state.settings.roundDurationSeconds);
    setRoomShowSubmissions(state.settings.showSubmissions);
    setRoomHardcore(state.settings.isHardcore);
  }, [
    state?.title,
    state?.visibility,
    state?.settings.roundLimit,
    state?.settings.roundDurationSeconds,
    state?.settings.showSubmissions,
    state?.settings.isHardcore,
    editingRoom,
  ]);
  useEffect(() => {
    if (state?.viewer.nickname) setNicknameDraft(state.viewer.nickname);
  }, [state?.viewer.nickname]);
  useEffect(
    () => () => {
      if (motusFeedbackTimerRef.current)
        window.clearTimeout(motusFeedbackTimerRef.current);
    },
    [],
  );
  useEffect(() => {
    if (
      !state?.viewer.isHost ||
      !state.settings.isHardcore ||
      state.status !== "active" ||
      state.round?.status !== "resolved"
    )
      return;
    const roundId = state.round.id;
    if (autoAdvanceRoundRef.current === roundId) return;
    autoAdvanceRoundRef.current = roundId;
    const timer = window.setTimeout(() => {
      if (!resumeToken) return;
      void nextRound
        .mutateAsync({ code, resumeToken, expectedRoundId: roundId })
        .catch((error) =>
          setMessage(
            error instanceof Error
              ? error.message
              : "Impossible d’enchaîner la manche hardcore.",
          ),
        );
    }, 1_200);
    return () => window.clearTimeout(timer);
  }, [
    code,
    resumeToken,
    state?.viewer.isHost,
    state?.settings.isHardcore,
    state?.status,
    state?.round?.id,
    state?.round?.status,
    nextRound,
  ]);
  const refresh = useCallback(async () => {
    await room.refetch();
  }, [room]);

  async function join(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    if (!nickname.trim()) {
      setMessage("Choisissez un pseudo pour rejoindre le salon.");
      return;
    }
    try {
      const result = await joinRoom.mutateAsync({
        code,
        nickname: nickname.trim(),
      });
      saveToken(result.code, result.resumeToken);
      setResumeToken(result.resumeToken);
      await refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Impossible de rejoindre le salon.",
      );
    }
  }

  const callMutation = useCallback(
    async (action: () => Promise<unknown>, _label?: string) => {
      setMessage("");
      try {
        await action();
        await refresh();
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Cette action est indisponible.",
        );
      }
    },
    [refresh],
  );

  async function toggleReady(nextReady: boolean) {
    if (!state) return;
    setOptimisticReady(nextReady);
    try {
      await setReady.mutateAsync({ ...queryInput, isReady: nextReady });
      await refresh();
      setMessage("");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `Préparation non enregistrée — ${error.message}`
          : "Préparation non enregistrée — Réessayez.",
      );
    } finally {
      setOptimisticReady(null);
    }
  }

  if (!resumeToken) {
    if (roomPreview.isLoading)
      return (
        <main className="motif-app is-playing">
          <section className="game-stage room-stage">
            <div className="stage-logo">
              <span>m</span> motif.
            </div>
            <TimedRoomLoading
              label="Vérification du code de salon…"
              onRetry={() => void roomPreview.refetch()}
            />
          </section>
        </main>
      );
    const preview = roomPreview.data;
    const codeIsValid = /^[A-Z2-9]{6}$/.test(code);
    if (
      !codeIsValid ||
      roomPreview.isError ||
      !preview?.exists ||
      !preview.canJoin
    ) {
      const recoveryHref = getRoomRecoveryPath(
        preview?.gameMode ?? requestedRecoveryMode,
      );
      return (
        <main className="motif-app is-playing">
          <section className="game-stage room-stage">
            <Link className="back-control" href="/">
              <ArrowLeft size={17} />
              <span>Retour aux jeux</span>
            </Link>
            <div className="stage-logo">
              <span>m</span> motif.
            </div>
            <div className="stage-error">
              <p>
                {!codeIsValid
                  ? "Le code doit contenir six caractères, sans les lettres ou chiffres ambigus."
                  : preview && !preview.exists
                    ? "Ce code ne correspond à aucune table ouverte."
                    : (preview?.reason ??
                      "La vérification de la table a échoué. Réessayez ou modifiez le code.")}
              </p>
              <Link className="room-primary" href={recoveryHref}>
                Modifier le code
              </Link>
              <Link className="room-secondary" href="/">
                Retour aux jeux
              </Link>
            </div>
          </section>
        </main>
      );
    }
    const previewGame =
      preview?.gameMode === "definition"
        ? "Mots liés"
        : preview?.gameMode === "motus"
          ? "Motus"
          : "Quiz";
    return (
      <main className="motif-app is-playing">
        <section className="game-stage room-stage">
          <Link className="back-control" href="/">
            <ArrowLeft size={17} />
            <span>Jeux</span>
          </Link>
          <div className="stage-logo">
            <span>m</span> motif.
          </div>
          <div className="join-gate">
            <div className="multiplayer-kicker">
              <Users size={15} /> Invitation
            </div>
            <h1>
              Rejoindre le salon
              <br />
              <em>{code || "…"}</em>
            </h1>
            <p>
              Choisissez une signature : vous retrouverez ensuite la même manche
              que les autres joueurs.
            </p>
            {preview && (
              <aside className="join-preview" aria-label="Règles de la table">
                <p>{preview.title}</p>
                <span>
                  {previewGame} · {preview.variant}
                </span>
                <div>
                  <i>
                    {preview.players}/{preview.capacity} signatures
                  </i>
                  <i>{preview.roundLimit} manches</i>
                  <i>
                    {preview.roundDurationSeconds
                      ? `${preview.roundDurationSeconds} s`
                      : "temps libre"}
                  </i>
                  <i>
                    {preview.visibility === "public"
                      ? "table publique"
                      : "table privée"}
                  </i>
                  <i>
                    {preview.showSubmissions
                      ? "réponses visibles"
                      : "réponses privées"}
                  </i>
                  <i>
                    {preview.status === "lobby"
                      ? "table ouverte"
                      : "table indisponible"}
                  </i>
                </div>
              </aside>
            )}
            <form className="room-form" onSubmit={join}>
              <label>
                <span>Votre signature</span>
                <input
                  value={nickname}
                  maxLength={30}
                  onChange={(event) => setNickname(event.target.value)}
                  placeholder="ex. Quartz"
                  autoFocus
                  aria-describedby={message ? "join-feedback" : undefined}
                />
              </label>
              <button
                className="room-primary"
                type="submit"
                disabled={joinRoom.isPending}
              >
                {joinRoom.isPending ? (
                  "Connexion à la table…"
                ) : (
                  <>
                    Entrer dans le salon <ArrowRight size={17} />
                  </>
                )}
              </button>
            </form>
            {message && (
              <p
                id="join-feedback"
                className="room-message join-correction"
                role="status"
              >
                {message}
              </p>
            )}
          </div>
        </section>
      </main>
    );
  }

  if (room.isLoading)
    return (
      <main className="motif-app is-playing">
        <section className="game-stage room-stage">
          <div className="stage-logo">
            <span>m</span> motif.
          </div>
          <TimedRoomLoading
            label="Ouverture du salon…"
            onRetry={() => void room.refetch()}
          />
        </section>
      </main>
    );
  if (room.isError || !state)
    return (
      <main className="motif-app is-playing">
        <section className="game-stage room-stage">
          <Link className="back-control" href="/">
            <ArrowLeft size={17} />
            <span>Jeux</span>
          </Link>
          <div className="stage-logo">
            <span>m</span> motif.
          </div>
          <div className="stage-error">
            <p>{message || "Impossible d’ouvrir ce salon."}</p>
            <button
              type="button"
              onClick={() => {
                setResumeToken(null);
                window.localStorage.removeItem(`motif-room:${code}`);
              }}
            >
              Réessayer
            </button>
          </div>
        </section>
      </main>
    );

  const isQuiz = state.gameMode === "quiz";
  const isDefinition = state.gameMode === "definition";
  const isMotus = state.gameMode === "motus";
  const isLobby = state.status === "lobby";
  const isFinished = state.status === "finished";
  const viewerReady = optimisticReady ?? state.viewer.isReady;
  const readyPlayers = state.players.filter((player) =>
    player.id === state.viewer.id ? viewerReady : player.isReady,
  ).length;
  const preparationAvailable = state.players.length >= 2;
  const canStart = state.viewer.isHost && state.players.length >= 2;
  const choices = Array.isArray(roundData.choices)
    ? roundData.choices.map(String)
    : [];
  const quizAnswered = mySubmissions.length > 0;
  const latestQuizAnswer = mySubmissions[mySubmissions.length - 1];
  const motusLength = Number(roundData.length ?? 0);
  const motusAttempts = Number(roundData.attempts ?? 0);
  const motusSolved = mySubmissions.some((submission) => submission.isCorrect);
  const launchLabel =
    state.currentRoundIndex > 0
      ? "Lancer une nouvelle manche"
      : "Lancer la première manche";
  const inviteUrl = `${window.location.origin}/multijoueur/${state.code}`;
  const definitionWords = (
    Array.isArray(roundData.words) ? roundData.words : []
  ) as DefinitionWord[];
  const definitionItems = (
    Array.isArray(roundData.definitions) ? roundData.definitions : []
  ) as DefinitionItem[];
  const relationOptions = (
    Array.isArray(roundData.options) ? roundData.options : []
  ) as DefinitionWord[];
  const isRelationRound = roundData.kind === "relation";
  const definitionSolutions = (state?.round?.definitionSolutions ??
    []) as DefinitionSolution[];
  const definitionSource = (roundData.source ?? {}) as {
    url?: string;
    name?: string;
    license?: string;
  };
  const canAnswerQuiz = !quizAnswered;
  const timerMilliseconds = roomTimerMilliseconds;
  const countdownMilliseconds = roomCountdownMilliseconds;
  const isCountdown =
    state.round?.status === "active" && countdownMilliseconds > 0;
  const displayedMotusKeyboardStates = motusKeyboardStates;
  const canWatchOpponents = Boolean(state.round?.canWatchOpponents);

  const canTypeMotus =
    isMotus && state.round?.status === "active" && !motusSolved && !isBusy;
  const activeMotusRowIndex = mySubmissions.length;
  function appendMotusLetter(letter: string) {
    if (!canTypeMotus) return;
    setMotusGuess((value) => {
      const current = normalizeGameWord(value);
      return current.length >= motusLength
        ? current
        : `${current}${letter.toLocaleLowerCase("fr-FR")}`;
    });
    motusInputField.current?.focus();
  }
  function eraseMotusLetter() {
    if (!canTypeMotus) return;
    setMotusGuess((value) => normalizeGameWord(value).slice(0, -1));
    motusInputField.current?.focus();
  }
  function showMotusFeedback(feedback: MotusAttemptFeedback) {
    if (motusFeedbackTimerRef.current)
      window.clearTimeout(motusFeedbackTimerRef.current);
    setMotusFeedback(feedback);
    motusFeedbackTimerRef.current = window.setTimeout(
      () => setMotusFeedback(null),
      1_800,
    );
  }
  function submitMotusGuess() {
    const guess = normalizeGameWord(motusGuess);
    if (!canTypeMotus) return;
    if (guess.length !== motusLength) {
      showMotusFeedback({
        kind: "error",
        message: `Mot incomplet : entrez ${motusLength} lettres.`,
      });
      motusInputField.current?.focus();
      return;
    }
    setMotusGuess("");
    void attemptMotus
      .mutateAsync({ ...queryInput, word: guess })
      .then(async () => {
        await refresh();
        showMotusFeedback({
          kind: "success",
          message: "Proposition enregistrée.",
        });
      })
      .catch((error: unknown) => {
        setMotusGuess(guess);
        showMotusFeedback(
          getMotusAttemptFeedback(error instanceof Error ? error.message : ""),
        );
        motusInputField.current?.focus();
      });
  }
  const myDefinitionMatches = (() => {
    const matches = new Map<number, number>();
    mySubmissions
      .filter((submission) => submission.isCorrect)
      .forEach((submission) => {
        const payload = parseDefinitionPayload(submission.payload);
        if (payload.entryId && payload.definitionId)
          matches.set(payload.entryId, payload.definitionId);
      });
    return matches;
  })();
  const myDefinitionAttemptedEntries = new Set<number>();
  mySubmissions.forEach((submission) => {
    const payload = parseDefinitionPayload(submission.payload);
    if (payload.entryId) myDefinitionAttemptedEntries.add(payload.entryId);
  });
  const usedDefinitionIds = new Set(myDefinitionMatches.values());
  const myDefinitionAttemptCount = new Map<number, number>();
  mySubmissions.forEach((submission) => {
    const payload = parseDefinitionPayload(submission.payload);
    if (payload.entryId)
      myDefinitionAttemptCount.set(
        payload.entryId,
        (myDefinitionAttemptCount.get(payload.entryId) ?? 0) + 1,
      );
  });

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setMessage("Copié !");
    } catch {
      setMessage(`Partagez ce code : ${code}`);
    }
  }

  async function shareInvite() {
    if (!navigator.share) {
      await copyInvite();
      return;
    }
    try {
      await navigator.share({
        title: `motif. · ${state?.title ?? "Table"}`,
        text: `Rejoignez la table ${state?.code ?? code} sur motif.`,
        url: inviteUrl,
      });
      setMessage("");
    } catch {
      /* Annulation de partage : aucun retour nécessaire. */
    }
  }

  const gameLabel = isQuiz ? "Quiz" : isDefinition ? "Liaison" : "Motus";
  const backHref = isQuiz ? "/quiz" : isDefinition ? "/definitions" : "/motus";
  const createHref = isQuiz
    ? "/quiz/multijoueur"
    : isDefinition
      ? "/definitions/multijoueur"
      : "/motus/multijoueur";
  const governancePanel = state.viewer.isHost ? (
    <HostGovernance
      players={state.players}
      viewerId={state.viewer.id}
      disabled={isBusy}
      onTransfer={(playerId) =>
        void callMutation(() =>
          transferHost.mutateAsync({ ...queryInput, playerId }),
        )
      }
      onLeave={() =>
        void leaveRoom
          .mutateAsync(queryInput)
          .then(() => {
            window.localStorage.removeItem(`motif-room:${code}`);
            setResumeToken(null);
            setLocation(backHref);
          })
          .catch((error: unknown) =>
            setMessage(
              error instanceof Error
                ? error.message
                : "Le départ du salon a échoué.",
            ),
          )
      }
      onClose={() =>
        void callMutation(
          () => closeRoom.mutateAsync(queryInput),
          "Session fermée",
        )
      }
    />
  ) : (
    <button
      className="room-leave-button"
      type="button"
      disabled={isBusy}
      onClick={() =>
        void leaveRoom
          .mutateAsync(queryInput)
          .then(() => {
            window.localStorage.removeItem(`motif-room:${code}`);
            setResumeToken(null);
            setLocation(backHref);
          })
          .catch((error: unknown) =>
            setMessage(
              error instanceof Error
                ? error.message
                : "Le départ du salon a échoué.",
            ),
          )
      }
    >
      Quitter le salon
    </button>
  );

  return (
    <VisualEditorProvider pageKey="multiplayer">
      <main className="motif-app is-playing">
        <section
          className={`game-stage room-stage ${isQuiz ? "quiz-stage" : isDefinition ? "definition-stage" : "motus-stage"}`}
        >
          <Link className="back-control" href={backHref}>
            <ArrowLeft size={17} />
            <span>Retour aux jeux</span>
          </Link>
          <div className="stage-logo">
            <span>m</span> motif.
          </div>
          <div
            className={`room-shell ${isLobby ? "is-lobby" : ""} ${roomInfoOpen ? "" : "is-info-collapsed"}`}
          >
            <aside
              className={`room-side ${roomInfoOpen ? "" : "is-collapsed"}`}
            >
              <button
                className="room-side-toggle"
                type="button"
                aria-expanded={roomInfoOpen}
                title={
                  roomInfoOpen
                    ? "Réduire les informations du salon"
                    : "Afficher les informations du salon"
                }
                onClick={() => setRoomInfoOpen((open) => !open)}
              >
                {roomInfoOpen ? (
                  <PanelLeftClose size={15} />
                ) : (
                  <PanelLeftOpen size={15} />
                )}
                <span>
                  {roomInfoOpen ? "Réduire les détails" : "Détails du salon"}
                </span>
              </button>
              <div className="room-title-block">
                <div className="room-code-label">
                  {state.visibility === "public" ? (
                    <>
                      <Globe2 size={12} /> Public
                    </>
                  ) : (
                    <>
                      <LockKeyhole size={12} /> Privé
                    </>
                  )}
                </div>
                {editingRoom ? (
                  <div className="room-editor">
                    <input
                      value={roomTitle}
                      maxLength={60}
                      onChange={(event) => setRoomTitle(event.target.value)}
                      aria-label="Nom du salon"
                    />
                    <label>
                      <span>Visibilité</span>
                      <select
                        value={roomVisibility}
                        onChange={(event) =>
                          setRoomVisibility(
                            event.target.value as "private" | "public",
                          )
                        }
                      >
                        <option value="private">Privé</option>
                        <option value="public">Public</option>
                      </select>
                    </label>
                    <label>
                      <span>Manches</span>
                      <select
                        value={roomRoundLimit}
                        onChange={(event) =>
                          setRoomRoundLimit(Number(event.target.value))
                        }
                      >
                        {[3, 5, 8, 10].map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Durée</span>
                      <select
                        value={roomRoundDuration}
                        onChange={(event) =>
                          setRoomRoundDuration(Number(event.target.value))
                        }
                      >
                        {[
                          [0, "Libre"],
                          [45, "45 s"],
                          [75, "75 s"],
                          [120, "2 min"],
                        ].map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="inline-toggle">
                      <input
                        type="checkbox"
                        checked={roomHardcore}
                        onChange={(event) => {
                          setRoomHardcore(event.target.checked);
                          if (event.target.checked && roomRoundDuration === 0)
                            setRoomRoundDuration(45);
                        }}
                      />{" "}
                      Hardcore
                    </label>
                    <label className="inline-toggle">
                      <input
                        type="checkbox"
                        checked={roomShowSubmissions}
                        onChange={(event) =>
                          setRoomShowSubmissions(event.target.checked)
                        }
                      />{" "}
                      Réponses visibles
                    </label>
                    <div>
                      <button
                        type="button"
                        onClick={() =>
                          void callMutation(async () => {
                            const result = await updateRoom.mutateAsync({
                              ...queryInput,
                              title: roomTitle,
                              visibility: roomVisibility,
                              roundLimit: roomRoundLimit,
                              roundDurationSeconds: roomRoundDuration,
                              showSubmissions: roomShowSubmissions,
                              isHardcore: roomHardcore,
                            });
                            setEditingRoom(false);
                            return result;
                          })
                        }
                        disabled={isBusy}
                      >
                        Enregistrer
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingRoom(false)}
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h2>{state.title}</h2>
                    {state.viewer.isHost && (
                      <button
                        className="room-edit-button"
                        type="button"
                        onClick={() => setEditingRoom(true)}
                      >
                        <Edit3 size={13} /> Modifier
                      </button>
                    )}
                  </>
                )}
              </div>
              <button className="room-code" type="button" onClick={copyInvite}>
                {state.code} <Copy size={13} />
              </button>
              <p>{state.players.length}/8 joueurs</p>
              <div className="room-players">
                {state.players.map((player, index) => (
                  <div
                    className={player.id === state.viewer.id ? "is-me" : ""}
                    key={player.id}
                  >
                    <span>{index + 1}</span>
                    <b>{player.nickname}</b>
                    {player.isHost && <Crown size={12} />}
                    <em>{player.score} pts</em>
                    {state.viewer.isHost && !player.isHost && (
                      <button
                        className="player-kick"
                        type="button"
                        onClick={() =>
                          void callMutation(() =>
                            kickPlayer.mutateAsync({
                              ...queryInput,
                              playerId: player.id,
                            }),
                          )
                        }
                        aria-label={`Exclure ${player.nickname}`}
                        title={`Exclure ${player.nickname}`}
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {editingNickname ? (
                <form
                  className="nickname-editor"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void callMutation(async () => {
                      const result = await renamePlayer.mutateAsync({
                        ...queryInput,
                        nickname: nicknameDraft,
                      });
                      setEditingNickname(false);
                      return result;
                    });
                  }}
                >
                  <input
                    value={nicknameDraft}
                    maxLength={30}
                    onChange={(event) => setNicknameDraft(event.target.value)}
                  />
                  <button type="submit" disabled={isBusy}>
                    OK
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingNickname(false)}
                  >
                    ×
                  </button>
                </form>
              ) : (
                <button
                  className="rename-self"
                  type="button"
                  onClick={() => setEditingNickname(true)}
                >
                  <UserRoundPen size={13} /> Modifier mon pseudo
                </button>
              )}
              <div
                className="room-meta-rail"
                aria-label="Réglages de la partie"
              >
                <span>{state.settings.isHardcore ? "Hardcore" : "Partie"}</span>
                <b>
                  {state.currentRoundIndex || 0}
                  <i>/</i>
                  {state.settings.roundLimit}
                </b>
                <small>manches</small>
                <em>
                  {state.settings.roundDurationSeconds
                    ? `${state.settings.roundDurationSeconds} s / manche`
                    : "temps libre"}
                </em>
                <em>
                  {state.settings.showSubmissions
                    ? "réponses visibles"
                    : "réponses privées"}
                </em>
              </div>
              <button className="room-copy" type="button" onClick={copyInvite}>
                <Copy size={14} /> Copier l’invitation
              </button>
              {isLobby && state.viewer.isHost && (
                <button
                  className="room-qr"
                  type="button"
                  onClick={() => setShowQr(true)}
                >
                  <QrCodeIcon size={15} /> Afficher le QR code
                </button>
              )}
              {isLobby && state.viewer.isHost && showQr && (
                <InviteQrCode
                  url={inviteUrl}
                  onClose={() => setShowQr(false)}
                />
              )}
              {governancePanel}
            </aside>
            <section
              className={`room-main ${isFinished ? "is-finished" : ""} ${viewerReady ? "is-viewer-ready" : ""}`}
            >
              {latestSystemAnnouncement && (
                <aside
                  className="room-system-announcement"
                  role="status"
                  aria-live="polite"
                >
                  <b>Système</b>
                  <span>{latestSystemAnnouncement}</span>
                </aside>
              )}
              {isLobby && (
                <RoomLobby
                  gameLabel={gameLabel}
                  code={state.code}
                  players={state.players}
                  viewerId={state.viewer.id}
                  viewerReady={viewerReady}
                  isHost={state.viewer.isHost}
                  preparationAvailable={preparationAvailable}
                  canStart={canStart}
                  launchLabel={launchLabel}
                  busy={isBusy}
                  pendingReady={setReady.isPending}
                  shareBlock={
                    <section
                      className="lobby-share"
                      aria-label="Partager le salon"
                    >
                      <InviteQrThumbnail url={inviteUrl} />
                      <div>
                        <p className="mini-label">Code de la table</p>
                        <b>{state.code}</b>
                        <div className="lobby-share-actions">
                          <button type="button" onClick={copyInvite}>
                            <Copy size={14} /> Copier
                          </button>
                          <button
                            type="button"
                            onClick={() => void shareInvite()}
                          >
                            Partager
                          </button>
                        </div>
                      </div>
                    </section>
                  }
                  onReady={(nextReady) => void toggleReady(nextReady)}
                  onStart={() =>
                    void callMutation(
                      () => startRound.mutateAsync(queryInput),
                      "Manche lancée",
                    )
                  }
                />
              )}
              {isFinished && (
                <div className="room-lobby">
                  <div className="multiplayer-kicker">
                    <Crown size={15} /> Partie terminée
                  </div>
                  <h1>
                    Le mot de la
                    <br />
                    <em>fin.</em>
                  </h1>
                  <p>
                    La séance est clôturée.{" "}
                    {state.viewer.isHost
                      ? "Vous pouvez relancer une revanche avec le même groupe."
                      : "Attendez que l’hôte lance une revanche, ou créez une autre table."}
                  </p>
                  <section
                    className="final-leaderboard"
                    aria-label="Classement final"
                  >
                    <p>Classement final</p>
                    <ol>
                      {state.players.map((player, index) => (
                        <li
                          key={player.id}
                          className={
                            player.id === state.viewer.id ? "is-me" : ""
                          }
                        >
                          <span>{index + 1}</span>
                          <b>{player.nickname}</b>
                          <em>{player.score} pts</em>
                        </li>
                      ))}
                    </ol>
                  </section>
                  {isQuiz && state.round?.revealedAnswer && (
                    <p className="room-revealed-answer">
                      Dernière réponse : <b>{state.round.revealedAnswer}</b>.
                    </p>
                  )}
                  {!isQuiz && !isDefinition && state.round?.revealedAnswer && (
                    <p className="room-revealed-answer">
                      Le mot de la dernière manche était{" "}
                      <b>{state.round.revealedAnswer}</b>.
                    </p>
                  )}
                  {isDefinition &&
                    isRelationRound &&
                    state.round?.revealedAnswer && (
                      <p className="room-revealed-answer">
                        La bonne réponse était{" "}
                        <b>{state.round.revealedAnswer}</b>.
                      </p>
                    )}
                  {isDefinition && !isRelationRound && (
                    <div className="room-revealed-solutions">
                      <p>Les associations de la dernière manche</p>
                      {definitionSolutions.length ? (
                        <ul>
                          {definitionSolutions.map((solution) => (
                            <li key={solution.entryId}>
                              <b>{solution.lemma}</b>
                              <span>{solution.text}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span>
                          Aucune paire n’est disponible pour cette manche.
                        </span>
                      )}
                    </div>
                  )}
                  {state.viewer.isHost ? (
                    <button
                      className="room-primary"
                      type="button"
                      disabled={isBusy}
                      onClick={() =>
                        void callMutation(() =>
                          rematchRoom.mutateAsync(queryInput),
                        )
                      }
                    >
                      Revanche dans ce salon <RotateCcw size={17} />
                    </button>
                  ) : (
                    <Link className="room-primary" href={createHref}>
                      Créer un salon <ArrowRight size={17} />
                    </Link>
                  )}
                </div>
              )}
              {!isLobby && !isFinished && state.round && (
                <>
                  <div className="room-round-meta">
                    <span>
                      {isQuiz
                        ? `Quiz · ${state.variant === "truefalse" ? "Vrai / Faux" : state.variant === "gender" ? "Genre" : "Catégorie"}`
                        : isDefinition
                          ? "Liaison · mot & définition"
                          : `Motus · ${state.variant}`}
                    </span>
                    <span>
                      Manche {state.round.position} /{" "}
                      {state.settings.roundLimit}
                    </span>
                    {timerMilliseconds !== null && (
                      <span
                        className={`round-timer ${timerMilliseconds <= 15_000 ? "is-urgent" : ""}`}
                      >
                        <Clock3 size={13} />{" "}
                        {timerMilliseconds > 0
                          ? formatRemainingTime(timerMilliseconds)
                          : "0:00"}
                      </span>
                    )}
                  </div>
                  {timerMilliseconds !== null &&
                    timerMilliseconds <= 0 &&
                    state.round.status === "active" && (
                      <p className="round-expired-status" role="status">
                        Temps écoulé — calcul du résultat…
                      </p>
                    )}
                  {isCountdown && (
                    <section
                      className="round-countdown"
                      role="status"
                      aria-live="assertive"
                    >
                      <p className="mini-label">
                        Manche {state.round.position}
                      </p>
                      <b>
                        {Math.max(1, Math.ceil(countdownMilliseconds / 1_000))}
                      </b>
                      <span>Préparez-vous.</span>
                    </section>
                  )}
                  {isQuiz && (
                    <QuizView
                      variant={String(roundData.variant)}
                      lemma={String(roundData.lemma)}
                      statementCategory={String(
                        roundData.statementCategory ?? "",
                      )}
                      choices={choices}
                      active={state.round.status === "active"}
                      canAnswer={canAnswerQuiz}
                      busy={isBusy}
                      latestAnswer={latestQuizAnswer}
                      revealedAnswer={state.round.revealedAnswer}
                      sourceCnrtlUrl={state.round.sourceCnrtlUrl}
                      onAnswer={(choice) =>
                        void callMutation(() =>
                          answerQuiz.mutateAsync({ ...queryInput, choice }),
                        )
                      }
                    />
                  )}
                  {isDefinition && (
                    <DefinitionView
                      relationMode={isRelationRound}
                      relationVariant={String(roundData.variant)}
                      sourceLemma={String(roundData.sourceLemma ?? "")}
                      options={relationOptions}
                      words={definitionWords}
                      definitions={definitionItems}
                      matches={myDefinitionMatches}
                      attemptedEntryIds={myDefinitionAttemptedEntries}
                      usedDefinitionIds={usedDefinitionIds}
                      selectedEntryId={selectedDefinitionEntryId}
                      active={state.round.status === "active"}
                      busy={isBusy}
                      hasSecondChance={false}
                      submissionCount={mySubmissions.length}
                      relationAnswers={mySubmissions}
                      revealedAnswer={state.round.revealedAnswer}
                      onSelectEntry={setSelectedDefinitionEntryId}
                      onMatch={(entryId, definitionId) => {
                        void callMutation(() =>
                          answerDefinition.mutateAsync({
                            ...queryInput,
                            entryId,
                            definitionId,
                          }),
                        );
                        setSelectedDefinitionEntryId(null);
                      }}
                      onRelationAnswer={(entryId) =>
                        void callMutation(() =>
                          answerDefinition.mutateAsync({
                            ...queryInput,
                            entryId,
                            definitionId: 1,
                          }),
                        )
                      }
                    />
                  )}
                  {!isQuiz && !isDefinition && (
                    <MotusView
                      length={motusLength}
                      cells={motusCells}
                      activeRowIndex={activeMotusRowIndex}
                      canType={canTypeMotus}
                      guess={motusGuess}
                      attempts={motusAttempts}
                      hasBonusAttempt={false}
                      keyboardStates={displayedMotusKeyboardStates}
                      inputRef={motusInputField}
                      resolved={state.round.status === "resolved"}
                      revealedAnswer={state.round.revealedAnswer}
                      sourceCnrtlUrl={state.round.sourceCnrtlUrl}
                      feedback={motusFeedback}
                      onGuessChange={setMotusGuess}
                      onAppend={appendMotusLetter}
                      onErase={eraseMotusLetter}
                      onClear={() => {
                        setMotusGuess("");
                        motusInputField.current?.focus();
                      }}
                      onSubmit={submitMotusGuess}
                    />
                  )}
                  <div className="round-footer">
                    <p>
                      {state.round.status === "active"
                        ? `${state.round.solvedCount} joueur${state.round.solvedCount > 1 ? "s" : ""} a trouvé ou répondu juste.`
                        : "Manche terminée : le classement est prêt."}
                    </p>
                    {state.viewer.isHost && (
                      <div>
                        {state.round.status === "active" ? (
                          <button
                            className="room-secondary"
                            type="button"
                            disabled={isBusy}
                            onClick={() =>
                              void callMutation(() =>
                                nextRound.mutateAsync({
                                  ...queryInput,
                                  expectedRoundId: state.round!.id,
                                }),
                              )
                            }
                          >
                            Clore et continuer <ArrowRight size={15} />
                          </button>
                        ) : (
                          <button
                            className="room-secondary"
                            type="button"
                            disabled={isBusy}
                            onClick={() =>
                              void callMutation(() =>
                                nextRound.mutateAsync({
                                  ...queryInput,
                                  expectedRoundId: state.round!.id,
                                }),
                              )
                            }
                          >
                            Manche suivante <ArrowRight size={15} />
                          </button>
                        )}
                        <button
                          className="room-end"
                          type="button"
                          disabled={finishRoom.isPending}
                          onClick={() =>
                            void callMutation(
                              () => finishRoom.mutateAsync(queryInput),
                              "Table clôturée",
                            )
                          }
                        >
                          Clôturer la table
                        </button>
                      </div>
                    )}
                  </div>
                  {state.settings.showSubmissions || canWatchOpponents ? (
                    <PlayerActivity
                      submissions={sharedSubmissions}
                      gameMode={state.gameMode}
                      words={
                        isRelationRound ? relationOptions : definitionWords
                      }
                      definitions={definitionItems}
                      watching={canWatchOpponents}
                      motusMaxAttempts={motusAttempts}
                    />
                  ) : (
                    <div className="player-activity is-empty">
                      <EyeOff size={14} />
                      <span>
                        Les réponses des autres joueurs restent privées dans
                        cette partie.
                      </span>
                    </div>
                  )}
                </>
              )}
              {message && (
                <p className="room-message" role="status">
                  {message}
                </p>
              )}
            </section>
          </div>
        </section>
      </main>
      <EditToolbar />
      <ResponsiveEditorSidebar />
    </VisualEditorProvider>
  );
}
