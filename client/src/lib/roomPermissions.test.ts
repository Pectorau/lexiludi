import { describe, expect, it } from "vitest";
import { canManageRoomSettings } from "./roomPermissions";

describe("autorisations de réglages du salon", () => {
  it("réserve la modification des règles à l’hôte pendant la préparation", () => {
    expect(canManageRoomSettings({ isHost: true, status: "lobby" })).toBe(true);
    expect(canManageRoomSettings({ isHost: false, status: "lobby" })).toBe(false);
    expect(canManageRoomSettings({ isHost: true, status: "active" })).toBe(false);
    expect(canManageRoomSettings({ isHost: true, status: "finished" })).toBe(false);
  });
});
