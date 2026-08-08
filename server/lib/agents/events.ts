/**
 * Events Agent.
 *
 * Finds campus events matching the request (workshops, hackathons, seminars,
 * placement drives), and — when the user asks to register — actually registers
 * them, adds the event to their calendar and creates reminders (e.g. "one hour
 * before"). Every action is a real store mutation, surfaced in the workflow.
 */

import type { AgentCtx, AgentRunResult, SessionFacts } from "./types";
import {
  searchEvents,
  registerForEvent,
  isRegisteredFor,
  createCalendarEvent,
  createReminder,
  findEvent,
} from "./tools";
import type { CampusEvent } from "../demo/events";

function parseReminderLead(query: string): { amount: number; unit: "hour" | "day" } | null {
  const hour = query.match(/(\d+)\s*hr?\b/i);
  if (hour) return { amount: parseInt(hour[1], 10), unit: "hour" };
  const day = query.match(/(\d+)\s*day\b/i);
  if (day) return { amount: parseInt(day[1], 10), unit: "day" };
  if (/remind/.test(query)) return { amount: 1, unit: "hour" };
  return null;
}

function shiftTime(start: string, amount: number, unit: "hour" | "day"): string {
  const match = start.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return start;
  let hours = parseInt(match[1], 10) % 12;
  if (match[3].toUpperCase() === "PM") hours += 12;
  const minutes = parseInt(match[2], 10);
  const total = (hours * 60 + minutes - (unit === "hour" ? amount * 60 : amount * 24 * 60) + 24 * 60) % (24 * 60);
  const h = Math.floor(total / 60) % 12 === 0 ? 12 : Math.floor(total / 60) % 12;
  const m = total % 60;
  const ampm = total < 12 * 60 ? "AM" : "PM";
  return `${h}:${m.toString().padStart(2, "0")} ${ampm}`;
}

function eventLine(e: CampusEvent): string {
  return `${e.title} — ${e.date} at ${e.start} (${e.location})`;
}

