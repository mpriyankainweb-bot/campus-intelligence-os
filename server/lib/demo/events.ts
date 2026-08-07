/**
 * Campus events store (in-memory).
 *
 * A catalog of upcoming campus events (workshops, hackathons, seminars,
 * placement drives) plus registrations. In demo mode everything lives in
 * memory; the same endpoints switch to a database-backed implementation when
 * Supabase is configured.
 */

export type EventType =
  | "workshop"
  | "hackathon"
  | "seminar"
  | "placement_drive"
  | "webinar";

export type CampusEvent = {
  id: number;
  title: string;
  type: EventType;
  date: string; // ISO date (YYYY-MM-DD)
  start: string; // e.g. "10:00 AM"
  end: string;
  location: string;
  description: string;
  audience: "student" | "faculty" | "principal" | "all";
  capacity: number;
  registered: number;
};

function addDays(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function seedEvents(): CampusEvent[] {
  const today = new Date();
  const nextWeekday = (weekday: number) => {
    // weekday: 0=Sun..6=Sat. Next occurrence at/after tomorrow.
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    while (d.getDay() !== weekday) d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  };
  const saturday = nextWeekday(6);

  return [
    {
      id: 1,
      title: "Generative AI & Prompt Engineering Workshop",
      type: "workshop",
      date: addDays(today, 1),
      start: "10:00 AM",
      end: "1:00 PM",
      location: "Tech Hall, Room T-301",
      description:
        "Hands-on workshop on building AI-powered apps with Gemini: prompt design, RAG patterns and guardrails. Laptops required.",
      audience: "all",
      capacity: 60,
      registered: 41,
    },
    {
      id: 2,
      title: "Smart Campus Hackathon 2026",
      type: "hackathon",
      date: saturday,
      start: "9:00 AM",
      end: "9:00 PM",
      location: "Innovation Center",
      description:
        "24-hour build sprint. Form teams of 2-4 and build solutions for campus operations, accessibility and sustainability. Prizes worth ₹1L.",
      audience: "student",
      capacity: 120,
      registered: 87,
    },
    {
      id: 3,
      title: "Placement Drive — Google Campus Recruiting",
      type: "placement_drive",
      date: addDays(today, 5),
      start: "8:30 AM",
      end: "5:00 PM",
      location: "Placement Cell, Block C",
      description:
        "On-campus drive for SWE internships. Written test followed by technical interviews. Carry updated resume and ID.",
      audience: "student",
      capacity: 200,
      registered: 164,
    },
    {
      id: 4,
      title: "Research Methodology Seminar",
      type: "seminar",
      date: addDays(today, 3),
      start: "2:00 PM",
      end: "4:00 PM",
      location: "Seminar Hall 2",
      description:
        "Dr. Anjali Menon walks through publishing strategies, research ethics and funding opportunities for early-career faculty.",
      audience: "faculty",
      capacity: 50,
      registered: 33,
    },
    {
      id: 5,
      title: "Startup Weekend — Idea to MVP",
      type: "workshop",
      date: addDays(today, 8),
      start: "11:00 AM",
      end: "6:00 PM",
      location: "Incubation Center",
      description:
        "Work with mentors from the incubation cell to validate an idea and ship an MVP in two days.",
      audience: "student",
      capacity: 40,
      registered: 22,
    },
    {
      id: 6,
      title: "Interview Prep Bootcamp",
      type: "webinar",
      date: addDays(today, 2),
      start: "6:00 PM",
      end: "8:00 PM",
      location: "Online (stream link emailed)",
      description:
        "Mock interviews, DSA rapid-fire rounds and HR round walkthroughs with placement-cell coaches.",
      audience: "student",
      capacity: 300,
      registered: 178,
    },
    {
      id: 7,
      title: "HOD Review & Department Strategy Meet",
      type: "seminar",
      date: addDays(today, 4),
      start: "10:00 AM",
      end: "12:00 PM",
      location: "Boardroom, Admin Block",
      description:
        "Quarterly review of departmental KPIs, budgets and staffing with the principal and HODs.",
      audience: "principal",
      capacity: 30,
      registered: 12,
    },
  ];
}

let events: CampusEvent[] | null = null;
const registrations = new Map<string, Set<number>>(); // key: `${persona}:${userId}`

function getEvents(): CampusEvent[] {
  if (!events) events = seedEvents();
  return events;
}

export function listCampusEvents(): CampusEvent[] {
  return getEvents().map((e) => ({ ...e }));
}

export function getEvent(eventId: number): CampusEvent | undefined {
  return getEvents().find((e) => e.id === eventId);
}

export function isRegistered(key: string, eventId: number): boolean {
  return registrations.get(key)?.has(eventId) ?? false;
}

export function registeredEventIds(key: string): number[] {
  return Array.from(registrations.get(key) ?? []);
}

export function registerForEvent(key: string, eventId: number): CampusEvent | null {
  const event = getEvent(eventId);
  if (!event) return null;
  const set = registrations.get(key) ?? new Set<number>();
  set.add(eventId);
  registrations.set(key, set);
  return { ...event };
}

export function unregisterForEvent(key: string, eventId: number): void {
  registrations.get(key)?.delete(eventId);
}
