export type RoomSystemEvent = {
  type: string;
  summary: string;
};

/** Les événements arrivent du serveur du plus récent au plus ancien. */
export function getLatestRoomSystemAnnouncement(events: readonly RoomSystemEvent[] | undefined) {
  const announcement = events?.find((event) => event.type === "admin_announcement");
  if (!announcement) return null;

  const summary = announcement.summary.replace(/^\[Système\]\s*/i, "").trim();
  return summary || "Annonce de l’administration.";
}
