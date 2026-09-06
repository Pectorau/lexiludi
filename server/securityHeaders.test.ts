import { describe, expect, it } from "vitest";
import { buildSecurityHeaders } from "./_core/securityHeaders";

describe("en-têtes de sécurité", () => {
  it("applique des protections de base dans tous les environnements", () => {
    const headers = buildSecurityHeaders({ isProduction: false });
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["Content-Security-Policy"]).toBeUndefined();
  });

  it("construit une CSP de production restreinte aux intégrations configurées", () => {
    const headers = buildSecurityHeaders({ isProduction: true, analyticsEndpoint: "https://stats.example.test", forgeEndpoint: "https://forge.example.test/v1" });
    expect(headers["Content-Security-Policy"]).toContain("default-src 'self'");
    expect(headers["Content-Security-Policy"]).toContain("https://stats.example.test");
    expect(headers["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
  });
});
