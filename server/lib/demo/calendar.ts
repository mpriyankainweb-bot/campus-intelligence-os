/**
 * Calendar event generator (in-memory).
 *
 * Produces persona-scoped calendar events automatically from demo data:
 * - Student: classes, exams, workshops, assignment deadlines
 * - Faculty: classes, meetings, evaluation deadlines
 * - Principal: meetings, institutional events, administrative reviews
 *
 * Registered campus events are merged in so registering for an event from the
 * Events page (or via the AI assistant) immediately shows on the calendar.
 */

import { listCampusEvents, registeredEventIds, getEvent } from "./events";

export type CalendarEventType =
  | "class"
  | "exam"
  | "workshop"
  | "assignment"
  | "meeting"
  | "review"
  | "event"
  | "deadline";

export type CalendarEvent = {
  id: string;
  date: string; // YYYY-MM-DD
  start: string;
  end: string;
  title: string;
  location: string;
  type: CalendarEventType;
  description?: string;
  source: "schedule" | "registered" | "custom";
};

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Student weekly class timetable: weekday (0=Sun) -> sessions. */
const CLASSES: Array<{ weekday: number; start: string; end: string; title: string; location: string; instructor: string }> = [
  { weekday: 1, start: "09:00", end: "10:00", title: "Data Structures", location: "A-204", instructor: "Dr. Rao" },
  { weekday: 1, start: "11:00", end: "12:00", title: "Computer Networks", location: "B-110", instructor: "Prof. Nair" },
  { weekday: 1, start: "14:00", end: "16:00", title: "Operating Systems Lab", location: "Lab-3", instructor: "Dr. Rao" },
  { weekday: 2, start: "10:00", end: "11:00", title: "Discrete Mathematics", location: "A-101", instructor: "Dr. Shah" },
  { weekday: 2, start: "13:00", end: "15:00", title: "Data Structures Lab", location: "Lab-1", instructor: "Dr. Rao" },
  { weekday: 3, start: "09:00", end: "10:00", title: "Operating Systems", location: "A-204", instructor: "Prof. Iyer" },
  { weekday: 3, start: "11:00", end: "12:00", title: "Computer Networks", location: "B-110", instructor: "Prof. Nair" },
  { weekday: 3, start: "15:00", end: "16:00", title: "Career Counseling", location: "CC-02", instructor: "Placement Cell" },
  { weekday: 4, start: "10:00", end: "11:00", title: "Discrete Mathematics", location: "A-101", instructor: "Dr. Shah" },
  { weekday: 4, start: "13:00", end: "15:00", title: "Operating Systems Lab", location: "Lab-2", instructor: "Prof. Iyer" },
  { weekday: 5, start: "09:00", end: "10:00", title: "Data Structures", location: "A-204", instructor: "Dr. Rao" },
  { weekday: 5, start: "11:00", end: "12:00", title: "Computer Networks", location: "B-110", instructor: "Prof. Nair" },
];

/** Faculty recurring classes. */
const FACULTY_CLASSES: Array<{ weekday: number; start: string; end: string; title: string; location: string }> = [
  { weekday: 1, start: "09:00", end: "10:00", title: "CS301 Data Structures", location: "A-204" },
  { weekday: 2, start: "09:00", end: "10:00", title: "CS305 Operating Systems", location: "A-204" },
  { weekday: 3, start: "14:00", end: "15:00", title: "CS310 Advanced Algorithms", location: "B-115" },
  { weekday: 4, start: "11:00", end: "12:00", title: "CS320 Software Engineering", location: "A-102" },
  { weekday: 5, start: "09:00", end: "10:00", title: "CS301 Data Structures", location: "A-204" },
];

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function nextWeekday(base: Date, weekday: number): Date {
  // First occurrence of `weekday` on or after `base` (so today's classes show).
  const d = new Date(base);
  d.setHours(0, 0, 0, 0);
  while (d.getDay() !== weekday) d.setDate(d.getDate() + 1);
  return d;
}

