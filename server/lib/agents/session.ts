/**
 * Lightweight in-memory session memory for the AI assistant.
 *
 * Keeps relevant facts from the current conversation (student name, year,
 * department, interests, previous requests, selected events/internships) so
 * the agents can personalize answers without a database. Nothing secret is
 * ever stored here — only facts the user volunteered in chat.
 */

import type { SessionFacts } from "./types";

const sessions = new Map<string, SessionFacts>();

const YEAR_PATTERN = /\b(1st|2nd|3rd|4th|first|second|third|fourth)\s*(?:year|yr)\b/i;
const DEPT_ALIASES: Record<string, RegExp> = {
  cse: /\bcse\b|\bcomputer science\b/i,
  "computer science and engineering": /\bcomputer science and engineering\b/i,
  it: /\bit\s+(?:student|branch|dept|department|engineering)\b|\binformation technology\b/i,
  ece: /\bece\b|\belectronics(?: and communication)?\b/i,
  ee: /\bee\s+(?:student|branch|dept|department)\b|\belectrical engineering\b/i,
  eee: /\beee\b/i,
  me: /\bme\s+(?:student|branch|dept|department)\b|\bmechanical(?: engineering)?\b/i,
  ce: /\bce\s+(?:student|branch|dept|department)\b|\bcivil(?: engineering)?\b/i,
  ai: /\bai\s+(?:student|branch|dept|department)\b|\bartificial intelligence\b/i,
  "ai/ml": /\bai\/?ml\b/i,
  ds: /\bds\s+(?:student|branch|dept|department)\b|\bdata science\b/i,
};

export function getSessionFacts(sessionId: string): SessionFacts {
  let facts = sessions.get(sessionId);
  if (!facts) {
    facts = {
      interests: [],
      previousRequests: [],
      selectedEvents: [],
      selectedInternships: [],
      learned: [],
    };
    sessions.set(sessionId, facts);
  }
  return facts;
}

export function updateSessionFacts(
  sessionId: string,
  patch: Partial<SessionFacts>
): SessionFacts {
  const facts = getSessionFacts(sessionId);
  Object.assign(facts, patch);
  sessions.set(sessionId, facts);
  return facts;
}

/** Extract structured facts (year, department, interests, name) from a user message. */
export function extractFactsFromQuery(query: string): {
  year?: string;
  department?: string;
  interests: string[];
  name?: string;
} {
  const extracted: { year?: string; department?: string; interests: string[]; name?: string } = {
    interests: [],
  };

  const yearMatch = query.match(YEAR_PATTERN);
  if (yearMatch) {
    const ordinal = yearMatch[1].toLowerCase();
    const map: Record<string, string> = {
      "1st": "1st year", "first": "1st year",
      "2nd": "2nd year", "second": "2nd year",
      "3rd": "3rd year", "third": "3rd year",
      "4th": "4th year", "fourth": "4th year",
    };
    extracted.year = map[ordinal] ?? `${ordinal} year`;
  }

  const DEPT_DISPLAY: Record<string, string> = {
    cse: "CSE",
    "computer science and engineering": "CSE",
    it: "IT",
    ece: "ECE",
    ee: "EE",
    eee: "EEE",
    me: "ME",
    ce: "CE",
    ai: "AI",
    "ai/ml": "AI/ML",
    ds: "DS",
  };
  for (const [alias, pattern] of Object.entries(DEPT_ALIASES)) {
    if (pattern.test(query)) {
      extracted.department = DEPT_DISPLAY[alias] ?? alias.toUpperCase();
      break;
    }
  }

  // Interests: look for "interested in X" / "my interests are X, Y"
  const interestMatch = query.match(/interested\s+in\s+([^.,;!?]{3,60})/i);
  if (interestMatch) {
    extracted.interests = interestMatch[1]
      .split(/and|,|\//)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 4);
  }

  // Self-introduction: "I'm Priya, a 3rd year..." / "my name is Priya"
  const nameMatch =
    query.match(/\bmy name is ([A-Z][a-z]+)/i) ||
    query.match(/\bi'?m ([A-Z][a-z]+)\b(?=,|\s+(?:a|an|from|in)\b)/i);
  if (nameMatch) extracted.name = nameMatch[1];

  return extracted;
}

/** One-line summary of the facts, e.g. "3rd year CSE student · interested in AI". */
export function summarizeFacts(facts: SessionFacts): string {
  const parts: string[] = [];
  if (facts.fullName) parts.push(facts.fullName);
  if (facts.year) parts.push(facts.year);
  if (facts.department) parts.push(`${facts.department} student`);
  if (facts.interests.length > 0) {
    parts.push(`interested in ${facts.interests.join(", ")}`);
  }
  if (parts.length === 0 && facts.learned.length > 0) {
    return facts.learned[0];
  }
  return parts.join(" · ");
}

/** Facts that are safe to show in the UI (never secrets). */
export function publicFacts(facts: SessionFacts) {
  return {
    fullName: facts.fullName ?? null,
    year: facts.year ?? null,
    department: facts.department ?? null,
    interests: facts.interests.slice(-4),
    previousRequests: facts.previousRequests.slice(-3),
    selectedEvents: facts.selectedEvents.slice(-3),
    selectedInternships: facts.selectedInternships.slice(-3),
    summary: summarizeFacts(facts),
  };
}
