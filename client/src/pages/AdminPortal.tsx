import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  Check,
  ChevronLeft,
  CircleOff,
  Command,
  Database,
  FlaskConical,
  ListChecks,
  Radio,
  RefreshCw,
  Settings2,
  ShieldCheck,
  UserRoundX,
  Users,
  X,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import AdminMotusSandbox from "@/components/AdminMotusSandbox";
import "./admin-portal.css";
import "./admin-analytics.css";
import "./admin-supervision.css";
import "./admin-room-actions.css";
import "./admin-action-feedback.css";

type Tab =
  | "overview"
  | "lexicon"
  | "analytics"
  | "rooms"
  | "sandbox"
  | "system"
  | "audit";

const tabs: Array<{ id: Tab; label: string; Icon: typeof BarChart3 }> = [
  { id: "overview", label: "Vue d’ensemble", Icon: BarChart3 },
  { id: "lexicon", label: "Curation lexicale", Icon: BookOpen },
  { id: "analytics", label: "Activité des jeux", Icon: BarChart3 },
  { id: "rooms", label: "Radar des salons", Icon: Users },
  { id: "sandbox", label: "Test Motus", Icon: FlaskConical },
  { id: "system", label: "Bandeau système", Icon: Settings2 },
  { id: "audit", label: "Journal d’audit", Icon: ListChecks },
];

const roomAnnouncementTemplates = [
  "Redémarrage dans 5 minutes.",
  "Une correction est en cours.",
  "La manche est validée, merci de patienter.",
];

