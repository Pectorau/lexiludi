import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type PointerEvent,
  type WheelEvent,
} from "react";
import {
  ArrowLeft,
  BookOpen,
  Check,
  ExternalLink,
  FolderPlus,
  Layers3,
  LocateFixed,
  Magnet,
  Minus,
  Move,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import "./herbarium-page.css";

type Accent = "violet" | "carmin" | "safran" | "sapin" | "bleu";
type Point = { x: number; y: number };
type Dragged = { kind: "theme" | "word"; id: number; offset: Point };
const ACCENTS: Array<{ id: Accent; label: string }> = [
  { id: "violet", label: "Violet" },
  { id: "carmin", label: "Carmin" },
  { id: "safran", label: "Safran" },
  { id: "sapin", label: "Sapin" },
  { id: "bleu", label: "Bleu" },
];
const SOURCE: Record<string, string> = {
  quiz: "Quiz",
  motus: "Motus",
  relation: "Mots liés",
  intrus: "Intrus",
  daily: "Jeu du jour",
};
const rounded = (value: number) => Math.round(value);

export default function HerbariumPage() {
  const utils = trpc.useUtils();
  const query = trpc.herbarium.grimoire.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const refresh = () => void utils.herbarium.grimoire.invalidate();
  const createTheme = trpc.herbarium.createTheme.useMutation({
    onSuccess: refresh,
  });
  const updateTheme = trpc.herbarium.updateTheme.useMutation({
    onSuccess: refresh,
  });
  const deleteTheme = trpc.herbarium.deleteTheme.useMutation({
    onSuccess: refresh,
  });
  const savePlacement = trpc.herbarium.savePlacement.useMutation({
    onSuccess: refresh,
  });
  const removePlacement = trpc.herbarium.removePlacement.useMutation({
    onSuccess: refresh,
  });
  const saveCanvas = trpc.herbarium.saveCanvas.useMutation();
  const canvasRef = useRef<HTMLDivElement>(null);
  const cameraLoaded = useRef(false);
  const saveTimer = useRef<number | undefined>(undefined);
  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 });
  const [pan, setPan] = useState<Point | null>(null);
  const [dragged, setDragged] = useState<Dragged | null>(null);
  const [themeMoves, setThemeMoves] = useState<Record<number, Point>>({});
  const [wordMoves, setWordMoves] = useState<Record<number, Point>>({});
  const [drawerOpen, setDrawerOpen] = useState(
    () => typeof window === "undefined" || window.innerWidth > 800,
  );
  const [search, setSearch] = useState("");
  const [inspectedId, setInspectedId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [accent, setAccent] = useState<Accent>("violet");
  const [notice, setNotice] = useState("");
  const data = query.data;
  const themes = useMemo(
    () =>
      (data?.themes ?? []).map((theme) => ({
        ...theme,
        ...(themeMoves[theme.id] ?? {}),
      })),
    [data?.themes, themeMoves],
  );
  const placements = useMemo(
    () =>
      (data?.placements ?? []).map((placement) => ({
        ...placement,
        ...(wordMoves[placement.lexicalEntryId] ?? {}),
      })),
    [data?.placements, wordMoves],
  );
  const placementsByWord = useMemo(
    () => new Map(placements.map((item) => [item.lexicalEntryId, item])),
    [placements],
  );
  const themesById = useMemo(
    () => new Map(themes.map((item) => [item.id, item])),
    [themes],
  );
  const discoveries = data?.discoveries ?? [];
  const placed = useMemo(
    () =>
      discoveries.filter((word) => {
        const placement = placementsByWord.get(word.id);
        return Boolean(placement?.themeId && themesById.has(placement.themeId));
      }),
    [discoveries, placementsByWord, themesById],
  );
  const unplaced = useMemo(
    () =>
      discoveries.filter((word) => !placed.some((item) => item.id === word.id)),
    [discoveries, placed],
  );
  const inspected = discoveries.find((word) => word.id === inspectedId) ?? null;

  useEffect(() => {
    if (data && !cameraLoaded.current) {
      cameraLoaded.current = true;
      setCamera({
        x: data.canvas.offsetX,
        y: data.canvas.offsetY,
        zoom: data.canvas.zoom / 100,
      });
    }
  }, [data]);
  const saveView = (next = camera) =>
    saveCanvas.mutate({
      offsetX: rounded(next.x),
      offsetY: rounded(next.y),
      zoom: rounded(next.zoom * 100),
    });
  const worldPoint = (clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    return rect
      ? {
          x: (clientX - rect.left - camera.x) / camera.zoom,
          y: (clientY - rect.top - camera.y) / camera.zoom,
        }
      : { x: 0, y: 0 };
  };
  const failure = (message: string) => setNotice(message);
  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const next = {
      ...camera,
      zoom: Math.max(
        0.55,
        Math.min(1.8, camera.zoom * (event.deltaY < 0 ? 1.09 : 0.92)),
      ),
    };
    setCamera(next);
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => saveView(next), 240);
  };
  const beginPan = (event: PointerEvent<HTMLDivElement>) => {
    if (
      (event.target as HTMLElement).closest(
        "[data-grimoire-node], [data-grimoire-panel]",
      )
    )
      return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setPan({ x: event.clientX - camera.x, y: event.clientY - camera.y });
  };
  const moveCanvas = (event: PointerEvent<HTMLDivElement>) => {
    if (pan) {
      setCamera((current) => ({
        ...current,
        x: event.clientX - pan.x,
        y: event.clientY - pan.y,
      }));
      return;
    }
    if (!dragged) return;
    const cursor = worldPoint(event.clientX, event.clientY);
    const point = {
      x: cursor.x - dragged.offset.x,
      y: cursor.y - dragged.offset.y,
    };
    if (dragged.kind === "theme")
      setThemeMoves((current) => ({ ...current, [dragged.id]: point }));
    else setWordMoves((current) => ({ ...current, [dragged.id]: point }));
  };
  const endCanvas = () => {
    if (pan) {
      setPan(null);
      saveView();
    }
    if (!dragged) return;
    if (dragged.kind === "theme") {
      const point = themeMoves[dragged.id];
      if (point)
        updateTheme.mutate(
          { themeId: dragged.id, x: rounded(point.x), y: rounded(point.y) },
          {
            onError: () =>
              failure("Le déplacement du thème n’a pas été enregistré."),
          },
        );
    } else {
      const point = wordMoves[dragged.id];
      const placement = placementsByWord.get(dragged.id);
      if (point && placement)
        savePlacement.mutate(
          {
            lexicalEntryId: dragged.id,
            themeId: placement.themeId,
            x: rounded(point.x),
            y: rounded(point.y),
          },
          {
            onError: () =>
              failure("Le déplacement du mot n’a pas été enregistré."),
          },
        );
    }
    setDragged(null);
  };
  const startDrag = (
    event: PointerEvent<HTMLElement>,
    kind: Dragged["kind"],
    id: number,
    point: Point,
  ) => {
    if ((event.target as HTMLElement).closest("button, input, a")) return;
    event.stopPropagation();
    const cursor = worldPoint(event.clientX, event.clientY);
    setDragged({
      kind,
      id,
      offset: { x: cursor.x - point.x, y: cursor.y - point.y },
    });
  };
  const placeWord = (wordId: number, themeId: number) => {
    const theme = themesById.get(themeId);
    if (!theme) return;
    const siblings = placed.filter(
      (word) => placementsByWord.get(word.id)?.themeId === themeId,
    );
    const angle = Math.PI / 2 + siblings.length * 0.65;
    const point = {
      x: theme.x + 190 * Math.cos(angle),
      y: theme.y + 175 * Math.sin(angle),
    };
    setWordMoves((current) => ({ ...current, [wordId]: point }));
    savePlacement.mutate(
      {
        lexicalEntryId: wordId,
        themeId,
        x: rounded(point.x),
        y: rounded(point.y),
      },
      { onError: () => failure("Ce mot n’a pas pu être relié à ce thème.") },
    );
  };
  const autoAlign = () => {
    const moves: Array<{ wordId: number; themeId: number; point: Point }> = [];
    themes.forEach((theme) => {
      const children = placed.filter(
        (word) => placementsByWord.get(word.id)?.themeId === theme.id,
      );
      children.forEach((word, index) => {
        const angle =
          children.length === 1
            ? Math.PI / 2
            : Math.PI * 0.17 +
              index * ((Math.PI * 0.66) / (children.length - 1));
        moves.push({
          wordId: word.id,
          themeId: theme.id,
          point: {
            x: theme.x + 205 * Math.cos(angle),
            y: theme.y + 190 * Math.sin(angle),
          },
        });
      });
    });
    setWordMoves((current) => ({
      ...current,
      ...Object.fromEntries(moves.map((move) => [move.wordId, move.point])),
    }));
    Promise.all(
      moves.map((move) =>
        savePlacement.mutateAsync({
          lexicalEntryId: move.wordId,
          themeId: move.themeId,
          x: rounded(move.point.x),
          y: rounded(move.point.y),
        }),
      ),
    ).catch(() =>
      failure("L’organisation n’a pas été entièrement enregistrée."),
    );
  };
  const submitTheme = () => {
    const value = title.trim();
    if (!value) {
      failure("Donnez un nom à votre thème avant de le graver.");
      return;
    }
    const rect = canvasRef.current?.getBoundingClientRect();
    const point = {
      x: rect ? (rect.width / 2 - camera.x) / camera.zoom : 460,
      y: rect ? (rect.height / 2 - camera.y) / camera.zoom : 300,
    };
    createTheme.mutate(
      { title: value, accent, x: rounded(point.x), y: rounded(point.y) },
      {
        onSuccess: () => {
          setCreating(false);
          setTitle("");
        },
        onError: () => failure("Le thème n’a pas pu être créé."),
      },
    );
  };
  const find = () => {
    const value = search.trim().toLocaleLowerCase("fr-FR");
    const word = discoveries.find((item) =>
      item.lemma.toLocaleLowerCase("fr-FR").includes(value),
    );
    if (!word) {
      failure("Aucun mot gravé ne correspond à votre recherche.");
      return;
    }
    const placement = placementsByWord.get(word.id);
    if (placement?.themeId) {
      const next = {
        x: (canvasRef.current?.clientWidth ?? 800) / 2 - placement.x * 1.08,
        y: (canvasRef.current?.clientHeight ?? 600) / 2 - placement.y * 1.08,
        zoom: 1.08,
      };
      setCamera(next);
      saveView(next);
    }
    setInspectedId(word.id);
    setNotice("");
  };
  const dropTheme = (event: DragEvent<HTMLElement>, themeId: number) => {
    event.preventDefault();
    const wordId = Number(event.dataTransfer.getData("text/plain"));
    if (discoveries.some((word) => word.id === wordId))
      placeWord(wordId, themeId);
  };
  const reset = () => {
    const next = { x: 0, y: 0, zoom: 1 };
    setCamera(next);
    saveView(next);
  };

  if (query.isLoading)
    return (
      <main className="motif-app is-playing">
        <section className="game-stage grimoire-stage">
          <div className="stage-logo">
            <span>m</span> motif.
          </div>
          <div className="stage-loading">Ouverture du Grimoire…</div>
        </section>
      </main>
    );
  if (query.isError || !data)
    return (
      <main className="motif-app is-playing">
        <section className="game-stage grimoire-stage">
          <Link className="back-control" href="/">
            <ArrowLeft size={16} />
            <span>Jeux</span>
          </Link>
          <div className="stage-error">
            <p>Le Grimoire ne peut pas être consulté pour le moment.</p>
            <button type="button" onClick={() => void query.refetch()}>
              Réessayer
            </button>
          </div>
        </section>
      </main>
    );

  return (
    <main className="grimoire-page">
      <header className="grimoire-toolbar" data-grimoire-panel>
        <div className="grimoire-title">
          <Link href="/" className="grimoire-back">
            <ArrowLeft size={15} /> Jeux
          </Link>
          <div>
            <p>Collection personnelle</p>
            <h1>
              Mon <em>Grimoire</em>
            </h1>
          </div>
        </div>
        <div className="grimoire-tools">
          <label>
            <Search size={14} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && find()}
              placeholder="Chercher un mot"
            />
          </label>
          <button
            type="button"
            onClick={find}
            aria-label="Centrer la recherche"
          >
            <LocateFixed size={15} />
          </button>
          <button type="button" onClick={autoAlign} disabled={!placed.length}>
            <Magnet size={15} /> Aimant
          </button>
          <button
            type="button"
            className="is-primary"
            onClick={() => setCreating(true)}
          >
            <FolderPlus size={15} /> Thème
          </button>
          <button
            type="button"
            onClick={() => setDrawerOpen((open) => !open)}
            aria-label="Ouvrir ou fermer la réserve"
          >
            <Layers3 size={15} />
          </button>
        </div>
      </header>
      <div className="grimoire-count" data-grimoire-panel>
        <BookOpen size={14} />
        <b>{discoveries.length}</b>
        <span>
          mot{discoveries.length > 1 ? "s" : ""} découvert
          {discoveries.length > 1 ? "s" : ""}
        </span>
        <i>·</i>
        <span>
          {themes.length} thème{themes.length > 1 ? "s" : ""}
        </span>
      </div>
      {notice && (
        <div className="grimoire-notice" role="status">
          {notice}
          <button
            type="button"
            onClick={() => setNotice("")}
            aria-label="Fermer"
          >
            <X size={14} />
          </button>
        </div>
      )}
      <div
        ref={canvasRef}
        className={`grimoire-canvas ${pan ? "is-panning" : ""}`}
        onWheel={handleWheel}
        onPointerDown={beginPan}
        onPointerMove={moveCanvas}
        onPointerUp={endCanvas}
        onPointerCancel={endCanvas}
      >
        <div
          className="grimoire-world"
          style={{
            transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`,
          }}
        >
          <svg className="grimoire-branches" aria-hidden="true">
            {placed.map((word) => {
              const placement = placementsByWord.get(word.id)!;
              const theme = themesById.get(placement.themeId!);
              return !theme ? null : (
                <g key={word.id} className={`accent-${theme.accent}`}>
                  <path
                    d={`M ${theme.x} ${theme.y} C ${theme.x} ${(theme.y + placement.y) / 2}, ${placement.x} ${(theme.y + placement.y) / 2}, ${placement.x} ${placement.y}`}
                  />
                  <circle cx={placement.x} cy={placement.y} r="4" />
                </g>
              );
            })}
          </svg>
          {themes.map((theme) => (
            <article
              key={theme.id}
              data-grimoire-node
              className={`grimoire-theme-node accent-${theme.accent}`}
              style={{ left: theme.x, top: theme.y }}
              onPointerDown={(event) =>
                startDrag(event, "theme", theme.id, theme)
              }
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => dropTheme(event, theme.id)}
            >
              <span>Tronc thématique</span>
              <h2>{theme.title}</h2>
              <small>
                {
                  placed.filter(
                    (word) =>
                      placementsByWord.get(word.id)?.themeId === theme.id,
                  ).length
                }{" "}
                mots reliés
              </small>
              <button
                type="button"
                onClick={() =>
                  deleteTheme.mutate(
                    { themeId: theme.id },
                    {
                      onError: () =>
                        failure("Ce thème n’a pas pu être supprimé."),
                    },
                  )
                }
                aria-label={`Supprimer ${theme.title}`}
                title="Supprimer"
              >
                <Trash2 size={13} />
              </button>
            </article>
          ))}
          {placed.map((word) => {
            const placement = placementsByWord.get(word.id)!;
            const theme = themesById.get(placement.themeId!);
            return !theme ? null : (
              <article
                key={word.id}
                data-grimoire-node
                className={`grimoire-word-node accent-${theme.accent}`}
                style={{ left: placement.x, top: placement.y }}
                onPointerDown={(event) =>
                  startDrag(event, "word", word.id, placement)
                }
                onClick={() => setInspectedId(word.id)}
              >
                <b>{word.lemma}</b>
                <span>{word.root.name}</span>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    removePlacement.mutate(
                      { lexicalEntryId: word.id },
                      {
                        onError: () =>
                          failure(
                            "Ce mot n’a pas pu être remis dans la réserve.",
                          ),
                      },
                    );
                  }}
                  aria-label={`Remettre ${word.lemma} dans la réserve`}
                >
                  <Trash2 size={13} />
                </button>
              </article>
            );
          })}
          {!discoveries.length ? (
            <div className="grimoire-empty" data-grimoire-panel>
              <BookOpen size={22} />
              <b>Le Grimoire est prêt.</b>
              <span>
                Un mot apparaît ici après une bonne réponse liée à une racine
                explorée en jeu.
              </span>
              <Link href="/definitions">
                <Check size={14} /> Jouer à Mots liés
              </Link>
            </div>
          ) : !themes.length ? (
            <div className="grimoire-empty" data-grimoire-panel>
              <Move size={22} />
              <b>Votre première branche attend un thème.</b>
              <span>
                Créez un thème libre, puis reliez-y vos mots depuis la réserve.
              </span>
              <button type="button" onClick={() => setCreating(true)}>
                <FolderPlus size={14} /> Créer un thème
              </button>
            </div>
          ) : null}
        </div>
        <div className="grimoire-zoom" data-grimoire-panel>
          <button
            type="button"
            onClick={() => {
              const next = {
                ...camera,
                zoom: Math.max(0.55, camera.zoom - 0.1),
              };
              setCamera(next);
              saveView(next);
            }}
            aria-label="Réduire le zoom"
          >
            <Minus size={15} />
          </button>
          <span>{rounded(camera.zoom * 100)} %</span>
          <button
            type="button"
            onClick={() => {
              const next = {
                ...camera,
                zoom: Math.min(1.8, camera.zoom + 0.1),
              };
              setCamera(next);
              saveView(next);
            }}
            aria-label="Augmenter le zoom"
          >
            <Plus size={15} />
          </button>
          <button
            type="button"
            onClick={reset}
            aria-label="Réinitialiser le cadrage"
          >
            <LocateFixed size={15} />
          </button>
        </div>
      </div>
      <aside
        className={`grimoire-drawer ${drawerOpen ? "is-open" : ""}`}
        data-grimoire-panel
      >
        <header>
          <div>
            <Layers3 size={17} />
            <p>
              <b>Réserve de mots</b>
              <span>{unplaced.length} à relier</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            aria-label="Fermer"
          >
            <X size={16} />
          </button>
        </header>
        <div className="grimoire-drawer-scroll">
          {unplaced.length ? (
            unplaced.map((word) => (
              <article
                key={word.id}
                className="grimoire-reserve-word"
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData("text/plain", String(word.id));
                  event.dataTransfer.effectAllowed = "move";
                }}
              >
                <button type="button" onClick={() => setInspectedId(word.id)}>
                  <b>{word.lemma}</b>
                  <span>
                    {word.root.name} · {SOURCE[word.sourceMode] ?? "Jeu"}
                  </span>
                </button>
                <div>
                  {themes.map((theme) => (
                    <button
                      type="button"
                      key={theme.id}
                      className={`accent-${theme.accent}`}
                      onClick={() => placeWord(word.id, theme.id)}
                    >
                      {theme.title}
                    </button>
                  ))}
                </div>
              </article>
            ))
          ) : (
            <p className="grimoire-drawer-empty">
              Tous vos mots gravés sont déjà reliés.
            </p>
          )}
          <section className="grimoire-theme-list">
            <header>
              <b>Thèmes libres</b>
              <button type="button" onClick={() => setCreating(true)}>
                <Plus size={14} /> Ajouter
              </button>
            </header>
            {themes.map((theme) => (
              <article key={`drawer-${theme.id}`}>
                <i className={`accent-${theme.accent}`} />
                <span>{theme.title}</span>
              </article>
            ))}
          </section>
        </div>
      </aside>
      {creating && (
        <div className="grimoire-modal" role="presentation">
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-theme-title"
            className="grimoire-dialog"
            onSubmit={(event) => {
              event.preventDefault();
              submitTheme();
            }}
          >
            <button
              type="button"
              className="grimoire-dialog-close"
              onClick={() => setCreating(false)}
              aria-label="Fermer"
            >
              <X size={16} />
            </button>
            <p>Organisation personnelle</p>
            <h2 id="new-theme-title">Nouveau thème</h2>
            <label>
              Nom du thème
              <input
                autoFocus
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={80}
                placeholder="Ex. Les mots du temps"
              />
            </label>
            <fieldset>
              <legend>Couleur d’encre</legend>
              <div>
                {ACCENTS.map((item) => (
                  <label key={item.id} className={`accent-${item.id}`}>
                    <input
                      type="radio"
                      checked={accent === item.id}
                      onChange={() => setAccent(item.id)}
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <footer>
              <button type="button" onClick={() => setCreating(false)}>
                Annuler
              </button>
              <button type="submit" disabled={createTheme.isPending}>
                Planter le thème
              </button>
            </footer>
          </form>
        </div>
      )}
      {inspected && (
        <div className="grimoire-modal" role="presentation">
          <article
            role="dialog"
            aria-modal="true"
            aria-labelledby="word-title"
            className="grimoire-dialog grimoire-word-dialog"
          >
            <button
              type="button"
              className="grimoire-dialog-close"
              onClick={() => setInspectedId(null)}
              aria-label="Fermer"
            >
              <X size={16} />
            </button>
            <p>
              <BookOpen size={14} /> Mot gravé
            </p>
            <h2 id="word-title">{inspected.lemma}</h2>
            <dl>
              <div>
                <dt>Racine</dt>
                <dd>{inspected.root.name}</dd>
              </div>
              <div>
                <dt>Origine</dt>
                <dd>{inspected.root.origin}</dd>
              </div>
              <div>
                <dt>Trouvé dans</dt>
                <dd>{SOURCE[inspected.sourceMode] ?? "une épreuve"}</dd>
              </div>
            </dl>
            <p className="grimoire-source-note">
              La fiche lexicale détaillée reste disponible chez sa source.
            </p>
            <a href={inspected.cnrtlUrl} target="_blank" rel="noreferrer">
              Consulter le CNRTL <ExternalLink size={14} />
            </a>
          </article>
        </div>
      )}
    </main>
  );
}
