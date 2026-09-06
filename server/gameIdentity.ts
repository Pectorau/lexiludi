import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import type { TrpcContext } from "./_core/context";
import { getSessionCookieOptions } from "./_core/cookies";
import { getDb } from "./db";
import { gameIdentities } from "../drizzle/schema";

export const GAME_IDENTITY_COOKIE = "motif-game-id";

const anonymousIdentityLimit = new Map<string, { count: number; resetAt: number }>();

export function canCreateAnonymousIdentity(ip: string, now = Date.now()) {
  const key = ip || "anonymous";
  const current = anonymousIdentityLimit.get(key);
  if (!current || current.resetAt <= now) {
    anonymousIdentityLimit.set(key, { count: 1, resetAt: now + 60 * 60 * 1_000 });
    return true;
  }
  current.count += 1;
  return current.count <= 12;
}

function readCookie(raw: string | undefined, name: string) {
  if (!raw) return null;
  const prefix = `${name}=`;
  const value = raw.split(";").map((part) => part.trim()).find((part) => part.startsWith(prefix));
  return value ? decodeURIComponent(value.slice(prefix.length)) : null;
}
function isSafeIdentity(value: string | null): value is string { return Boolean(value && /^[A-Za-z0-9_-]{32,64}$/.test(value)); }
function newIdentity() { return crypto.randomBytes(32).toString("base64url"); }

/** Crée ou réutilise l’identité HttpOnly qui autorise la reprise de la session de jeu de ce navigateur. */
export async function getOrCreateGameIdentity(ctx: Pick<TrpcContext, "req" | "res">) {
  const current = readCookie(ctx.req.headers.cookie, GAME_IDENTITY_COOKIE);
  const identity = isSafeIdentity(current) ? current : newIdentity();
  if (identity !== current && !canCreateAnonymousIdentity(ctx.req.ip ?? ctx.req.socket.remoteAddress ?? "anonymous")) {
    throw new Error("Trop de nouvelles sessions ont été créées depuis cette connexion. Réessayez dans une heure.");
  }
  const db = await getDb();
  if (!db) throw new Error("La persistance des sessions de jeu est indisponible.");
  await db.insert(gameIdentities).values({ id: identity, lastSeenAt: new Date() }).onDuplicateKeyUpdate({ set: { lastSeenAt: new Date() } });
  if (identity !== current) ctx.res.cookie(GAME_IDENTITY_COOKIE, identity, { ...getSessionCookieOptions(ctx.req), maxAge: 1000 * 60 * 60 * 24 * 180, httpOnly: true, sameSite: "lax" });
  return identity;
}
