export function canManageRoomSettings(input: { isHost: boolean; status: "lobby" | "active" | "finished" }) {
  return input.isHost && input.status === "lobby";
}
