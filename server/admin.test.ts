import { describe, expect, it } from "vitest";
import { normalizeCurationInput, planAdminRoomKick } from "./admin";

describe("normalisation de la curation lexicale", () => {
  it("borne le poids et conserve uniquement des étiquettes éditoriales utilisables", () => {
    expect(normalizeCurationInput({
      difficulty: "difficile",
      frequencyWeight: 999,
      tags: [" Botanique ", "botanique", "x", "Rare"],
      isActive: true,
      editorialNote: "  À privilégier.  ",
    })).toEqual({
      difficulty: "difficile",
      frequencyWeight: 500,
      tags: ["botanique", "rare"],
      isActive: true,
      editorialNote: "À privilégier.",
    });
  });
});

describe("transitions administratives de salon", () => {
  const players = [
    { id: 1, nickname: "Hôte", isHost: true },
    { id: 2, nickname: "Lina", isHost: false },
    { id: 3, nickname: "Noé", isHost: false },
  ];

  it("transfère l’hôte au premier joueur restant lorsqu’il est retiré", () => {
    expect(planAdminRoomKick(players, 1)).toMatchObject({ target: players[0], successor: players[1], shouldCloseRoom: false });
  });

  it("ferme un salon lorsque son dernier participant est retiré", () => {
    expect(planAdminRoomKick([players[0]], 1)).toMatchObject({ target: players[0], successor: null, shouldCloseRoom: true });
  });
});
