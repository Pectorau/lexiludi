import { describe, expect, it } from "vitest";
import { DEFAULT_MULTIPLAYER_PRESET, FREE_MULTIPLAYER_ROUND_DURATION_SECONDS } from "@shared/multiplayerSettings";
import { buildMultiplayerGenderRound, buildRevealedDefinitionSolution, canAdvanceMultiplayerRound, canContinueMultiplayerRound, canJoinMultiplayerLobby, canStartMultiplayerRound, getMotusCompassMessage, getNextMultiplayerAttemptIndex, isHardcoreCompatible, normalizeTradeLetter } from "./multiplayerDb";

describe("manches Genre multijoueurs", () => {
  it("construit une manche partagée avec deux choix et une réponse serveur", () => {
    const round = buildMultiplayerGenderRound({
      kind: "gender",
      term: "acrobatisme",
      lemma: "acrobatisme",
      prompt: "Quel est le genre grammatical de ce nom ?",
      choices: ["Masculin", "Féminin"],
      answer: "Masculin",
      correction: "Morphalou indique un genre masculin.",
      context: "Contexte : « L’acrobatisme reste au centre de la discussion. »",
      source: { name: "Morphalou 3", license: "LGPL-LR", cnrtlUrl: "https://www.cnrtl.fr/definition/acrobatisme" },
    });

    expect(round).toEqual({
      prompt: "Quel est le genre grammatical de ce nom ?",
      publicData: { variant: "gender", lemma: "acrobatisme", context: "Contexte : « L’acrobatisme reste au centre de la discussion. »", choices: ["Masculin", "Féminin"] },
      answerKey: "Masculin",
      sourceCnrtlUrl: "https://www.cnrtl.fr/definition/acrobatisme",
    });
  });

  it("refuse de construire une manche Genre depuis un autre type de défi", () => {
    expect(() => buildMultiplayerGenderRound({
      kind: "category",
      term: "sérieux",
      lemma: "sérieux",
      prompt: "Quelle catégorie ?",
      choices: ["Nom commun", "Adjectif"],
      answer: "Adjectif",
      correction: "Morphalou le classe comme adjectif.",
      context: "Contexte : « Le détail sérieux surprend le lecteur. »",
      source: { name: "Morphalou 3", license: "LGPL-LR", cnrtlUrl: "https://www.cnrtl.fr/definition/s%C3%A9rieux" },
    })).toThrow("manche Genre");
  });

  it("ne révèle jamais une solution Mots liés inadaptée provenant d’un ancien salon", () => {
    expect(buildRevealedDefinitionSolution(
      { entryId: 7, lemma: "partouzard" },
      { definitionId: 9, text: "Homme qui s'adonne à une partouze." },
    )).toBeNull();
    expect(buildRevealedDefinitionSolution(
      { entryId: 8, lemma: "minerval" },
      { definitionId: 10, text: "Frais d’inscription à l’université." },
    )).toMatchObject({ lemma: "minerval", definitionId: 10 });
  });

  it("donne à la Boussole Motus une première lettre réellement présente", () => {
    expect(getMotusCompassMessage("fable")).toBe("Boussole : le mot commence par « F ».");
    expect(getMotusCompassMessage("ananas")).toBe("Boussole : le mot commence par « A », présente 3 fois.");
  });

  it("interdit la durée Libre pour une partie hardcore", () => {
    expect(isHardcoreCompatible({ isHardcore: true, roundDurationSeconds: 0 })).toBe(false);
    expect(isHardcoreCompatible({ isHardcore: true, roundDurationSeconds: 45 })).toBe(true);
    expect(isHardcoreCompatible({ isHardcore: false, roundDurationSeconds: 0 })).toBe(true);
  });

  it("conserve le mode Détente sans durée imposée comme réglage initial", () => {
    expect(DEFAULT_MULTIPLAYER_PRESET).toBe("relax");
    expect(FREE_MULTIPLAYER_ROUND_DURATION_SECONDS).toBe(0);
  });

  it("normalise uniquement une lettre française utilisable pour le troc", () => {
    expect(normalizeTradeLetter("é")).toBe("E");
    expect(normalizeTradeLetter(" t ")).toBe("T");
    expect(normalizeTradeLetter("ab")).toBeNull();
    expect(normalizeTradeLetter("7")).toBeNull();
    expect(normalizeTradeLetter("?")).toBeNull();
  });

  it("n’autorise une jointure que dans un lobby disposant réellement d’une place", () => {
    expect(canJoinMultiplayerLobby({ status: "lobby", playerCount: 7 })).toBe(true);
    expect(canJoinMultiplayerLobby({ status: "lobby", playerCount: 8 })).toBe(false);
    expect(canJoinMultiplayerLobby({ status: "active", playerCount: 2 })).toBe(false);
  });

  it("autorise l’hôte à lancer dès que deux joueurs sont présents", () => {
    expect(canStartMultiplayerRound({ isHost: true, playerCount: 2 })).toBe(true);
    expect(canStartMultiplayerRound({ isHost: true, playerCount: 1 })).toBe(false);
    expect(canStartMultiplayerRound({ isHost: false, playerCount: 3 })).toBe(false);
  });

  it("refuse de passer à la manche suivante hors d’une table active ou après la limite", () => {
    expect(canAdvanceMultiplayerRound({ status: "active", currentRoundIndex: 1, roundLimit: 5 })).toBe(true);
    expect(canAdvanceMultiplayerRound({ status: "lobby", currentRoundIndex: 0, roundLimit: 5 })).toBe(false);
    expect(canAdvanceMultiplayerRound({ status: "active", currentRoundIndex: 6, roundLimit: 5 })).toBe(false);
  });

  it("permet de poursuivre après une échéance résolue, uniquement pour la dernière manche attendue", () => {
    const room = { status: "active" as const, currentRoundIndex: 2, roundLimit: 5 };
    expect(canContinueMultiplayerRound({ room, expectedRoundId: 41, latestRound: { id: 41, position: 2, status: "resolved" } })).toBe(true);
    expect(canContinueMultiplayerRound({ room, expectedRoundId: 40, latestRound: { id: 41, position: 2, status: "resolved" } })).toBe(false);
    expect(canContinueMultiplayerRound({ room, expectedRoundId: 41, latestRound: { id: 41, position: 1, status: "resolved" } })).toBe(false);
  });

  it("attribue un index de tentative séquentiel à chaque joueur dans une grille Mots liés", () => {
    const submissions = [{ playerId: 17 }, { playerId: 42 }, { playerId: 17 }];
    expect(getNextMultiplayerAttemptIndex(17, submissions)).toBe(3);
    expect(getNextMultiplayerAttemptIndex(42, submissions)).toBe(2);
  });
});
