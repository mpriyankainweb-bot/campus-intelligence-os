import { callGeminiStructured } from "../llm/gemini";
import { getCalendarEvents, getCalendarDayLabel } from "../demo/calendar";
import type { ComponentOutput } from "./index";

/**
 * Calendar Intelligence Component.
 *
 * Summarizes the user's schedule (today, tomorrow or this week) from the
 * auto-generated persona calendar, including registered campus events.
 */
export async function calendarIntelligence(
  persona: "student" | "faculty" | "principal",
  userId: number,
  query: string
): Promise<ComponentOutput> {
  const userKey = `${persona}:${userId}`;
  const events = getCalendarEvents(persona, userKey);

  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowIso = tomorrow.toISOString().slice(0, 10);

  const isTomorrow = /tomorrow|next day/i.test(query);
  const isWeek = /week|upcoming|coming up/i.test(query);

  const dateFilter = isTomorrow ? tomorrowIso : isWeek ? null : todayIso;

  const filtered = events.filter((e) =>
    dateFilter ? e.date === dateFilter : e.date >= todayIso
  );
  const slice = isWeek ? filtered.slice(0, 12) : filtered;

  if (slice.length === 0) {
    return {
      result: isTomorrow
        ? "You have nothing scheduled tomorrow — a good window to catch up on pending work."
        : "You have no events scheduled for today.",
      evidence: [],
      confidence: 0.9,
      source_type: "computed",
    };
  }

  const list = slice
    .map(
      (e) =>
        `- ${e.start}-${e.end} ${e.title} @ ${e.location} (${e.type})`
    )
    .join("\n");

  const label = isTomorrow
    ? "tomorrow"
    : isWeek
      ? "the coming week"
      : `today (${getCalendarDayLabel(todayIso)})`;

  const prompt = `\nYou are a Calendar Intelligence Component for a ${persona} user.\n\nSchedule for ${label}:\n${list}\n\nUser Query: ${query}\n\nRespond with JSON:\n{\n  "result": "A friendly summary of the schedule",\n  "reasoning": "How the schedule answers the user's question",\n  "confidence": 0.9,\n  "evidence": [{"source": "calendar", "content": "..."}],\n  "rejected_alternatives": []\n}\n`;

  try {
    const response = await callGeminiStructured(prompt);
    if (response.confidence > 0) {
      return {
        result: response.result,
        evidence: response.evidence?.length
          ? response.evidence
          : slice.slice(0, 5).map((e) => ({
              source: "calendar",
              content: `${e.start}-${e.end} ${e.title} @ ${e.location}`,
            })),
        confidence: response.confidence,
        source_type: "computed",
      };
    }
  } catch (error) {
    console.warn("[Calendar] LLM unavailable, using local summary:", error);
  }
  // LLM unavailable or failed — deterministic schedule summary.
  return {
    result: `Here's your schedule for ${label}:\n${list}`,
    evidence: slice.slice(0, 5).map((e) => ({
      source: "calendar",
      content: `${e.start}-${e.end} ${e.title} @ ${e.location}`,
    })),
    confidence: 0.8,
    source_type: "computed",
  };
}