function formatDate(value: Date | string) {
  return new Date(value).toLocaleString("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default function AdminPortal() {
  const [tab, setTab] = useState<Tab>("overview");
  const [commandOpen, setCommandOpen] = useState(false);
  const [notice, setNotice] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const { user, loading: authLoading } = useAuth();
  const access = trpc.admin.access.useQuery();
  const enabled = access.data?.canManage === true;
  const publicBanner = trpc.admin.publicBanner.useQuery();
  const overview = trpc.admin.overview.useQuery(undefined, { enabled });
  const analytics = trpc.admin.analytics.useQuery(undefined, {
    enabled: enabled && tab === "analytics",
  });
  const audit = trpc.admin.audit.useQuery({ limit: 30 }, { enabled });
  const utils = trpc.useUtils();
  const [query, setQuery] = useState("");
  const lexicon = trpc.admin.lexicon.useQuery(
    { query, limit: 24 },
    { enabled: enabled && tab === "lexicon" },
  );
  const rooms = trpc.admin.rooms.useQuery(undefined, {
    enabled: enabled && tab === "rooms",
    refetchInterval: 15_000,
  });
  const [bannerMessage, setBannerMessage] = useState("");
  const [bannerLevel, setBannerLevel] = useState<"info" | "attention">("info");
  const [bannerActive, setBannerActive] = useState(false);
  const items = useMemo(() => lexicon.data ?? [], [lexicon.data]);
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [roomMessage, setRoomMessage] = useState("");
  const showNotice = (
    message: string,
    tone: "success" | "error" = "success",
  ) => {
    setNotice({ tone, message });
    window.setTimeout(() => setNotice(null), 5_000);
  };
  const closeRoom = trpc.admin.closeRoom.useMutation({
    onSuccess: (room) => {
      void rooms.refetch();
      void overview.refetch();
      void audit.refetch();
      showNotice(`Le salon ${room.code} est fermé.`);
    },
    onError: (error) => showNotice(error.message, "error"),
  });
  const kickRoomPlayer = trpc.admin.kickRoomPlayer.useMutation({
    onSuccess: () => {
      void rooms.refetch();
      void overview.refetch();
      void audit.refetch();
      showNotice("Le joueur a été retiré et le salon a été mis à jour.");
    },
    onError: (error) => showNotice(error.message, "error"),
  });
  const announceRoom = trpc.admin.announceRoom.useMutation({
    onSuccess: (result) => {
      setRoomMessage("");
      void audit.refetch();
      showNotice(`Annonce envoyée au salon ${result.code}.`);
    },
    onError: (error) => showNotice(error.message, "error"),
  });
  const saveBanner = trpc.admin.globalBanner.useMutation({
    onSuccess: () => {
      void utils.admin.publicBanner.invalidate();
      void audit.refetch();
      showNotice("Le bandeau global est enregistré.");
    },
    onError: (error) => showNotice(error.message, "error"),
  });

  useEffect(() => {
    if (!publicBanner.data) return;
    setBannerActive(publicBanner.data.active);
    setBannerMessage(publicBanner.data.message);
    setBannerLevel(publicBanner.data.level);
  }, [publicBanner.data]);

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((open) => !open);
      }
      if (event.key === "Escape") setCommandOpen(false);
    };
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, []);

  if (access.isLoading || authLoading)
    return (
      <main className="admin-gate">
        Vérification de l’accès administrateur…
      </main>
    );
  if (!enabled && !user)
    return (
      <main className="admin-gate">
        <ShieldCheck size={28} />
        <h1>Session à actualiser</h1>
        <p>
          Vos réglages sont conservés. Reconnectez-vous pour rétablir votre
          session administrateur sécurisée.
        </p>
        <button type="button" onClick={startLogin}>
          Se reconnecter
        </button>
        <Link href="/">Retour aux jeux</Link>
      </main>
    );
  if (!enabled)
    return (
      <main className="admin-gate">
        <ShieldCheck size={28} />
        <h1>Accès réservé</h1>
        <p>Ce poste de gestion est réservé aux administrateurs de LexiLudi.</p>
        <Link href="/">Retour aux jeux</Link>
      </main>
    );

  return (
    <main className="admin-portal">
      {notice && (
        <div className={`admin-action-notice is-${notice.tone}`} role="status">
          <span>{notice.message}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Fermer la confirmation"
          >
            <X size={15} />
          </button>
        </div>
      )}
      {commandOpen && (
        <div
          className="admin-command-backdrop"
          role="presentation"
          onClick={() => setCommandOpen(false)}
        >
          <section
            className="admin-command-palette"
            role="dialog"
            aria-modal="true"
            aria-label="Commandes rapides"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <Command size={17} />
              <b>Accès rapide</b>
              <button type="button" onClick={() => setCommandOpen(false)}>
                <X size={15} />
              </button>
            </header>
            <p>
              Ces raccourcis ouvrent des outils existants ; ils ne modifient
              aucune partie directement.
            </p>
            {(["rooms", "sandbox", "system", "lexicon"] as Tab[]).map(
              (target) => (
                <button
                  type="button"
                  key={target}
                  onClick={() => {
                    setTab(target);
                    setCommandOpen(false);
                  }}
                >
                  {tabs.find((item) => item.id === target)?.label}
                </button>
              ),
            )}
          </section>
        </div>
      )}
      <aside className="admin-sidebar">
        <Link href="/" className="admin-brand">
          <span>m</span> motif.<small>poste de gestion</small>
        </Link>
        <nav>
          {tabs.map(({ id, label, Icon }) => (
            <button
              type="button"
              key={id}
              onClick={() => setTab(id)}
              className={tab === id ? "is-active" : ""}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </nav>
        <Link href="/" className="admin-exit">
          <ChevronLeft size={15} />
          Retour au site
        </Link>
      </aside>
      <section className="admin-workspace">
        <header>
          <div>
            <p>Administration</p>
            <h1>{tabs.find((item) => item.id === tab)?.label}</h1>
          </div>
          <div className="admin-header-actions">
            <button
              type="button"
              className="admin-command-trigger"
              onClick={() => setCommandOpen(true)}
            >
              <Command size={14} />
              Raccourcis <kbd>⌘K</kbd>
            </button>
            <button
              type="button"
              className="admin-refresh"
              onClick={() => {
                void overview.refetch();
                void audit.refetch();
                void rooms.refetch();
              }}
            >
              <RefreshCw size={14} />
              Actualiser
            </button>
          </div>
        </header>
        {tab === "overview" && (
          <section className="admin-grid">
            {[
              {
                label: "Entrées lexicales",
                value: overview.data?.lexiconEntries ?? 0,
                Icon: BookOpen,
              },
              {
                label: "Définitions sourcées",
                value: overview.data?.definitions ?? 0,
                Icon: Database,
              },
              {
                label: "Salons actifs",
                value: overview.data?.activeRooms ?? 0,
                Icon: Radio,
              },
              {
                label: "Parties résolues",
                value:
                  (overview.data?.resolvedSoloRuns ?? 0) +
                  (overview.data?.resolvedDailyRuns ?? 0),
                Icon: Check,
              },
            ].map(({ label, value, Icon }) => (
              <article key={label} className="admin-stat">
                <Icon size={18} />
                <span>{label}</span>
                <b>{value.toLocaleString("fr-FR")}</b>
              </article>
            ))}
            <article className="admin-note">
              <ShieldCheck size={19} />
              <div>
                <b>Garde-fous adaptés</b>
                <p>
                  Le corpus Morphalou et les sources de définitions restent
                  séparés. La curation ne remplace pas les données sources ;
                  aucun suivi d’adresse IP, d’empreinte navigateur ou
                  bannissement automatique n’est activé.
                </p>
              </div>
            </article>
          </section>
        )}
        {tab === "lexicon" && (
          <section className="admin-panel">
            <div className="admin-toolbar">
              <label>
                Rechercher{" "}
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Mot ou lemme…"
                />
              </label>
              <span>{items.length} entrée(s)</span>
            </div>
            <div className="admin-list">
              {items.map((entry) => (
                <LexiconRow
                  key={entry.id}
                  entry={entry}
                  onSaved={() => {
                    void lexicon.refetch();
                    void audit.refetch();
                  }}
                />
              ))}
              {!lexicon.isLoading && !items.length && (
                <p className="admin-empty">
                  Aucune entrée ne correspond à cette recherche.
                </p>
              )}
            </div>
          </section>
        )}
        {tab === "analytics" && (
          <section className="admin-grid admin-analytics">
            <article className="admin-chart">
              <h2>Essais avant résolution · solo</h2>
              <p>
                Distribution issue des sessions résolues, sans empreinte de
                navigateur ni adresse IP.
              </p>
              <div className="bar-stack">
                {analytics.data?.soloAttempts.map((item) => (
                  <div key={item.attempts}>
                    <span>
                      {item.attempts} essai{item.attempts > 1 ? "s" : ""}
                    </span>
                    <i
                      style={{ width: `${Math.min(100, item.total * 14)}%` }}
                    />
                    <b>{item.total}</b>
                  </div>
                ))}
                {!analytics.data?.soloAttempts.length && (
                  <small>Aucune session résolue à afficher.</small>
                )}
              </div>
            </article>
            <article className="admin-chart">
              <h2>Jeu du jour</h2>
              <p>Sessions ouvertes par variante.</p>
              <div className="bar-stack">
                {analytics.data?.dailyModes.map((item) => (
                  <div key={item.mode}>
                    <span>{item.mode}</span>
                    <i
                      style={{ width: `${Math.min(100, item.total * 14)}%` }}
                    />
                    <b>{item.total}</b>
                  </div>
                ))}
                {!analytics.data?.dailyModes.length && (
                  <small>Aucune session quotidienne à afficher.</small>
                )}
              </div>
            </article>
            <article className="admin-chart">
              <h2>Salons créés</h2>
              <p>Répartition persistée par jeu multijoueur.</p>
              <div className="bar-stack">
                {analytics.data?.roomModes.map((item) => (
                  <div key={item.mode}>
                    <span>{item.mode}</span>
                    <i
                      style={{ width: `${Math.min(100, item.total * 14)}%` }}
                    />
                    <b>{item.total}</b>
                  </div>
                ))}
                {!analytics.data?.roomModes.length && (
                  <small>Aucun salon à afficher.</small>
                )}
              </div>
            </article>
          </section>
        )}
        {tab === "rooms" && (
          <section className="admin-panel">
            <p className="admin-panel-note">
              Ce radar reflète le multijoueur léger : les états sont persistés
              et actualisés périodiquement, sans serveur WebSocket permanent.
            </p>
            <div className="admin-room-notice">
              <label>
                Salon
                <select
                  value={selectedRoomId ?? ""}
                  onChange={(event) =>
                    setSelectedRoomId(Number(event.target.value) || null)
                  }
                >
                  <option value="">Choisir un salon</option>
                  {rooms.data
                    ?.filter((room) => room.status !== "finished")
                    .map((room) => (
                      <option key={room.id} value={room.id}>
                        {room.code} · {room.title}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Annonce
                <input
                  maxLength={220}
                  value={roomMessage}
                  onChange={(event) => setRoomMessage(event.target.value)}
                  placeholder="Ex. La prochaine manche démarre dans une minute."
                />
              </label>
              <button
                type="button"
                disabled={
                  !selectedRoomId ||
                  !roomMessage.trim() ||
                  announceRoom.isPending
                }
                onClick={() =>
                  selectedRoomId &&
                  announceRoom.mutate({
                    roomId: selectedRoomId,
                    message: roomMessage,
                  })
                }
              >
                Publier
              </button>
              <div className="admin-room-templates">
                {roomAnnouncementTemplates.map((template) => (
                  <button
                    type="button"
                    key={template}
                    onClick={() => setRoomMessage(template)}
                  >
                    {template}
                  </button>
                ))}
              </div>
            </div>
            <div className="admin-table">
              {rooms.data?.map((room) => (
                <article className="admin-room-card" key={room.id}>
                  <div className="admin-room">
                    <div>
                      <b>{room.code}</b>
                      <span>{room.title}</span>
                    </div>
                    <span>
                      {room.gameMode} · {room.variant}
                    </span>
                    <span>{room.playerCount}/8 joueurs</span>
                    <span className={`status-${room.status}`}>
                      {room.status}
                    </span>
                    <button
                      type="button"
                      disabled={
                        room.status === "finished" || closeRoom.isPending
                      }
                      onClick={() => {
                        if (
                          window.confirm(
                            `Fermer le salon ${room.code} ? Cette action termine aussi la manche active.`,
                          )
                        )
                          closeRoom.mutate({ roomId: room.id });
                      }}
                    >
                      <CircleOff size={14} />
                      Fermer
                    </button>
                  </div>
                  <div className="admin-room-players">
                    {room.players.map((player) => (
                      <span key={player.id} className="admin-player-chip">
                        {player.nickname}
                        {player.isHost ? " · hôte" : ""}
                        <button
                          type="button"
                          disabled={
                            room.status === "finished" ||
                            kickRoomPlayer.isPending
                          }
                          onClick={() => {
                            if (
                              window.confirm(
                                `Retirer ${player.nickname} du salon ${room.code} ?`,
                              )
                            )
                              kickRoomPlayer.mutate({
                                roomId: room.id,
                                playerId: player.id,
                              });
                          }}
                          title={`Retirer ${player.nickname}`}
                        >
                          <UserRoundX size={12} />
                        </button>
                      </span>
                    ))}
                    {!room.players.length && (
                      <span className="admin-no-player">Aucun participant</span>
                    )}
                  </div>
                </article>
              ))}
              {!rooms.isLoading && !rooms.data?.length && (
                <p className="admin-empty">
                  Aucun salon persistant à afficher.
                </p>
              )}
            </div>
          </section>
        )}
        {tab === "sandbox" && <AdminMotusSandbox />}
        {tab === "system" && (
          <section className="admin-panel admin-system">
            <div>
              <AlertTriangle size={19} />
              <div>
                <b>Bandeau global</b>
                <p>
                  Message temporaire visible par tous les joueurs, sans
                  interrompre une partie en cours.
                </p>
              </div>
            </div>
            <label className="admin-toggle">
              <input
                type="checkbox"
                checked={bannerActive}
                onChange={(event) => setBannerActive(event.target.checked)}
              />
              Afficher le bandeau
            </label>
            <label>
              Message
              <textarea
                value={bannerMessage}
                maxLength={240}
                onChange={(event) => setBannerMessage(event.target.value)}
                placeholder="Ex. Nouvelle feuille de jeu disponible cet après-midi."
              />
            </label>
            <label>
              Niveau
              <select
                value={bannerLevel}
                onChange={(event) =>
                  setBannerLevel(event.target.value as "info" | "attention")
                }
              >
                <option value="info">Information</option>
                <option value="attention">Attention</option>
              </select>
            </label>
            <button
              type="button"
              className="admin-primary"
              disabled={
                saveBanner.isPending || (bannerActive && !bannerMessage.trim())
              }
              onClick={() =>
                saveBanner.mutate({
                  active: bannerActive,
                  message: bannerMessage,
                  level: bannerLevel,
                })
              }
            >
              <Check size={15} />
              Enregistrer le bandeau
            </button>
          </section>
        )}
        {tab === "audit" && (
          <section className="admin-panel">
            <div className="admin-audit">
              {audit.data?.map((event) => (
                <article key={event.id}>
                  <b>{event.summary}</b>
                  <span>
                    {event.action} · {formatDate(event.createdAt)}
                  </span>
                </article>
              ))}
              {!audit.isLoading && !audit.data?.length && (
                <p className="admin-empty">
                  Aucune action administrative enregistrée.
                </p>
              )}
            </div>
          </section>
        )}
      </section>
    </main>
  );
}

function LexiconRow({
  entry,
  onSaved,
}: {
  entry: {
    id: number;
    lemma: string;
    category: string | null;
    cnrtlUrl: string;
    difficulty: "facile" | "moyen" | "difficile" | "diabolique";
    frequencyWeight: number;
    tags: string[];
    isActive: boolean;
    editorialNote: string | null;
  };
  onSaved: () => void;
}) {
  const [difficulty, setDifficulty] = useState(entry.difficulty);
  const [weight, setWeight] = useState(entry.frequencyWeight);
  const [tags, setTags] = useState(entry.tags.join(", "));
  const [active, setActive] = useState(entry.isActive);
  const mutation = trpc.admin.saveCuration.useMutation({ onSuccess: onSaved });
  return (
    <article className="admin-lexicon-row">
      <div className="admin-lexicon-title">
        <b>{entry.lemma}</b>
        <span>{entry.category ?? "Catégorie non renseignée"}</span>
        <a href={entry.cnrtlUrl} target="_blank" rel="noreferrer">
          CNRTL
        </a>
      </div>
      <div className="admin-lexicon-controls">
        <select
          value={difficulty}
          onChange={(event) =>
            setDifficulty(event.target.value as typeof difficulty)
          }
        >
          <option value="facile">Facile</option>
          <option value="moyen">Moyen</option>
          <option value="difficile">Difficile</option>
          <option value="diabolique">Diabolique</option>
        </select>
        <input
          type="number"
          min={1}
          max={500}
          value={weight}
          onChange={(event) => setWeight(Number(event.target.value))}
          aria-label="Poids de fréquence"
        />
        <input
          value={tags}
          onChange={(event) => setTags(event.target.value)}
          placeholder="tags, séparés"
        />
        <label>
          <input
            type="checkbox"
            checked={active}
            onChange={(event) => setActive(event.target.checked)}
          />
          Actif
        </label>
        <button
          type="button"
          disabled={mutation.isPending}
          onClick={() =>
            mutation.mutate({
              lexicalEntryId: entry.id,
              difficulty,
              frequencyWeight: weight,
              tags: tags.split(","),
              isActive: active,
            })
          }
        >
          Sauvegarder
        </button>
      </div>
    </article>
  );
}
