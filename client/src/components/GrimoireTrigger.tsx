import { useState } from "react";
import { Link, useLocation } from "wouter";
import "./grimoire-trigger.css";

export default function GrimoireTrigger() {
  const [hovered, setHovered] = useState(false);
  const [location] = useLocation();
  if (location === "/arbre") return null;

  return (
    <div
      className="grimoire-trigger"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span className={hovered ? "is-visible" : ""}>Ouvrir mon Grimoire</span>
      <Link
        href="/arbre"
        aria-label="Ouvrir mon Grimoire lexical"
        title="Mon Grimoire lexical"
      >
        <b aria-hidden="true">&amp;</b>
      </Link>
    </div>
  );
}
