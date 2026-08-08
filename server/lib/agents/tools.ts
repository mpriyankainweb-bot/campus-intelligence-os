/**
 * Real tool registry for the multi-agent layer.
 *
 * Every tool performs an actual operation against the existing campus data
 * (demo in-memory stores, or the database when configured). Agents call these
 * functions directly — they never merely "describe" tool use. All tools
 * degrade gracefully to demo data when the database is unavailable.
 */

import { getDb } from "../../db";
import { academicRecords, careerOpportunities, type AcademicRecord, type CareerOpportunity } from "../../../drizzle/schema";
import { eq } from "drizzle-orm";
import { knowledgeIntelligence } from "../components/index";
import {
  DEMO_ACADEMIC_RECORDS,
  DEMO_CAREER_OPPORTUNITIES,
} from "../demo/data";
import {
  listCampusEvents,
  registerForEvent as registerEvent,
  getEvent,
  isRegistered,
  type CampusEvent,
} from "../demo/events";
import { addCustomCalendarEvent, type CalendarEvent } from "../demo/calendar";
import { pushNotification, type NotificationItem } from "../demo/notifications";

// ---------------------------------------------------------------------------
// Student profile
// ---------------------------------------------------------------------------

export interface StudentProfile {
  fullName: string;
  year: string;
  department: string;
  cgpa: number;
  interests: string[];
  avgAttendance: number;
  /** Fraction (0..1) of courses in good standing. */
  goodStandingRatio: number;
  flaggedCourses: string[];
  records: AcademicRecord[];
}

/** Base demo persona profile used when no database profile exists. */
const PERSONA_PROFILES: Record<string, Partial<StudentProfile>> = {
  student: {
    fullName: "Ananya Rao",
    year: "3rd year",
    department: "CSE",
    cgpa: 8.4,
    interests: ["Artificial Intelligence", "Full-stack development"],
  },
  faculty: {
    fullName: "Dr. Vikram Shah",
    department: "Computer Science",
  },
  principal: {
    fullName: "Dr. Meera Iyer",
    department: "Administration",
  },
};

async function loadAcademicRecordsFor(studentId: number): Promise<AcademicRecord[]> {
  const db = await getDb();
  if (!db) return DEMO_ACADEMIC_RECORDS as unknown as AcademicRecord[];
  try {
    const rows = await db
      .select()
      .from(academicRecords)
      .where(eq(academicRecords.studentId, studentId));
    return rows.length > 0 ? rows : (DEMO_ACADEMIC_RECORDS as unknown as AcademicRecord[]);
  } catch (error) {
    console.warn("[Tools] academic records fallback:", error);
    return DEMO_ACADEMIC_RECORDS as unknown as AcademicRecord[];
  }
}

/** tool: checkStudentProfile(userId, persona) */
export async function checkStudentProfile(
  userId: number,
  persona: "student" | "faculty" | "principal"
): Promise<StudentProfile> {
  const base = PERSONA_PROFILES[persona] ?? {};
  const records = await loadAcademicRecordsFor(userId);

  const att = records.map((r) => parseFloat(r.attendancePercent.toString()));
  const avgAttendance = att.length ? att.reduce((a, b) => a + b, 0) / att.length : 0;
  const flagged = records.filter((r) => r.standing !== "good");
  const goodStandingRatio = records.length
    ? (records.length - flagged.length) / records.length
    : 1;

  return {
    fullName: base.fullName ?? "Student",
    year: base.year ?? "—",
    department: base.department ?? "General",
    cgpa: base.cgpa ?? 0,
    interests: base.interests ?? [],
    avgAttendance,
    goodStandingRatio,
    flaggedCourses: flagged.map((r) => r.course),
    records,
  };
}

// ---------------------------------------------------------------------------
// Eligibility
// ---------------------------------------------------------------------------

export interface EligibilityResult {
  eligible: boolean;
  met: string[];
  unmet: string[];
  cautions: string[];
}