export async function eventsAgent(ctx: AgentCtx): Promise<AgentRunResult> {
  const started = Date.now();
  const userKey = `${ctx.persona}:${ctx.userId}`;
  const tools = [];

  const wantsRegistration = /register|sign\s*up|enroll|book|attend|join|rsvp/i.test(ctx.query);
  const scored = searchEvents(ctx.query, ctx.persona);
  const matches = scored.filter((r) => r.score > 0).map((r) => r.event);
  const match = wantsRegistration ? matches[0] ?? null : null;

  // --- No registration: recommend matching events ---------------------------
  if (!wantsRegistration || !match) {
    const pool = matches.length > 0 ? matches : scored.map((r) => r.event);
    const recommendations = pool.slice(0, 3);
    const answer = recommendations.length
      ? `Here are events matching your request:\n${recommendations.map((e) => `• ${eventLine(e)}`).join("\n")}\n\nSay "register me for <event>" to sign up.`
      : "No campus events matched your request right now — check the Events page for the full catalog.";

    return {
      step: {
        id: `step-${Date.now()}-events`,
        agent: "events",
        label: "Events Agent",
        status: "done",
        message: recommendations.length
          ? `Found ${recommendations.length} relevant event${recommendations.length === 1 ? "" : "s"}`
          : "No matching events found",
        detail: answer,
        durationMs: Date.now() - started,
        tools: [
          {
            name: "searchEvents",
            args: `query: "${ctx.query.slice(0, 60)}", persona: ${ctx.persona}`,
            result: `${recommendations.length} event(s) matched`,
            ok: true,
          },
        ],
      },
      answer,
      evidence: recommendations.map((e) => ({
        source: "campus_events",
        content: eventLine(e),
      })),
      confidence: recommendations.length ? 0.8 : 0.3,
      memoryPatch: {
        selectedEvents: Array.from(
          new Set([...ctx.facts.selectedEvents, ...recommendations.map((e) => e.title)])
        ).slice(-5),
      },
    };
  }

  // --- Registration requested: perform the real actions ---------------------
  const event = match;
  const memoryPatch: Partial<SessionFacts> = {
    selectedEvents: Array.from(new Set([...ctx.facts.selectedEvents, event.title])).slice(-5),
  };
  const actions = [];

  if (isRegisteredFor(userKey, event.id)) {
    return {
      step: {
        id: `step-${Date.now()}-events`,
        agent: "events",
        label: "Events Agent",
        status: "done",
        message: `Already registered for "${event.title}"`,
        detail: `You're already on the list for ${eventLine(event)}.`,
        durationMs: Date.now() - started,
        tools: [
          {
            name: "searchEvents",
            args: `query: "${ctx.query.slice(0, 60)}"`,
            result: `matched "${event.title}"`,
            ok: true,
          },
          {
            name: "isRegisteredFor",
            args: `eventId: ${event.id}`,
            result: "true",
            ok: true,
          },
        ],
      },
      answer: `You're already registered for ${eventLine(event)}.`,
      evidence: [{ source: "campus_events", content: eventLine(event) }],
      confidence: 0.95,
      memoryPatch,
    };
  }

  tools.push({
    name: "searchEvents",
    args: `query: "${ctx.query.slice(0, 60)}"`,
    result: `matched "${event.title}"`,
    ok: true,
  });

  // 1) Register (real store mutation)
  const registered = registerForEvent(userKey, event.id);
  tools.push({
    name: "registerForEvent",
    args: `eventId: ${event.id}`,
    result: registered ? `registered for "${event.title}"` : "failed",
    ok: Boolean(registered),
  });
  if (registered) {
    actions.push({
      kind: "register",
      title: `Registered for ${event.title}`,
      detail: `${event.date} at ${event.start}, ${event.location}`,
    });
  }

  // 2) Add to calendar (real store mutation)
  const calEvent = createCalendarEvent(userKey, {
    date: event.date,
    start: event.start,
    end: event.end,
    title: event.title,
    location: event.location,
    type: event.type === "workshop" || event.type === "hackathon" || event.type === "webinar" ? "workshop" : "event",
    description: event.description,
  });
  tools.push({
    name: "createCalendarEvent",
    args: `eventId: ${event.id}, date: ${event.date}`,
    result: `added "${calEvent.title}" to calendar`,
    ok: true,
  });
  actions.push({
    kind: "calendar",
    title: "Added to your calendar",
    detail: `${event.title} · ${event.date} ${event.start}–${event.end}`,
  });

  // 3) Reminder when requested (real notification)
  const reminder = parseReminderLead(ctx.query);
  if (reminder && ctx.persona === "student") {
    const whenText =
      reminder.unit === "hour"
        ? `1 hour before the event starts (${shiftTime(event.start, reminder.amount, "hour")})`
        : `${reminder.amount} day(s) before the event`;
    createReminder(ctx.persona, ctx.openId, event.title, whenText);
    tools.push({
      name: "createReminder",
      args: `title: "${event.title}", when: ${whenText}`,
      result: `reminder created (${whenText})`,
      ok: true,
    });
    actions.push({
      kind: "reminder",
      title: "Reminder created",
      detail: `${whenText} for ${event.title}`,
    });
  }

  const answer = [
    `Done! You're registered for "${event.title}" on ${event.date} at ${event.start} (${event.location}).`,
    "",
    "What I did:",
    ...actions.map((a) => `✓ ${a.title}`),
    "",
    "You'll see it on the Calendar page, and a confirmation notification is in your inbox.",
  ].join("\n");

  return {
    step: {
      id: `step-${Date.now()}-events`,
      agent: "events",
      label: "Events Agent",
      status: "done",
      message: `Registered for "${event.title}" and updated your calendar`,
      detail: answer,
      durationMs: Date.now() - started,
      tools,
    },
    answer,
    evidence: [
      { source: "campus_events", content: eventLine(event) },
      { source: "calendar", content: `${event.title} · ${event.date} ${event.start}–${event.end}` },
    ],
    confidence: 0.95,
    actions,
    memoryPatch,
  };
}

// Re-export helper for the action agent (used to look up an event by title).
export { findEvent };
