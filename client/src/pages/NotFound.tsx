import { Button } from "@/components/ui/button";
import { ArrowLeft, FileQuestion } from "lucide-react";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <main className="motif-app is-playing">
      <section className="game-stage lost-page">
        <div className="stage-logo">
          <span>m</span> motif.
        </div>
        <article>
          <FileQuestion size={30} />
          <p className="mini-label">Feuillet égaré · 404</p>
          <h1>
            Cette page a<br />
            <em>glissé hors du cahier.</em>
          </h1>
          <p>
            Elle n’est plus dans cette séance. Revenez aux chapitres pour
            reprendre une piste de vocabulaire.
          </p>
          <Link className="setup-start" href="/">
            <ArrowLeft size={16} /> Retour aux jeux
          </Link>
        </article>
      </section>
    </main>
  );
}
