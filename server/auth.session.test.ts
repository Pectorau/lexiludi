import { describe, expect, it } from "vitest";
import { sdk } from "./_core/sdk";

describe("contrat de session révocable", () => {
  it("conserve la version de session dans le jeton signé", async () => {
    const token = await sdk.createSessionToken("audit-session-user", { name: "Audit", sessionVersion: 3, expiresInMs: 60_000 });
    await expect(sdk.verifySession(token)).resolves.toMatchObject({ openId: "audit-session-user", sessionVersion: 3 });
  });

  it("refuse un jeton signé pour une autre application", async () => {
    const token = await sdk.signSession({ openId: "audit-session-user", appId: "other-app", name: "Audit", sessionVersion: 1 }, { expiresInMs: 60_000 });
    await expect(sdk.verifySession(token)).resolves.toBeNull();
  });
});
