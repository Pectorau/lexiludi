import { describe, expect, it } from "vitest";
import { getLatestRoomSystemAnnouncement } from "./roomSystemAnnouncement";

describe("getLatestRoomSystemAnnouncement", () => {
  it("retient la dernière annonce dans l’ordre renvoyé par le salon et retire le préfixe technique", () => {
    expect(getLatestRoomSystemAnnouncement([
      { type: "admin_announcement", summary: "[Système] La manche reprend dans une minute." },
      { type: "room_closed", summary: "Table clôturée." },
      { type: "admin_announcement", summary: "[Système] Ancien message." },
    ])).toBe("La manche reprend dans une minute.");
  });

  it("n’affiche rien lorsqu’aucune annonce n’est disponible", () => {
    expect(getLatestRoomSystemAnnouncement([{ type: "room_closed", summary: "Table clôturée." }])).toBeNull();
  });

  it("propose un libellé accessible pour une annonce vide", () => {
    expect(getLatestRoomSystemAnnouncement([{ type: "admin_announcement", summary: "[Système]  " }])).toBe("Annonce de l’administration.");
  });
});
