import { callGeminiStructured } from "../llm/gemini";
import {
  listCampusEvents,
  registerForEvent,
  isRegistered,
  type CampusEvent,
} from "../demo/events";
import type { ComponentOutput } from "./index";

function eventToLine(e: CampusEvent, registered: boolean): string {
  return `- [id:${e.id}] ${e.title} (${e.type}) — ${e.date} ${e.start}-${e.end} @ ${e.location}${registered ? " [registered]" : ""}`;
}

/**
 * Events Intelligence Component.
 *
 * Browses the campus events catalog, and when the query implies registration
 * ("register me for…", "sign up for…", "enroll in…") it registers the user for
 * the matching event and confirms. Always returns explainable output.
 */
export async function eventsIntelligence(
  persona: "student" | "faculty" | "principal",
  userId: number,
  query: string
): Promise<ComponentOutput> {
  const userKey = `${persona}:${userId}`;
  const events = listCampusEvents();
  const catalog = events
    .map((e) => eventToLine(e, isRegistered(userKey, e.id)))
    .join("\n");

  const wantsRegistration =
    /register|sign\s*up|enroll|book|attend|join|rsvp/i.test(query);

  // Try to find a matching event by keywords in the query.
  const words = query.toLowerCase().split(/\W+/).filter((w) => w.length > 2);
  let match: CampusEvent | null = null;
  if (wantsRegistration) {
    const scored = events
      .map((e) => ({
        event: e,
        score: words.reduce(
          (acc, w) =>
            acc +
            (e.title.toLowerCase().includes(w) ? 2 : 0) +
            (e.description.toLowerCase().includes(w) ? 1 : 0) +
            (e.type.replace("_", " ").includes(w) ? 1 : 0),
          0
        ),
      }))
      .sort((a, b) => b.score - a.score);
    if (scored[0] && scored[0].score > 0) match = scored[0].event;
  }

  if (wantsRegistration && match) {
    if (isRegistered(userKey, match.id)) {
      return {
        result: `You're already registered for "${match.title}" (${match.date} at ${match.start}, ${match.location}). It's on your calendar.`,
        evidence: [
          {
            source: "campus_events",
            content: `${match.title} — ${match.date} ${match.start}-${match.end} @ ${match.location}`,
          },
        ],
        confidence: 0.95,
        source_type: "computed",
      };
    }
    registerForEvent(userKey, match.id);
    return {
      result: `Done! I've registered you for "${match.title}" on ${match.date} at ${match.start} (${match.location}). I added it to your calendar and sent you a confirmation notification.`,
      evidence: [
        {
          source: "campus_events",
          content: `${match.title} — ${match.date} ${match.start}-${match.end} @ ${match.location} [registered]`,
        },
      ],
      confidence: 0.95,
      source_type: "computed",
    };
  }

  // No registration intent — recommend matching events.
  const recommendations = events
    .filter((e) => e.audience === "all" || e.audience === persona)
    .slice(0, 3)
    .map((e) => `${e.title} — ${e.date} at ${e.start} (${e.location})`)
    .join("\n");

  const prompt = `\nYou are an Events Intelligence Component for a ${persona} user.\n\nUpcoming campus events:\n${catalog}\n\nUser Query: ${query}\n\nRespond with JSON:\n{\n  "result": "Your events analysis and recommendations here",\n  "reasoning": "How you matched events to the user's request",\n  "confidence": 0.8,\n  "evidence": [{"source": "campus_events", "content": "..."}],\n  "rejected_alternatives": []\n}\n`;

  try {
    const response = await callGeminiStructured(prompt);
    if (response.confidence > 0) {
      return {
        result: response.result,
        evidence: response.evidence?.length
          ? response.evidence
          : [{ source: "campus_events", content: recommendations }],
        confidence: response.confidence,
        source_type: "computed",
      };
    }
  } catch (error) {
    console.warn("[Events] LLM unavailable, using local recommendation:", error);
  }
  // LLM unavailable or failed — deterministic recommendation list.
  return {
    result: `Here are events I'd recommend: ${recommendations || "none match your profile right now."} Say "register me for <event>" to sign up.`,
    evidence: [{ source: "campus_events", content: recommendations }],
    confidence: 0.6,
    source_type: "computed",
  };
}
