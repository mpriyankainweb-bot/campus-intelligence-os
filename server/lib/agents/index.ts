/**
 * Agent registry.
 *
 * Maps the orchestrator's planned components to the specialized agent
 * implementations. Each agent runs real tools and returns a workflow step.
 */

import type { AgentCtx, AgentRunResult } from "./types";
import { knowledgeAgent } from "./knowledge";
import { placementAgent } from "./placement";
import { eventsAgent } from "./events";
import { supportAgent } from "./support";
import { actionAgent } from "./action";

export const AGENT_MAP: Record<string, (ctx: AgentCtx) => Promise<AgentRunResult>> = {
  // Canonical keys used by the orchestrator dispatcher.
  knowledge: knowledgeAgent,
  placement: placementAgent,
  events: eventsAgent,
  support: supportAgent,
  action: actionAgent,
  // Component aliases (LLM plan / keyword routing may emit these directly).
  career: placementAgent,
  academic: supportAgent,
  analytics: supportAgent,
  calendar: supportAgent,
  communication: actionAgent,
};

export const AGENT_LABELS: Record<string, string> = {
  orchestrator: "Orchestrator Agent",
  knowledge: "Knowledge/RAG Agent",
  career: "Placement & Internship Agent",
  placement: "Placement & Internship Agent",
  events: "Events Agent",
  academic: "Student Support Agent",
  analytics: "Student Support Agent",
  calendar: "Student Support Agent",
  communication: "Notification/Action Agent",
  support: "Student Support Agent",
  action: "Notification/Action Agent",
};

export { knowledgeAgent, placementAgent, eventsAgent, supportAgent, actionAgent };
export type { AgentCtx, AgentRunResult };
