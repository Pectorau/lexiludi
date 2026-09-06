import type { RequestHandler } from "express";

type Bucket = { count: number; resetAt: number };

export function createFixedWindowLimiter(options: { windowMs: number; max: number; keyPrefix: string }) {
  const buckets = new Map<string, Bucket>();
  return (key: string, now = Date.now()) => {
    const bucketKey = `${options.keyPrefix}:${key}`;
    const current = buckets.get(bucketKey);
    if (!current || current.resetAt <= now) {
      buckets.set(bucketKey, { count: 1, resetAt: now + options.windowMs });
      return { allowed: true, retryAfterSeconds: 0 };
    }
    current.count += 1;
    return { allowed: current.count <= options.max, retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1_000)) };
  };
}

function requestIp(request: Parameters<RequestHandler>[0]) {
  return request.ip || request.socket.remoteAddress || "anonymous";
}

const limitPublicMutation = createFixedWindowLimiter({ keyPrefix: "public-mutation", windowMs: 60_000, max: 45 });

/** Protège les mutations publiques coûteuses sans freiner la lecture/polling des salons. */
export const publicMutationRateLimit: RequestHandler = (req, res, next) => {
  if (req.method !== "POST") return next();
  const procedures = (req.path.split("/").pop() ?? "").split(",");
  const isPublicWrite = procedures.some((procedure) => /^(multiplayer\.|solo\.start|daily\.start|herbarium\.(createTheme|updateTheme|deleteTheme|savePlacement|removePlacement|saveCanvas))/.test(procedure));
  if (!isPublicWrite) return next();
  const result = limitPublicMutation(requestIp(req));
  if (result.allowed) return next();
  res.setHeader("Retry-After", String(result.retryAfterSeconds));
  res.status(429).json({ error: "Trop d’actions rapprochées. Patientez un instant avant de reprendre." });
};
