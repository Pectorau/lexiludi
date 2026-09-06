import { describe, expect, it } from "vitest";
import { canCreateAnonymousIdentity } from "./gameIdentity";
import { createFixedWindowLimiter } from "./_core/rateLimit";
import { isSafePublicStorageKey } from "./_core/storageProxy";

describe("protections des surfaces publiques", () => {
  it("n’accepte que des clés de stockage explicitement publiques et sans traversée", () => {
    expect(isSafePublicStorageKey("public/images/grimoire.png")).toBe(true);
    expect(isSafePublicStorageKey("private/notes.txt")).toBe(false);
    expect(isSafePublicStorageKey("public/../secrets.txt")).toBe(false);
    expect(isSafePublicStorageKey("public//images/a.png")).toBe(false);
  });

  it("bloque une rafale de mutations après le quota de la fenêtre", () => {
    const limit = createFixedWindowLimiter({ keyPrefix: "test", windowMs: 60_000, max: 2 });
    expect(limit("127.0.0.1", 0).allowed).toBe(true);
    expect(limit("127.0.0.1", 1).allowed).toBe(true);
    expect(limit("127.0.0.1", 2).allowed).toBe(false);
    expect(limit("127.0.0.1", 60_001).allowed).toBe(true);
  });

  it("plafonne la création d’identités anonymes sans limiter une identité déjà existante", () => {
    const ip = `audit-${Date.now()}`;
    expect(Array.from({ length: 12 }, () => canCreateAnonymousIdentity(ip)).every(Boolean)).toBe(true);
    expect(canCreateAnonymousIdentity(ip)).toBe(false);
  });
});