/** tool: checkEligibility(profile, opportunity) — deterministic criteria check. */
export function checkEligibility(
  profile: StudentProfile,
  opportunity: { title: string; eligibilityCriteria?: Record<string, unknown> }
): EligibilityResult {
  const criteria = (opportunity.eligibilityCriteria ?? {}) as Record<string, unknown>;
  const minAtt = typeof criteria.minAttendance === "number" ? criteria.minAttendance : 0;
  const minCgpa = typeof criteria.minCgpa === "number" ? criteria.minCgpa : 0;
  const standingReq = criteria.standing;

  const met: string[] = [];
  const unmet: string[] = [];
  const cautions: string[] = [];

  if (profile.avgAttendance >= minAtt) {
    met.push(`${profile.avgAttendance.toFixed(1)}% attendance (needs ${minAtt}%)`);
  } else {
    unmet.push(`attendance ${profile.avgAttendance.toFixed(1)}% is below the ${minAtt}% threshold`);
  }

  if (minCgpa > 0) {
    if (profile.cgpa >= minCgpa) {
      met.push(`CGPA ${profile.cgpa} (needs ${minCgpa})`);
    } else {
      unmet.push(`CGPA ${profile.cgpa} is below the required ${minCgpa}`);
    }
  }

  if (standingReq === "good") {
    if (profile.goodStandingRatio >= 0.75) {
      met.push("good academic standing in most courses");
      if (profile.flaggedCourses.length > 0) {
        cautions.push(
          `course flagged: ${profile.flaggedCourses.join(", ")} — resolve before the drive`
        );
      }
    } else {
      unmet.push("not in good academic standing (multiple courses flagged)");
    }
  } else if (Array.isArray(standingReq)) {
    met.push("standing within allowed categories");
  }

  return { eligible: unmet.length === 0, met, unmet, cautions };
}

// ---------------------------------------------------------------------------
// Internships
// ---------------------------------------------------------------------------

async function loadOpportunities(): Promise<CareerOpportunity[]> {
  const db = await getDb();
  if (!db) return DEMO_CAREER_OPPORTUNITIES as unknown as CareerOpportunity[];
  try {
    const rows = await db.select().from(careerOpportunities);
    return rows.length > 0 ? rows : (DEMO_CAREER_OPPORTUNITIES as unknown as CareerOpportunity[]);
  } catch (error) {
    console.warn("[Tools] opportunities fallback:", error);
    return DEMO_CAREER_OPPORTUNITIES as unknown as CareerOpportunity[];
  }
}

export interface InternshipRecommendation {
  title: string;
  eligible: boolean;
  deadline: string;
  score: number;
  reasons: string[];
  criteria: Record<string, unknown>;
}

/** tool: searchInternships(profile, query?) — eligibility-screened, ranked list. */
export async function searchInternships(
  profile: StudentProfile,
  query: string
): Promise<InternshipRecommendation[]> {
  const opportunities = await loadOpportunities();
  const q = query.toLowerCase();
  const tokens = q.split(/[^a-z0-9]+/).filter((t) => t.length > 2);

  return opportunities
    .map((o) => {
      const criteria = (o.eligibilityCriteria ?? {}) as Record<string, unknown>;
      const elig = checkEligibility(profile, {
        title: o.title,
        eligibilityCriteria: criteria,
      });
      let score = elig.eligible ? 10 : 0;
      // Keyword affinity between the query and the opportunity title.
      const title = o.title.toLowerCase();
      for (const t of tokens) if (title.includes(t)) score += 4;
      // Interest affinity.
      for (const i of profile.interests) {
        if (title.includes(i.toLowerCase().split(" ")[0])) score += 2;
      }
      // Deadline pressure (sooner = slightly higher).
      const days = Math.max(
        0,
        Math.round((new Date(o.deadline).getTime() - Date.now()) / 86400000)
      );
      if (days <= 45) score += 1;

      return {
        title: o.title,
        eligible: elig.eligible,
        deadline: new Date(o.deadline).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }),
        score,
        reasons: Array.from(new Set([...elig.met, ...elig.cautions])),
        criteria,
      };
    })
    .sort((a, b) => b.score - a.score);
}