let counter = 0;
function nextId(): string {
  counter += 1;
  return `cal-${counter}`;
}

/**
 * Custom calendar events (in-memory, per user key).
 *
 * Lets the AI assistant's `createCalendarEvent` tool genuinely add events to
 * the user's calendar instead of just describing them.
 */
const customEvents = new Map<string, CalendarEvent[]>();

export function addCustomCalendarEvent(
  key: string,
  event: Omit<CalendarEvent, "id" | "source">
): CalendarEvent {
  const created: CalendarEvent = { ...event, id: nextId(), source: "custom" };
  const list = customEvents.get(key) ?? [];
  list.push(created);
  customEvents.set(key, list);
  return created;
}

export function listCustomCalendarEvents(key: string): CalendarEvent[] {
  return (customEvents.get(key) ?? []).map((e) => ({ ...e }));
}

function buildStudentEvents(): CalendarEvent[] {
  const today = new Date();
  const out: CalendarEvent[] = [];

  // Recurring classes for the next 4 weeks
  for (let w = 0; w < 4; w++) {
    for (const c of CLASSES) {
      const date = addDays(today, w * 7);
      const d = nextWeekday(date, c.weekday);
      out.push({
        id: nextId(),
        date: iso(d),
        start: c.start,
        end: c.end,
        title: c.title,
        location: c.location,
        type: "class",
        description: `Instructor: ${c.instructor}`,
        source: "schedule",
      });
    }
  }

  // Exams over the next 2 weeks
  const exams = [
    { offset: 2, title: "Computer Networks — Unit Test 2", location: "Exam Hall 1", start: "09:30", end: "11:30" },
    { offset: 5, title: "Data Structures — Midterm", location: "Exam Hall 2", start: "09:30", end: "12:00" },
    { offset: 9, title: "Discrete Mathematics — Quiz", location: "A-101", start: "10:00", end: "11:00" },
  ];
  for (const e of exams) {
    out.push({
      id: nextId(),
      date: iso(addDays(today, e.offset)),
      start: e.start,
      end: e.end,
      title: e.title,
      location: e.location,
      type: "exam",
      description: "Attendance above 75% required to sit the exam.",
      source: "schedule",
    });
  }

  // Assignment deadlines over the next 2 weeks
  const deadlines = [
    { offset: 1, title: "Graph Algorithms Problem Set due", location: "LMS", start: "23:59", end: "23:59" },
    { offset: 4, title: "Process Scheduling Simulation due", location: "LMS", start: "23:59", end: "23:59" },
    { offset: 7, title: "Set Theory Proofs due", location: "LMS", start: "23:59", end: "23:59" },
  ];
  for (const d of deadlines) {
    out.push({
      id: nextId(),
      date: iso(addDays(today, d.offset)),
      start: d.start,
      end: d.end,
      title: d.title,
      location: d.location,
      type: "assignment",
      description: "Submit on the LMS portal before the deadline.",
      source: "schedule",
    });
  }

  return out;
}

function buildFacultyEvents(): CalendarEvent[] {
  const today = new Date();
  const out: CalendarEvent[] = [];

  for (let w = 0; w < 4; w++) {
    for (const c of FACULTY_CLASSES) {
      const date = addDays(today, w * 7);
      const d = nextWeekday(date, c.weekday);
      out.push({
        id: nextId(),
        date: iso(d),
        start: c.start,
        end: c.end,
        title: c.title,
        location: c.location,
        type: "class",
        source: "schedule",
      });
    }
  }

  const meetings = [
    { offset: 1, title: "Faculty Senate", location: "Seminar Hall 2", start: "15:00", end: "16:30" },
    { offset: 4, title: "HOD Review & Department Strategy Meet", location: "Boardroom", start: "10:00", end: "12:00" },
    { offset: 8, title: "Curriculum Committee", location: "Boardroom", start: "14:00", end: "16:00" },
  ];
  for (const m of meetings) {
    out.push({
      id: nextId(),
      date: iso(addDays(today, m.offset)),
      start: m.start,
      end: m.end,
      title: m.title,
      location: m.location,
      type: "meeting",
      source: "schedule",
    });
  }

  // Evaluation deadlines
  const evals = [
    { offset: 2, title: "Grade CS301 Graph Algorithms submissions", location: "LMS", start: "23:59", end: "23:59" },
    { offset: 6, title: "Submit CS305 attendance intervention reports", location: "LMS", start: "23:59", end: "23:59" },
  ];
  for (const e of evals) {
    out.push({
      id: nextId(),
      date: iso(addDays(today, e.offset)),
      start: e.start,
      end: e.end,
      title: e.title,
      location: e.location,
      type: "deadline",
      description: "Flagged as due — students are waiting on feedback.",
      source: "schedule",
    });
  }

  return out;
}

