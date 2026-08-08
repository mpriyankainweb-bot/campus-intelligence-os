/**
 * Notification/Action Agent.
 *
 * Turns explicit action requests into real store mutations: creates reminders,
 * adds one-off calendar events, and drafts/sends simulated notifications
 * (e.g. "remind me to submit the assignment", "draft an email to the placement
 * cell"). External communications are flagged as requiring approval.
 */

import type { AgentCtx, AgentRunResult } from "./types";
import {
  createReminder,
  createCalendarEvent,
  draftNotification,
} from "./tools";
import { communicationIntelligence } from "../components/index";

export async function actionAgent(ctx: AgentCtx): Promise<AgentRunResult> {
  const started = Date.now();
  const query = ctx.query;
  const userKey = `${ctx.persona}:${ctx.userId}`;
  const tools = [];
  const actions = [];

  const wantsReminder = /remind|reminder|notify me|alert me/i.test(query);
  const wantsCalendar = /add .*to (my )?calendar|schedule (a|an) (meeting|appointment)|calendar event/i.test(query);
  const wantsDraft = /draft|compose|write (an? )?(email|message|letter)|email (to|for)|communicat/i.test(query);

  // --- Reminder -------------------------------------------------------------
  if (wantsReminder) {
    // Extract the subject: "remind me to <x>" / "remind me about <x>" /
    // "remind me ... before <x>".
    let subject = "";
    const toMatch = query.match(/remind me (?:to|about)\s+(.{5,80})/i);
    const beforeMatch = query.match(/remind me[^.]{0,40}\bbefore\s+([^.,;!?]{3,60})/i);
    if (toMatch) {
      subject = toMatch[1].replace(/[.!?]+$/, "").trim();
    } else if (beforeMatch) {
      subject = beforeMatch[1].trim();
    } else if (/remind me[^.]{0,40}(?:one hour|1 hour|30 min|15 min|a day|tomorrow)/i.test(query)) {
      // Relative-time reminder with no clear subject — typically already handled
      // by the Events agent ("remind me one hour before the workshop"). Avoid
      // creating a duplicate "the task you mentioned" reminder.
      return {
        step: {
          id: `step-${Date.now()}-action`,
          agent: "action",
          label: "Notification/Action Agent",
          status: "done",
          message: "Reminder already handled by the Events agent",
          detail: "A relative reminder was requested — the relevant agent has set it against the event.",
          durationMs: Date.now() - started,
          tools: [],
        },
        answer: undefined,
        evidence: [],
        confidence: 0,
      };
    }
    if (!subject) subject = "the task you mentioned";

    createReminder(ctx.persona, ctx.openId, subject, "as requested");
    tools.push({
      name: "createReminder",
      args: `subject: "${subject}"`,
      result: "reminder created in your notification center",
      ok: true,
    });
    actions.push({ kind: "reminder", title: "Reminder created", detail: subject });

    return {
      step: {
        id: `step-${Date.now()}-action`,
        agent: "action",
        label: "Notification/Action Agent",
        status: "done",
        message: "Created your reminder",
        detail: `Done — I've set a reminder for "${subject}". You'll see it in your notification center.`,
        durationMs: Date.now() - started,
        tools,
      },
      answer: `Done — I've set a reminder for "${subject}". You'll see it in your notification center.`,
      evidence: [
        { source: "notifications", content: `Reminder set: ${subject}` },
      ],
      confidence: 0.9,
      actions,
    };
  }

  // --- One-off calendar event ------------------------------------------------
  if (wantsCalendar) {
    const today = new Date().toISOString().slice(0, 10);
    const subjectMatch = query.match(/(?:add|schedule)\s+(?:a|an)\s+([^,.;!]{3,60})/i);
    const subject = subjectMatch ? subjectMatch[1].trim() : "New event";

    createCalendarEvent(userKey, {
      date: today,
      start: "12:00",
      end: "13:00",
      title: subject,
      location: "Campus",
      type: "meeting",
      description: "Created by your AI assistant",
    });
    tools.push({
      name: "createCalendarEvent",
      args: `title: "${subject}", date: ${today}`,
      result: "added to your calendar",
      ok: true,
    });
    actions.push({ kind: "calendar", title: "Added to your calendar", detail: subject });

    return {
      step: {
        id: `step-${Date.now()}-action`,
        agent: "action",
        label: "Notification/Action Agent",
        status: "done",
        message: "Added the event to your calendar",
        detail: `Done — "${subject}" is on your calendar for today at 12:00 PM.`,
        durationMs: Date.now() - started,
        tools,
      },
      answer: `Done — "${subject}" is on your calendar for today at 12:00 PM.`,
      evidence: [{ source: "calendar", content: `${subject} · today 12:00 PM` }],
      confidence: 0.9,
      actions,
    };
  }

  // --- Draft communication ----------------------------------------------------
  if (wantsDraft) {
    const draft = await communicationIntelligence(ctx.persona, query);
    const draftText = typeof draft.result === "string" ? draft.result : "";
    const isExternal = /placement cell|employer|external|outside/i.test(query);

    tools.push({
      name: "draftNotification",
      args: `query: "${query.slice(0, 60)}"`,
      result: isExternal ? "draft prepared — requires approval before sending" : "draft prepared",
      ok: true,
    });
    actions.push(
      isExternal
        ? {
            kind: "approval",
            title: "Draft requires approval",
            detail: "Communications to the placement cell must be approved by the department head (per policy).",
            requiresApproval: true,
          }
        : { kind: "draft", title: "Communication drafted", detail: "Ready to send from your drafts." }
    );

    return {
      step: {
        id: `step-${Date.now()}-action`,
        agent: "action",
        label: "Notification/Action Agent",
        status: "done",
        message: isExternal
          ? "Drafted the communication (approval required before sending)"
          : "Drafted the communication",
        detail: draftText || "Draft ready.",
        durationMs: Date.now() - started,
        tools,
      },
      answer: draftText || "Here's a draft for you.",
      evidence: [{ source: "communication_draft", content: draftText.slice(0, 200) }],
      confidence: 0.7,
      actions,
    };
  }

  // --- Fallback: no explicit action intent ------------------------------------
  return {
    step: {
      id: `step-${Date.now()}-action`,
      agent: "action",
      label: "Notification/Action Agent",
      status: "done",
      message: "No action required",
      detail: "This request didn't require creating a reminder, calendar event or notification.",
      durationMs: Date.now() - started,
      tools: [],
    },
    answer: undefined,
    evidence: [],
    confidence: 0,
  };
}