// ---------------------------------------------------------------------------
// Knowledge / RAG
// ---------------------------------------------------------------------------

export interface KnowledgeResult {
  answer: string;
  sources: Array<{ source: string; content: string; doc_id?: number; section?: string }>;
  confidence: number;
}

/** tool: searchKnowledge(query) — RAG retrieval with demo-policy fallback. */
export async function searchKnowledge(query: string): Promise<KnowledgeResult> {
  const result = await knowledgeIntelligence(query);
  return {
    answer: typeof result.result === "string" ? result.result : "",
    sources: result.evidence,
    confidence: result.confidence,
  };
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

/**
 * tool: searchEvents(query, persona) — keyword-scored event matching.
 * Returns events sorted by relevance with their match score (0 = no match).
 *
 * When the query names an event type (e.g. "workshop"), events of that type
 * get a strong bonus so "find a relevant upcoming workshop" prefers the
 * workshop over a partially-related placement drive.
 */
export function searchEvents(
  query: string,
  persona: "student" | "faculty" | "principal"
): Array<{ event: CampusEvent; score: number }> {
  const events = listCampusEvents().filter(
    (e) => e.audience === "all" || e.audience === persona
  );
  const q = query.toLowerCase();
  const words = q.split(/[^a-z0-9]+/).filter((w) => w.length > 2);
  const typeWords = ["workshop", "hackathon", "seminar", "webinar", "placement"];
  const mentionedTypes = typeWords.filter((t) => q.includes(t));

  return events
    .map((e) => {
      let score = words.reduce(
        (acc, w) =>
          acc +
          (e.title.toLowerCase().includes(w) ? 2 : 0) +
          (e.description.toLowerCase().includes(w) ? 1 : 0) +
          (e.type.replace("_", " ").includes(w) ? 1 : 0),
        0
      );
      // Strong preference for the explicitly requested event type.
      if (mentionedTypes.some((t) => e.type.replace("_", " ").includes(t))) {
        score += 8;
      }
      return { event: e, score };
    })
    .sort((a, b) => b.score - a.score);
}

/** tool: registerForEvent(userKey, eventId) — real registration against the store. */
export function registerForEvent(userKey: string, eventId: number): CampusEvent | null {
  return registerEvent(userKey, eventId);
}

/** tool: isRegisteredFor(userKey, eventId) */
export function isRegisteredFor(userKey: string, eventId: number): boolean {
  return isRegistered(userKey, eventId);
}

export function findEvent(eventId: number): CampusEvent | undefined {
  return getEvent(eventId);
}

/** tool: createCalendarEvent(userKey, event) — genuinely adds to the calendar. */
export function createCalendarEvent(
  userKey: string,
  event: Omit<CalendarEvent, "id" | "source">
): CalendarEvent {
  return addCustomCalendarEvent(userKey, event);
}

// ---------------------------------------------------------------------------
// Notifications / actions
// ---------------------------------------------------------------------------

/** tool: createReminder(persona, openId, title, when) — pushes a real notification. */
export function createReminder(
  persona: "student" | "faculty" | "principal",
  openId: string,
  title: string,
  when: string
): NotificationItem {
  return pushNotification(persona, openId, {
    type: "info",
    title: `Reminder: ${title}`,
    body: `⏰ ${when}. Set by your AI assistant.`,
  });
}

/** tool: draftNotification(persona, openId, title, body) — pushes a real notification. */
export function draftNotification(
  persona: "student" | "faculty" | "principal",
  openId: string,
  title: string,
  body: string
): NotificationItem {
  return pushNotification(persona, openId, { type: "info", title, body });
}

export { listCampusEvents, pushNotification };
