import {
  ArrowLeft,
  ArrowRight,
  Copy,
  Globe2,
  LockKeyhole,
  Sliders,
  Timer,
  Users,
} from "lucide-react";
import { FormEvent, useState } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { motusModes, quizModes } from "@/lib/gameRoutes";
import {
  DEFAULT_MULTIPLAYER_PRESET,
  FREE_MULTIPLAYER_ROUND_DURATION_SECONDS,
} from "@shared/multiplayerSettings";
import "./multiplayer-setup.css";
import "./mobile-create-flow.css";
import "./multiplayer-setup-seyes.css";

type GameMode = "quiz" | "motus" | "definition";
type PresetMode = "relax" | "standard" | "hardcore" | "custom";

type PresetConfig = {
  id: Exclude<PresetMode, "custom">;
  label: string;
  detail: string;
  duration: number;
  rounds: number;
  hardcore: boolean;
};

const PRESETS: PresetConfig[] = [
  {
    id: "relax",
    label: "Détente",
    detail: "Temps libre · 5 manches",
    duration: 0,
    rounds: 5,
    hardcore: false,
  },
  {
    id: "standard",
    label: "Classique",
    detail: "60 s · 5 manches",
    duration: 60,
    rounds: 5,
    hardcore: false,
  },
  {
    id: "hardcore",
    label: "Hardcore",
    detail: "30 s · 8 manches rapides",
    duration: 30,
    rounds: 8,
    hardcore: true,
  },
];

const gameModeOptions: Array<{ id: GameMode; label: string; href: string }> = [
  { id: "quiz", label: "Quiz", href: "/quiz/multijoueur" },
  { id: "motus", label: "Motus", href: "/motus/multijoueur" },
  { id: "definition", label: "Mots liés", href: "/definitions/multijoueur" },
];

