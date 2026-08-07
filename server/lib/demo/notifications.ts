/**
 * Notification center (in-memory).
 *
 * Persona-scoped notification feeds with per-user read tracking, keyed by
 * `${persona}:${openId}` so demo and local accounts stay isolated. Falls back
 * gracefully to a seeded feed when no database is configured.
 */

export type NotificationType = "info" | "warning" | "critical" | "success";

export type NotificationItem = {
  id: number;
  type: NotificationType;
  title: string;
  body: string;
  time: string;
  unread: boolean;
};

const seedStudent = (): NotificationItem[] => [
  { id: 1, type: "warning", title: "Discrete Math alert", body: "Attendance at 62% — below the 75% threshold. Faculty intervention is being scheduled.", time: "2h ago", unread: true },
  { id: 2, type: "success", title: "Attendance milestone", body: "You crossed 85% in Computer Networks. Keep it up!", time: "5h ago", unread: true },
  { id: 3, type: "info", title: "New internship", body: "Microsoft Research Summer Fellowship is now open. Apply before the deadline.", time: "1d ago", unread: true },
  { id: 4, type: "info", title: "Assignment reminder", body: "Graph Algorithms Problem Set is due tomorrow at 11:59 PM.", time: "1d ago", unread: false },
  { id: 5, type: "info", title: "Placement update", body: "Google campus drive registration closes Friday — 45 days to the test.", time: "2d ago", unread: false },
  { id: 6, type: "info", title: "Workshop reminder", body: "Generative AI & Prompt Engineering Workshop starts tomorrow at 10 AM.", time: "2d ago", unread: false },
];

const seedFaculty = (): NotificationItem[] => [
  { id: 1, type: "warning", title: "Intervention needed", body: "3 students in CS305 are below 65% attendance. Review and file intervention plans.", time: "3h ago", unread: true },
  { id: 2, type: "info", title: "Leave request", body: "Dr. K. Nair requested medical leave Aug 12–14. Action required.", time: "5h ago", unread: true },
  { id: 3, type: "info", title: "Evaluation reminder", body: "16 submissions of the Graph Algorithms set are still ungraded.", time: "8h ago", unread: true },
  { id: 4, type: "success", title: "Assignment graded", body: "Network Topology Report fully reviewed — 45/45 graded.", time: "1d ago", unread: false },
  { id: 5, type: "info", title: "Meeting reminder", body: "Faculty senate meets Thursday 3 PM in Seminar Hall 2.", time: "1d ago", unread: false },
];

const seedPrincipal = (): NotificationItem[] => [
  { id: 1, type: "critical", title: "Attendance crisis — ECE", body: "Third-year ECE attendance below 70% for 2 consecutive weeks.", time: "1h ago", unread: true },
  { id: 2, type: "warning", title: "Approvals queue", body: "3 high-impact actions are awaiting your decision.", time: "4h ago", unread: true },
  { id: 3, type: "info", title: "Department report", body: "Q3 department reports from CSE and ME are ready for review.", time: "6h ago", unread: true },
  { id: 4, type: "success", title: "Grant approved", body: "Applied AI lab secured ₹40L research funding.", time: "1d ago", unread: false },
  { id: 5, type: "info", title: "Faculty notification", body: "2 faculty members flagged for overload next semester.", time: "2d ago", unread: false },
];

function seedFor(persona: string): NotificationItem[] {
  if (persona === "faculty") return seedFaculty();
  if (persona === "principal") return seedPrincipal();
  return seedStudent();
}

const feeds = new Map<string, NotificationItem[]>();
let idCounter = 1000;

function key(persona: string, openId: string): string {
  return `${persona}:${openId}`;
}

function ensureFeed(persona: string, openId: string): NotificationItem[] {
  const k = key(persona, openId);
  let feed = feeds.get(k);
  if (!feed) {
    feed = seedFor(persona);
    feeds.set(k, feed);
  }
  return feed;
}

export function listNotifications(persona: string, openId: string): NotificationItem[] {
  return ensureFeed(persona, openId).map((n) => ({ ...n }));
}

export function markNotificationRead(persona: string, openId: string, id: number): boolean {
  const feed = ensureFeed(persona, openId);
  const item = feed.find((n) => n.id === id);
  if (!item) return false;
  item.unread = false;
  return true;
}

export function markAllNotificationsRead(persona: string, openId: string): number {
  const feed = ensureFeed(persona, openId);
  let count = 0;
  for (const item of feed) {
    if (item.unread) {
      item.unread = false;
      count += 1;
    }
  }
  return count;
}

/** Push a new notification to the top of a user's feed (used by event registration etc.). */
export function pushNotification(
  persona: string,
  openId: string,
  item: { type: NotificationType; title: string; body: string }
): NotificationItem {
  const feed = ensureFeed(persona, openId);
  const created: NotificationItem = {
    id: idCounter++,
    ...item,
    time: "just now",
    unread: true,
  };
  feed.unshift(created);
  return created;
}

/** System-generated feed that reflects the user's actual openId (demo/local/supabase). */
export function systemKey(persona: string, openId: string): string {
  return key(persona, openId);
}