function buildPrincipalEvents(): CalendarEvent[] {
  const today = new Date();
  const out: CalendarEvent[] = [];

  const items = [
    { offset: 1, title: "Executive Review — Campus KPI Dashboard", location: "Boardroom", start: "09:00", end: "10:30", type: "review" as const },
    { offset: 3, title: "HOD Review & Department Strategy Meet", location: "Boardroom", start: "10:00", end: "12:00", type: "meeting" as const },
    { offset: 5, title: "Placement Drive — Google Campus Recruiting", location: "Placement Cell", start: "08:30", end: "17:00", type: "event" as const },
    { offset: 7, title: "Budget Committee Meeting", location: "Boardroom", start: "11:00", end: "13:00", type: "meeting" as const },
    { offset: 10, title: "Convocation Planning Review", location: "Auditorium", start: "15:00", end: "17:00", type: "review" as const },
    { offset: 12, title: "Board of Governors Update", location: "Boardroom", start: "10:00", end: "12:00", type: "meeting" as const },
  ];
  for (const item of items) {
    out.push({
      id: nextId(),
      date: iso(addDays(today, item.offset)),
      start: item.start,
      end: item.end,
      title: item.title,
      location: item.location,
      type: item.type,
      source: "schedule",
    });
  }

  return out;
}

/**
 * Calendar for a persona + registrations.
 * `userKey` is the registration-store key (`persona:userId`).
 */
export function getCalendarEvents(
  persona: "student" | "faculty" | "principal",
  userKey: string
): CalendarEvent[] {
  const base =
    persona === "faculty"
      ? buildFacultyEvents()
      : persona === "principal"
        ? buildPrincipalEvents()
        : buildStudentEvents();

  // Merge campus events the user registered for.
  const registered = registeredEventIds(userKey)
    .map((id) => getEvent(id))
    .filter((e): e is NonNullable<typeof e> => Boolean(e));

  const merged: CalendarEvent[] = [...base];
  const mapType = (t: string): CalendarEventType =>
    t === "placement_drive" || t === "hackathon" || t === "seminar" || t === "webinar"
      ? "event"
      : (t as CalendarEventType);
  for (const e of registered) {
    merged.push({
      id: `event-${e.id}`,
      date: e.date,
      start: e.start,
      end: e.end,
      title: e.title,
      location: e.location,
      type: mapType(e.type),
      description: e.description,
      source: "registered",
    });
  }

  // Merge assistant-created custom events (reminders, one-off meetings).
  for (const e of listCustomCalendarEvents(userKey)) {
    merged.push(e);
  }

  // Registering for campus events surfaces all campus events for browsing too.
  const allCampus = listCampusEvents();
  const known = new Set(merged.map((m) => m.id));
  for (const e of allCampus) {
    if (known.has(`event-${e.id}`)) continue;
    merged.push({
      id: `event-${e.id}`,
      date: e.date,
      start: e.start,
      end: e.end,
      title: e.title,
      location: e.location,
      type: mapType(e.type),
      description: e.description,
      source: "registered",
    });
  }

  return merged.sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
}

export function getCalendarDayLabel(dateIso: string): string {
  const d = new Date(`${dateIso}T00:00:00`);
  return DAY_NAMES[d.getDay()];
}
