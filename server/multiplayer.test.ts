import { describe, expect, it } from "vitest";
import { createFogEffect, fogDurationMilliseconds, getMotusPoints, getQuizPoints, isDefinitionVariant, isFogEffectActive, isMotusVariant, isMultiplayerRoundDuration, isMultiplayerRoundLimit, isPeekEffectActive, isQuizVariant, isRoomVisibility, isShieldEffectActive, makeRoomCode, motusMultiplayerFormats, peekDurationMilliseconds, shieldDurationMilliseconds } from "./multiplayer";

describe("règles multijoueurs", () => {
  it("attribue des scores décroissants aux réponses Quiz correctes", () => {
    expect(getQuizPoints(0)).toBe(100);
    expect(getQuizPoints(1)).toBe(70);
    expect(getQuizPoints(4)).toBe(20);
  });

  it("tient compte du rang et des essais dans le score Motus", () => {
    expect(getMotusPoints(0, 1)).toBe(100);
    expect(getMotusPoints(1, 3)).toBe(60);
    expect(getMotusPoints(9, 20)).toBe(20);
  });

  it("valide les variantes et crée des codes de salon partageables", () => {
    expect(isQuizVariant("truefalse")).toBe(true);
    expect(isQuizVariant("gender")).toBe(true);
    expect(isQuizVariant("infinitive")).toBe(false);
    expect(isMotusVariant("sprint")).toBe(true);
    expect(motusMultiplayerFormats.long.attempts).toBe(8);
    expect(makeRoomCode()).toMatch(/^[A-Z2-9]{6}$/);
  });

  it("accepte les variantes relationnelles et les deux visibilités de salon", () => {
    expect(isDefinitionVariant("synonym")).toBe(true);
    expect(isDefinitionVariant("antonym")).toBe(true);
    expect(isDefinitionVariant("intruder")).toBe(true);
    expect(isDefinitionVariant("family")).toBe(false);
    expect(isRoomVisibility("public")).toBe(true);
    expect(isRoomVisibility("private")).toBe(true);
    expect(isRoomVisibility("hidden")).toBe(false);
  });

  it("garde les formats Motus cohérents entre longueur de mot et nombre d’essais", () => {
    expect(motusMultiplayerFormats.sprint).toEqual({ attempts: 4, minLength: 4, maxLength: 6 });
    expect(motusMultiplayerFormats.classic).toEqual({ attempts: 6, minLength: 4, maxLength: 8 });
    expect(motusMultiplayerFormats.long).toEqual({ attempts: 8, minLength: 7, maxLength: 12 });
  });

  it("limite les options de personnalisation aux règles prévues", () => {
    expect(isMultiplayerRoundLimit(3)).toBe(true);
    expect(isMultiplayerRoundLimit(10)).toBe(true);
    expect(isMultiplayerRoundLimit(12)).toBe(true);
    expect(isMultiplayerRoundLimit(6)).toBe(false);
    expect(isMultiplayerRoundDuration(0)).toBe(true);
    expect(isMultiplayerRoundDuration(30)).toBe(true);
    expect(isMultiplayerRoundDuration(60)).toBe(true);
    expect(isMultiplayerRoundDuration(75)).toBe(true);
    expect(isMultiplayerRoundDuration(90)).toBe(false);
  });

  it("applique le Brouillard uniquement à la cible pendant cinq secondes", () => {
    const now = Date.parse("2026-08-14T18:20:00.000Z");
    const effect = { kind: "fog", targetPlayerId: 8, endsAt: new Date(now + fogDurationMilliseconds).toISOString() };
    expect(fogDurationMilliseconds).toBe(5_000);
    expect(isFogEffectActive(effect, 8, now + 4_999)).toBe(true);
    expect(isFogEffectActive(effect, 7, now + 4_999)).toBe(false);
    expect(isFogEffectActive(effect, 8, now + 5_000)).toBe(false);
  });

  it("ne rend pas actif un Brouillard dissipé par une Parade", () => {
    const now = Date.parse("2026-08-14T18:20:00.000Z");
    const effect = { kind: "fog", targetPlayerId: 8, endsAt: new Date(now + fogDurationMilliseconds).toISOString(), prevented: true };
    expect(isFogEffectActive(effect, 8, now + 1_000)).toBe(false);
  });

  it("active la Parade pendant six secondes et la consomme au déclenchement", () => {
    const now = Date.parse("2026-08-14T18:20:00.000Z");
    const effect = { kind: "shield", endsAt: new Date(now + shieldDurationMilliseconds).toISOString() };
    expect(shieldDurationMilliseconds).toBe(6_000);
    expect(isShieldEffectActive(effect, now + 5_999)).toBe(true);
    expect(isShieldEffectActive(effect, now + 6_000)).toBe(false);
    expect(isShieldEffectActive({ ...effect, triggeredAt: "2026-08-14T18:20:00.000Z" }, now + 1_000)).toBe(false);
    expect(isShieldEffectActive({ kind: "fog" })).toBe(false);
  });

  it("neutralise le Brouillard avec une Parade sans affecter l’auteur", () => {
    const now = Date.parse("2026-08-14T18:20:00.000Z");
    const endsAt = new Date(now + fogDurationMilliseconds).toISOString();
    const blocked = createFogEffect(8, "Cible", endsAt, true);
    const applied = createFogEffect(8, "Cible", endsAt, false);
    expect(isFogEffectActive(blocked, 8, now + 1_000)).toBe(false);
    expect(isFogEffectActive(applied, 7, now + 1_000)).toBe(false);
    expect(isFogEffectActive(applied, 8, now + 1_000)).toBe(true);
  });

  it("limite l’aperçu adverse à trois secondes", () => {
    const now = Date.parse("2026-08-14T18:20:00.000Z");
    const effect = { kind: "peek", endsAt: new Date(now + peekDurationMilliseconds).toISOString() };
    expect(peekDurationMilliseconds).toBe(3_000);
    expect(isPeekEffectActive(effect, now + 2_999)).toBe(true);
    expect(isPeekEffectActive(effect, now + 3_000)).toBe(false);
  });

});
