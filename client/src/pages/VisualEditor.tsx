import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Gamepad2,
  LayoutPanelTop,
  UsersRound,
} from "lucide-react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import "./visual-editor.css";
import "./direct-workshop.css";

const editablePages = [
  {
    href: "/?edit=1",
    title: "Accueil",
    note: "Couverture, jeu du jour et chapitres.",
    Icon: LayoutPanelTop,
  },
  {
    href: "/quiz?edit=1",
    title: "Quiz",
    note: "Titre, consigne, réponses et trace pédagogique.",
    Icon: BookOpen,
  },
  {
    href: "/motus?edit=1",
    title: "Motus",
    note: "Titre, grille, clavier et actions de manche.",
    Icon: Gamepad2,
  },
  {
    href: "/definitions?edit=1",
    title: "Mots liés",
    note: "Titre, plateau et actions de liaison.",
    Icon: LayoutPanelTop,
  },
  {
    href: "/motus/multijoueur",
    title: "Salon multijoueur",
    note: "Ouvrez ou rejoignez une vraie table Motus : les outils de l’atelier apparaissent alors avec l’URL d’édition de la table.",
    Icon: UsersRound,
  },
];

export default function VisualEditor() {
  const access = trpc.visualEditor.access.useQuery();
  if (access.isLoading)
    return (
      <main className="visual-editor-shell">
        <p>Ouverture de l’atelier…</p>
      </main>
    );
  if (!access.data?.canEdit)
    return (
      <main className="visual-editor-shell visual-editor-guard">
        <BookOpen size={30} />
        <h1>Atelier réservé</h1>
        <p>
          Connectez-vous avec le compte propriétaire pour modifier la
          composition du site.
        </p>
        <Link href="/">Retour aux jeux</Link>
      </main>
    );
  return (
    <main className="visual-editor-shell direct-workshop-home">
      <header className="visual-editor-header">
        <Link href="/">
          <ArrowLeft size={15} /> Retour aux jeux
        </Link>
        <div>
          <p className="mini-label">ATELIER VISUEL · ÉDITION DIRECTE</p>
          <h1>
            Modifiez la vraie <em>page.</em>
          </h1>
          <p>
            Il n’y a plus de maquette séparée : choisissez une page, puis
            déplacez directement ses éléments réels. Chaque modification est
            visible immédiatement dans la page elle-même.
          </p>
        </div>
      </header>
      <section className="direct-workshop-grid">
        {editablePages.map(({ href, title, note, Icon }) => (
          <Link href={href} key={title} className="direct-workshop-card">
            <Icon size={22} />
            <div>
              <p className="mini-label">OUVRIR EN ÉDITION</p>
              <h2>{title}</h2>
              <p>{note}</p>
            </div>
            <ArrowRight size={18} />
          </Link>
        ))}
      </section>
      <section className="direct-workshop-rules">
        <b>Comment ça marche</b>
        <p>
          Cliquez un bloc réel, glissez-le pour le déplacer sur la grille de 8
          px et tirez la poignée pour le redimensionner. Utilisez Ctrl/Cmd +
          clic pour sélectionner plusieurs blocs, puis <strong>Grouper</strong>{" "}
          ; <strong>Scinder</strong> les sépare. Copier/Coller reproduit la
          composition d’un bloc. Les éléments indispensables au jeu restent
          protégés.
        </p>
      </section>
    </main>
  );
}
