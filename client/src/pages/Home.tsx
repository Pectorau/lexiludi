import { type CSSProperties } from "react";
import { Link } from "wouter";
import { useVisualPageConfig } from "@/hooks/useVisualPageConfig";
import { visualBlockStyle } from "../../../shared/visualEditor";
import { EditToolbar } from "@/components/edit-toolbar";
import { ResponsiveEditorSidebar } from "@/components/responsive-editor-sidebar";
import { VisualEditorProvider } from "@/components/visual-editor-context";
import "./home-seyes.css";

export default function Home() {
  const visual = useVisualPageConfig("home");
  const visualBlock = (blockId: string) => visual.block(blockId);
  const visualStyle = (blockId: string) =>
    visualBlockStyle(visualBlock(blockId)) as CSSProperties | undefined;
  const rememberHomePosition = () =>
    window.sessionStorage.setItem(
      "lexiludi-home-scroll",
      String(window.scrollY),
    );

  return (
    <VisualEditorProvider pageKey="home">
      <main className="motif-app is-home is-home-seyes">
        <section className="home-seyes" aria-label="Accueil Cahier Seyès">
          <div className="seyes-sheet">
            <header
              className="seyes-sheet-head"
              data-visual-block="home.copy"
              style={visualStyle("home.copy")}
            >
              <div>
                <p>Épreuve du jour · 5 lettres</p>
                <h1>
                  Le défi du <em>mot mystère.</em>
                </h1>
              </div>
              <aside>Formulez votre réponse à la plume</aside>
            </header>

            <section className="seyes-arena">
              <div className="seyes-brief">
                <b>Une question à résoudre</b>
                <span>
                  Le clavier physique est disponible une fois l’épreuve ouverte.
                </span>
              </div>
              <div
                className="seyes-motus-preview"
                aria-label="Aperçu d’une grille Motus"
              >
                <div>
                  <i>M</i>
                  <i>O</i>
                  <i>·</i>
                  <i>·</i>
                  <i>·</i>
                </div>
                <div>
                  <i>·</i>
                  <i>·</i>
                  <i>·</i>
                  <i>·</i>
                  <i>·</i>
                </div>
                <Link
                  onClick={rememberHomePosition}
                  href={visualBlock("home.daily")?.href ?? "/jeu-du-jour"}
                  className="seyes-daily-cta"
                  data-visual-block="home.daily"
                  style={visualStyle("home.daily")}
                >
                  Ouvrir l’épreuve du jour <span aria-hidden="true">→</span>
                </Link>
              </div>
            </section>

            <nav
              className="seyes-workshops"
              aria-label="Ateliers complémentaires"
            >
              <Link
                onClick={rememberHomePosition}
                href={visualBlock("home.quiz")?.href ?? "/quiz"}
                data-visual-block="home.quiz"
                style={visualStyle("home.quiz")}
              >
                <span>01 · Rapidité</span>
                <b>{visualBlock("home.quiz")?.text ?? "Quiz éclair"}</b>
                <small>
                  Quatre pistes utiles <i aria-hidden="true">↗</i>
                </small>
              </Link>
              <Link
                onClick={rememberHomePosition}
                href={visualBlock("home.definitions")?.href ?? "/definitions"}
                data-visual-block="home.definitions"
                style={visualStyle("home.definitions")}
              >
                <span>02 · Sémantique</span>
                <b>{visualBlock("home.definitions")?.text ?? "Mots liés"}</b>
                <small>
                  Tisser les liens de sens <i aria-hidden="true">↗</i>
                </small>
              </Link>
              <Link
                onClick={rememberHomePosition}
                href={visualBlock("home.motus")?.href ?? "/motus"}
                data-visual-block="home.motus"
                style={visualStyle("home.motus")}
              >
                <span>03 · Déduction</span>
                <b>{visualBlock("home.motus")?.text ?? "Motus libre"}</b>
                <small>
                  Grilles d’entraînement <i aria-hidden="true">↗</i>
                </small>
              </Link>
            </nav>
          </div>
        </section>
      </main>
      <EditToolbar />
      <ResponsiveEditorSidebar />
    </VisualEditorProvider>
  );
}
