import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { getNavigationMeta } from "@/lib/navigation";

export default function PageNavigationAids() {
  const [location] = useLocation();
  const meta = getNavigationMeta(location);

  useEffect(() => {
    document.title = meta.title;
  }, [meta.title]);

  useEffect(() => {
    const annotateControls = () => {
      document
        .querySelectorAll<HTMLAnchorElement>('a[target="_blank"]')
        .forEach((anchor) => {
          if (anchor.dataset.externalLabelled === "true") return;
          const label =
            anchor.getAttribute("aria-label") ||
            anchor.textContent?.trim() ||
            "Lien externe";
          anchor.setAttribute(
            "aria-label",
            `${label} — ouvre dans un nouvel onglet`,
          );
          anchor.setAttribute("title", "Ouvre dans un nouvel onglet");
          anchor.dataset.externalLabelled = "true";
        });
      document
        .querySelectorAll<HTMLAnchorElement>(".back-control")
        .forEach((anchor) => {
          if (anchor.getAttribute("aria-label")) return;
          anchor.setAttribute(
            "aria-label",
            `Retour : ${anchor.textContent?.trim() || "page précédente"}`,
          );
        });
    };
    annotateControls();
    const observer = new MutationObserver(annotateControls);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [location]);

  return (
    <nav className="sr-only" aria-label="Fil d’Ariane">
      <ol>
        <li>
          <Link href="/">LexiLudi</Link>
        </li>
        <li aria-current="page">{meta.label}</li>
      </ol>
    </nav>
  );
}
