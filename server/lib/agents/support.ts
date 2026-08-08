/**
 * Student Support Agent.
 *
 * Handles academic, schedule and campus-support questions by calling the
 * existing intelligence engines (academic records, analytics, calendar) with
 * deterministic fallbacks when the LLM is unavailable. It never invents
 * institution-specific facts that aren't in the data.
 */

import type { AgentCtx, AgentRunResult } from "./types";
import { academicIntelligence, analyticsIntelligence } from "../components/index";
import { calendarIntelligence } from "../components/calendar";

export async function supportAgent(ctx: AgentCtx): Promise<AgentRunResult> {
  const started = Date.now();
  const query = ctx.query;

  const isSchedule = /schedule|timetable|today|tomorrow|this week|calendar|class timings|my day|upcoming (classes|meetings|exams|deadlines)/i.test(query);
  const isAnalytics = /trend|statistic|metric|insight|performance|analy|compare|drop|improve|summary/i.test(query);

  let result;
  let toolName = "academicInsights";
  let toolResult = "";

  if (isSchedule) {
    result = await calendarIntelligence(ctx.persona, ctx.userId, query);
    toolName = "getTodaySchedule";
    toolResult = "persona schedule generated from class/exam/deadline data";
  } else if (isAnalytics) {
    result = await analyticsIntelligence(ctx.userId, query);
    toolName = "performanceInsights";
    toolResult = "attendance/standing metrics computed";
  } else {
    result = await academicIntelligence(ctx.userId, query);
    toolName = "academicInsights";
    toolResult = "academic records analyzed";
  }

  const answer = typeof result.result === "string" ? result.result : "Here's what the campus data shows.";
  const durationMs = Date.now() - started;

  return {
    step: {
      id: `step-${Date.now()}-support`,
      agent: "support",
      label: "Student Support Agent",
      status: "done",
      message: isSchedule
        ? "Answered from your schedule data"
        : isAnalytics
          ? "Analyzed your performance metrics"
          : "Answered from your academic records",
      detail: answer,
      durationMs,
      tools: [
        {
          name: toolName,
          args: `query: "${query.slice(0, 60)}"`,
          result: toolResult,
          ok: true,
        },
      ],
    },
    answer,
    evidence: result.evidence,
    confidence: result.confidence || 0.6,
  };
}