export default function MultiplayerSetup({
  gameMode,
  flow,
}: {
  gameMode: GameMode;
  flow: "create" | "join";
}) {
  const [, setLocation] = useLocation();
  const [nickname, setNickname] = useState("");
  const [title, setTitle] = useState("");
  const [variant, setVariant] = useState(
    gameMode === "quiz"
      ? "category"
      : gameMode === "motus"
        ? "classic"
        : "match",
  );
  const [visibility, setVisibility] = useState<"private" | "public">("private");
  const [presetType, setPresetType] = useState<PresetMode>(
    DEFAULT_MULTIPLAYER_PRESET,
  );
  const [roundLimit, setRoundLimit] = useState(5);
  const [roundDurationSeconds, setRoundDurationSeconds] = useState(
    FREE_MULTIPLAYER_ROUND_DURATION_SECONDS,
  );
  const [isHardcore, setIsHardcore] = useState(false);
  const [showSubmissions, setShowSubmissions] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [message, setMessage] = useState("");
  const [publicGameMode, setPublicGameMode] = useState<GameMode>(gameMode);
  const createRoom = trpc.multiplayer.create.useMutation();
  const publicRooms = trpc.multiplayer.publicRooms.useQuery(
    { gameMode: publicGameMode },
    {
      enabled: flow === "join",
      refetchInterval: flow === "join" ? 5000 : false,
    },
  );

  const variants =
    gameMode === "quiz"
      ? quizModes.map((mode) => ({
          id: mode.id,
          label: mode.label,
          detail: mode.detail,
        }))
      : gameMode === "motus"
        ? motusModes.map((mode) => ({
            id: mode.id,
            label: mode.label,
            detail: `${mode.attempts} essais · ${mode.minLength}–${mode.maxLength} lettres`,
          }))
        : [
            {
              id: "match",
              label: "Mots liés",
              detail: "4 mots · 4 définitions",
            },
            {
              id: "synonym",
              label: "Synonymes",
              detail: "Une relation précise",
            },
            {
              id: "antonym",
              label: "Antonymes",
              detail: "Une opposition directe",
            },
            {
              id: "intruder",
              label: "Mot intrus",
              detail: "9 termes · 1 intrus",
            },
          ];

  const backHref =
    gameMode === "quiz"
      ? "/quiz"
      : gameMode === "motus"
        ? "/motus"
        : "/definitions";
  const multiplayerHref =
    gameMode === "quiz"
      ? "/quiz/multijoueur"
      : gameMode === "motus"
        ? "/motus/multijoueur"
        : "/definitions/multijoueur";
  const createHref = `${multiplayerHref}/creer`;
  const joinHref = `${multiplayerHref}/rejoindre`;

  function selectPreset(preset: PresetConfig) {
    setPresetType(preset.id);
    setRoundDurationSeconds(preset.duration);
    setRoundLimit(preset.rounds);
    setIsHardcore(preset.hardcore);
  }

  function enableCustomMode() {
    setPresetType("custom");
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    if (!nickname.trim()) {
      setMessage("Veuillez choisir une signature (pseudo).");
      return;
    }
    try {
      const room = await createRoom.mutateAsync({
        gameMode,
        variant,
        nickname: nickname.trim(),
        title: title.trim() || undefined,
        visibility,
        roundLimit,
        roundDurationSeconds,
        showSubmissions,
        isHardcore,
      });
      window.sessionStorage.setItem(
        `motif-room:${room.code}`,
        room.resumeToken,
      );
      window.localStorage.removeItem(`motif-room:${room.code}`);
      window.dispatchEvent(new Event("motif-room-token"));
      setLocation(`/multijoueur/${room.code}`);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Erreur de création du salon.",
      );
    }
  }

  function joinWithCode(event: FormEvent) {
    event.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (!/^[A-Z2-9]{6}$/.test(code)) {
      setMessage("Saisissez un code de salon à six caractères.");
      return;
    }
    setLocation(`/multijoueur/${code}?from=${gameMode}`);
  }

  return (
    <main className="motif-app is-playing">
      <section
        className={`game-stage ${gameMode === "quiz" ? "quiz-stage" : gameMode === "motus" ? "motus-stage" : "definition-stage"}`}
      >
        <Link className="back-control" href={backHref}>
          <ArrowLeft size={17} />
          <span>Modes</span>
        </Link>
        <div className="stage-logo">
          <span>m</span> motif.
        </div>
        <div
          className={`multiplayer-setup seyes-multiplayer-setup flow-${flow}`}
        >
          <div className="multiplayer-kicker">
            <Users size={15} /> Multijoueur
          </div>
          <nav
            className="multiplayer-mode-switch"
            aria-label="Changer de jeu multijoueur"
          >
            {gameModeOptions.map((option) => (
              <Link
                key={option.id}
                className={option.id === gameMode ? "is-active" : ""}
                href={option.href}
              >
                {option.label}
              </Link>
            ))}
          </nav>
          <div className="seyes-title-block">
            <div>
              <p className="seyes-title-index">
                {flow === "create"
                  ? "Ouvrir une feuille de table"
                  : "Trouver une feuille de table"}
              </p>
              <h1>
                {flow === "create" ? (
                  <>
                    Créez votre
                    <br />
                    <em>table.</em>
                  </>
                ) : (
                  <>
                    Trouvez votre
                    <br />
                    <em>table.</em>
                  </>
                )}
              </h1>
              <p className="multiplayer-intro">
                {flow === "create"
                  ? "Configurez la partie, puis partagez son code avec le groupe."
                  : "Entrez un code ou choisissez une table publique qui attend encore des signatures."}
              </p>
            </div>
            <nav
              className="seyes-tab-switch"
              aria-label="Choisir le parcours de table"
            >
              <Link
                className={flow === "create" ? "active" : ""}
                href={createHref}
              >
                Créer
              </Link>
              <Link className={flow === "join" ? "active" : ""} href={joinHref}>
                Rejoindre
              </Link>
            </nav>
          </div>

          {flow === "create" ? (
            <form className="seyes-room-form" onSubmit={create}>
              <fieldset className="seyes-card-block">
                <legend>01 · Table & signature</legend>
                <div className="seyes-grid-2">
                  <label className="seyes-input-field">
                    <span>Votre signature</span>
                    <input
                      value={nickname}
                      maxLength={30}
                      onChange={(event) => setNickname(event.target.value)}
                      placeholder="ex. Nébuleuse"
                      autoComplete="nickname"
                      required
                    />
                  </label>
                  <label className="seyes-input-field">
                    <span>
                      Nom de la table <small>(facultatif)</small>
                    </span>
                    <input
                      value={title}
                      maxLength={60}
                      onChange={(event) => setTitle(event.target.value)}
                      placeholder={`ex. Les ${gameMode === "motus" ? "lettres" : gameMode === "definition" ? "nuances" : "curieux"} du soir`}
                    />
                  </label>
                </div>
              </fieldset>

              <fieldset className="seyes-card-block">
                <legend>02 · Défi</legend>
                <div
                  className="seyes-grid-2 seyes-variant-grid"
                  role="radiogroup"
                  aria-label="Choisir une variante"
                >
                  {variants.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      role="radio"
                      aria-checked={variant === item.id}
                      className={variant === item.id ? "is-active" : ""}
                      onClick={() => setVariant(item.id)}
                    >
                      <strong>{item.label}</strong>
                      <span>{item.detail}</span>
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset className="seyes-card-block">
                <legend>03 · Cadence & durée</legend>
                <div className="seyes-grid-3 seyes-preset-grid">
                  {PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      className={presetType === preset.id ? "is-active" : ""}
                      onClick={() => selectPreset(preset)}
                    >
                      <strong>{preset.label}</strong>
                      <span>{preset.detail}</span>
                    </button>
                  ))}
                </div>
                <div className="seyes-custom-trigger">
                  <button
                    type="button"
                    className={presetType === "custom" ? "is-active" : ""}
                    onClick={enableCustomMode}
                  >
                    <Sliders size={14} />{" "}
                    {presetType === "custom"
                      ? "Réglages sur mesure actifs"
                      : "Personnaliser durée et manches…"}
                  </button>
                </div>
                {presetType === "custom" && (
                  <div className="seyes-custom-panel">
                    <div className="seyes-rule-row">
                      <div>
                        <strong>Temps par manche</strong>
                        <small>Limite de réponse pour chaque défi.</small>
                      </div>
                      <div className="seyes-button-group">
                        {[
                          [0, "Libre"],
                          [30, "30 s"],
                          [45, "45 s"],
                          [60, "1 min"],
                          [75, "1 min 15"],
                        ].map(([value, label]) => (
                          <button
                            key={value}
                            type="button"
                            className={
                              roundDurationSeconds === value ? "is-active" : ""
                            }
                            disabled={isHardcore && value === 0}
                            onClick={() =>
                              setRoundDurationSeconds(Number(value))
                            }
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="seyes-rule-row">
                      <div>
                        <strong>Nombre de manches</strong>
                        <small>
                          Nombre total de défis avant le classement.
                        </small>
                      </div>
                      <div className="seyes-button-group">
                        {[3, 5, 8, 10, 12].map((value) => (
                          <button
                            key={value}
                            type="button"
                            className={roundLimit === value ? "is-active" : ""}
                            onClick={() => setRoundLimit(value)}
                          >
                            {value}
                          </button>
                        ))}
                      </div>
                    </div>
                    <label className="seyes-rule-row seyes-checkbox-row">
                      <div>
                        <strong>Mode hardcore</strong>
                        <small>Les manches s’enchaînent sans attente.</small>
                      </div>
                      <span>
                        <input
                          type="checkbox"
                          checked={isHardcore}
                          onChange={(event) => {
                            const checked = event.target.checked;
                            setIsHardcore(checked);
                            if (checked && roundDurationSeconds === 0)
                              setRoundDurationSeconds(30);
                          }}
                        />{" "}
                        <Timer size={14} /> Activer
                      </span>
                    </label>
                  </div>
                )}
                <div className="seyes-rule-row seyes-visibility-row">
                  <div>
                    <strong>Visibilité de la table</strong>
                    <small>
                      {visibility === "private"
                        ? "Accessible uniquement par code."
                        : "Visible dans les tables publiques."}
                    </small>
                  </div>
                  <div className="seyes-button-group">
                    <button
                      type="button"
                      className={visibility === "private" ? "is-active" : ""}
                      onClick={() => setVisibility("private")}
                    >
                      <LockKeyhole size={13} /> Privé
                    </button>
                    <button
                      type="button"
                      className={visibility === "public" ? "is-active" : ""}
                      onClick={() => setVisibility("public")}
                    >
                      <Globe2 size={13} /> Public
                    </button>
                  </div>
                </div>
                <label className="seyes-rule-row seyes-checkbox-row">
                  <div>
                    <strong>Réponses visibles</strong>
                    <small>
                      Les essais sont partagés avec la table pendant la manche.
                    </small>
                  </div>
                  <span>
                    <input
                      type="checkbox"
                      checked={showSubmissions}
                      onChange={(event) =>
                        setShowSubmissions(event.target.checked)
                      }
                    />{" "}
                    Afficher
                  </span>
                </label>
              </fieldset>
              {message && (
                <p className="seyes-error-msg" role="status">
                  {message}
                </p>
              )}
              <button
                className="seyes-submit-btn"
                type="submit"
                disabled={createRoom.isPending}
              >
                {createRoom.isPending ? (
                  "Création…"
                ) : (
                  <>
                    Ouvrir la table <ArrowRight size={17} />
                  </>
                )}
              </button>
            </form>
          ) : (
            <div className="seyes-join-workspace">
              <section
                className="seyes-join-box"
                aria-labelledby="join-table-title"
              >
                <p className="room-sheet-label">Code d’invitation</p>
                <h2 id="join-table-title">Rejoindre une table</h2>
                <form className="seyes-code-form" onSubmit={joinWithCode}>
                  <input
                    value={joinCode}
                    maxLength={6}
                    onChange={(event) =>
                      setJoinCode(event.target.value.toUpperCase())
                    }
                    placeholder="ABC123"
                    aria-label="Code d’invitation"
                  />
                  <button type="submit">
                    Rejoindre <Copy size={15} />
                  </button>
                </form>
              </section>
              <section
                className="seyes-public-list"
                aria-label="Tables publiques"
              >
                <div className="seyes-public-heading">
                  <div>
                    <p className="room-sheet-label">
                      <Globe2 size={13} /> Tables ouvertes
                    </p>
                    <h2>Une table vous attend peut-être.</h2>
                  </div>
                  <span>
                    {publicRooms.data?.length
                      ? "Choisissez une table ouverte."
                      : "Aucune table ouverte actuellement."}
                  </span>
                </div>
                <div
                  className="public-mode-tabs"
                  role="tablist"
                  aria-label="Filtrer les tables publiques"
                >
                  {gameModeOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      role="tab"
                      aria-selected={publicGameMode === option.id}
                      className={
                        publicGameMode === option.id ? "is-active" : ""
                      }
                      onClick={() => setPublicGameMode(option.id)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <div className="seyes-room-list">
                  {publicRooms.data?.map((room) => (
                    <button
                      key={room.code}
                      type="button"
                      onClick={() =>
                        setLocation(
                          `/multijoueur/${room.code}?from=${publicGameMode}`,
                        )
                      }
                    >
                      <span>
                        <b>{room.title}</b>
                        <small>
                          {room.variant} ·{" "}
                          {room.roundDurationSeconds
                            ? `${room.roundDurationSeconds} s`
                            : "libre"}
                          {room.isHardcore ? " · cadence rapide" : ""}
                        </small>
                      </span>
                      <em>
                        {room.players}/8 <ArrowRight size={14} />
                      </em>
                    </button>
                  ))}
                </div>
              </section>
              {message && (
                <p className="seyes-error-msg" role="status">
                  {message}
                </p>
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
