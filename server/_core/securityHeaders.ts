import type { RequestHandler } from "express";

function trustedOrigin(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.origin : null;
  } catch {
    return null;
  }
}

export function buildSecurityHeaders(input: { isProduction: boolean; analyticsEndpoint?: string; forgeEndpoint?: string }) {
  const headers: Record<string, string> = {
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Permissions-Policy": "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
  };
  if (!input.isProduction) return headers;

  const analyticsOrigin = trustedOrigin(input.analyticsEndpoint);
  const forgeOrigin = trustedOrigin(input.forgeEndpoint) ?? "https://forge.butterfly-effect.dev";
  const scriptSources = ["'self'", analyticsOrigin, forgeOrigin, "https://maps.googleapis.com", "https://maps.gstatic.com"].filter(Boolean).join(" ");
  const connectSources = ["'self'", analyticsOrigin, forgeOrigin, "https://maps.googleapis.com", "https://*.googleapis.com"].filter(Boolean).join(" ");
  headers["Content-Security-Policy"] = [
    "default-src 'self'",
    `script-src ${scriptSources}`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "img-src 'self' data: blob: https:",
    `connect-src ${connectSources}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
  return headers;
}

export function securityHeaders(options: { isProduction: boolean; analyticsEndpoint?: string; forgeEndpoint?: string }): RequestHandler {
  const headers = buildSecurityHeaders(options);
  return (_req, res, next) => {
    Object.entries(headers).forEach(([name, value]) => res.setHeader(name, value));
    next();
  };
}
