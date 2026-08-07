import { callGeminiStructured, StructuredResponse } from "../llm/gemini";
import {
  academicIntelligence,
  careerIntelligence,
  knowledgeIntelligence,
  analyticsIntelligence,
  communicationIntelligence,
  ComponentOutput,
} from "../components/index";
import { eventsIntelligence } from "../components/events";
import { calendarIntelligence } from "../components/calendar";
import {
  getConversationMemory,
  saveConversationMemory,
  getLongTermMemory,
  SharedContext,
} from "../memory/store";

/**
 * Orchestrator: 6-stage pipeline for multi-agent reasoning.
 *
 * Stage 1: Understand (LLM) - Classify user intent
 * Stage 2: Plan (LLM) - Generate action plan
 * Stage 3: Route/Dispatch - Deterministically route to components
 * Stage 4: Verify (deterministic) - Resolve conflicts via precedence
 * Stage 5: Replan - Patch affected steps if needed
 * Stage 6: Synthesize (LLM) - Generate final response
 */

export interface OrchestratorInput {
  userId: number;
  sessionId: string;
  userPersona: "student" | "faculty" | "principal";
  userQuery: string;
}

export interface OrchestratorOutput extends StructuredResponse {
  source_type: "rag" | "computed" | "derived" | "knowledge";
}

// ---------------------------------------------------------------------------
// Deterministic routing helpers.
//
// The LLM drives planning, but a keyword layer guarantees the pipeline always
// routes to the right components — even under rate limits — and that queries
// requiring multiple agents (e.g. "Am I eligible for the Google internship?")
// dispatch to all of them.
// ---------------------------------------------------------------------------

const KEYWORD_RULES: Array<{ intent: string; pattern: RegExp }> = [
  { intent: "events", pattern: /register|sign\s?up|enroll|workshop|hackathon|seminar|placement drive|attend|campus event|rsvp|book a seat/i },
  { intent: "calendar", pattern: /schedule|timetable|calendar|today'?s (plan|day)|what.*(today|tomorrow|this week)|upcoming (classes|meetings|exams)|meeting|class timings|my day/i },
  { intent: "policy", pattern: /policy|rule|regulation|guideline|allowed|permitted|rule say|handbook/i },
  { intent: "career", pattern: /intern|placement|job|career|opportunit|resume|cv|hiring|recruit/i },
  { intent: "academic", pattern: /attend|grade|score|marks?|exam|course|semester|cgpa|gpa|class|assignment|academic/i },
  { intent: "analytics", pattern: /trend|statistic|metric|insight|performance|dashboard|analy|compare|drop|improve/i },
  { intent: "communication", pattern: /draft|email|message|write to|notify|communicat|compose|send (a )?(message|mail|email)/i },
];

function classifyIntentByKeywords(query: string): string {
  for (const rule of KEYWORD_RULES) {
    if (rule.pattern.test(query)) return rule.intent;
  }
  return "general";
}

/** Components guaranteed for an intent when the LLM plan is weak or missing. */
function componentsForIntent(intent: string, query: string): string[] {
  const set = new Set<string>();
  const push = (c: string) => set.add(c);

  if (/intern|placement|eligible|career|opportunit/i.test(query)) {
    push("career");
    push("academic"); // eligibility needs academic standing
    push("knowledge"); // and policy context
  }
  if (/register|sign\s?up|enroll|workshop|hackathon|seminar|placement drive/i.test(query)) {
    push("events");
    push("calendar");
    push("knowledge");
  }
  if (/draft|email|message|communicat|notify|compose/i.test(query)) {
    push("communication");
    push("knowledge");
  }
  if (/schedule|timetable|calendar|today|tomorrow|this week|meeting/i.test(query)) {
    push("calendar");
    push("events");
  }

  if (set.size === 0) {
    switch (intent) {
      case "academic":
        push("academic");
        push("analytics");
        break;
      case "career":
        push("career");
        push("academic");
        break;
      case "policy":
        push("knowledge");
        break;
      case "analytics":
        push("analytics");
        break;
      case "communication":
        push("communication");
        break;
      case "events":
        push("events");
        break;
      case "calendar":
        push("calendar");
        break;
      default:
        push("knowledge");
        push("analytics");
    }
  }

  return Array.from(set);
}

/** True when the LLM response looks like a real structured payload. */
function isUsablePayload(response: StructuredResponse): boolean {
  return (
    response.confidence > 0 &&
    response.result !== null &&
    response.result !== undefined &&
    typeof response.result === "object"
  );
}

/**
 * Stage 1: Understand - Classify the user's intent.
 */
async function stageUnderstand(query: string): Promise<string> {
  const prompt = `
Classify the user's intent in one word. Choose from:
- academic (about courses, grades, attendance)
- career (about internships, opportunities)
- policy (about institutional rules, regulations)
- analytics (about performance metrics, insights)
- communication (drafting messages, communications)
- events (registering for or asking about workshops, hackathons, seminars, placement drives)
- calendar (asking about today's schedule, timetable, meetings, deadlines)
- general (other)

User Query: "${query}"

Respond with JSON:
{
  "intent": "academic"
}
`;

  const response = await callGeminiStructured(prompt);
  const intent = (response.result as any)?.intent;
  if (typeof intent === "string" && intent.length > 0) {
    return intent;
  }
  // LLM unavailable (e.g. rate limited) — fall back to deterministic routing.
  return classifyIntentByKeywords(query);
}

/**
 * Stage 2: Plan - Generate a plan for how to answer.
 */
async function stagePlan(
  intent: string,
  query: string,
  longTermFacts: string[]
): Promise<any> {
  const prompt = `
You are planning how to answer a user query. Determine which components to invoke.

Intent: ${intent}
Query: "${query}"
Known Facts: ${longTermFacts.join(", ") || "none"}

Available components:
- academic: courses, grades, attendance analysis
- career: internships, placements, opportunities
- knowledge: institutional policy / RAG retrieval
- analytics: performance metrics, insights
- communication: drafting messages and emails
- events: campus events, workshop registration
- calendar: today's schedule, timetable, meetings

Pick ALL components relevant to fully answering the query. If the query mixes
topics (e.g. eligibility for an internship, or registering for an event), pick
multiple.

Respond with JSON:
{
  "components": ["academic", "career", "knowledge"],
  "reasoning": "Why these components are needed"
}
`;

  const response = await callGeminiStructured(prompt);
  const plan = (response.result as any) || { components: [], reasoning: "" };
  if (Array.isArray(plan.components) && plan.components.length > 0) {
    return plan;
  }
  // LLM unavailable — fall back to deterministic component selection.
  return {
    components: componentsForIntent(intent, query),
    reasoning: "Deterministic fallback (LLM plan unavailable)",
  };
}

/**
 * Stage 3: Route/Dispatch - Call the planned components.
 */
async function stageDispatch(
  plan: any,
  context: SharedContext,
  query: string
): Promise<Record<string, ComponentOutput>> {
  const results: Record<string, ComponentOutput> = {};

  // Merge the LLM's plan with guaranteed components for this query, so
  // multi-agent queries always dispatch to every relevant agent.
  const planned = Array.isArray(plan?.components) ? plan.components : [];
  const guaranteed = componentsForIntent(context.intent, query);
  const components = Array.from(new Set([...planned, ...guaranteed]));

  for (const component of components) {
    try {
      if (component === "academic") {
        results.academic = await academicIntelligence(context.userId, query);
      } else if (component === "career") {
        results.career = await careerIntelligence(context.userId, query);
      } else if (component === "knowledge") {
        results.knowledge = await knowledgeIntelligence(query);
      } else if (component === "analytics") {
        results.analytics = await analyticsIntelligence(context.userId, query);
      } else if (component === "communication") {
        results.communication = await communicationIntelligence(context.userPersona, query);
      } else if (component === "events") {
        results.events = await eventsIntelligence(context.userPersona, context.userId, query);
      } else if (component === "calendar") {
        results.calendar = await calendarIntelligence(context.userPersona, context.userId, query);
      }
    } catch (error) {
      console.error(`[Orchestrator] Component ${component} failed:`, error);
      results[component] = {
        result: null,
        evidence: [],
        confidence: 0,
        source_type: "computed",
      };
    }
  }

  return results;
}

/**
 * Stage 4: Verify - Resolve conflicts using precedence rules.
 * Precedence: Knowledge > Academic/Career/Analytics > Events/Calendar > Communication
 */
function stageVerify(componentResults: Record<string, ComponentOutput>): ComponentOutput {
  const precedence = [
    "knowledge",
    "academic",
    "career",
    "analytics",
    "events",
    "calendar",
    "communication",
  ];

  for (const component of precedence) {
    if (componentResults[component] && componentResults[component].confidence > 0) {
      return componentResults[component];
    }
  }

  // If no high-confidence result, merge all evidence
  const allEvidence = Object.values(componentResults).flatMap((r) => r.evidence);
  const avgConfidence =
    Object.values(componentResults).length > 0
      ? Object.values(componentResults).reduce((sum, r) => sum + r.confidence, 0) /
        Object.values(componentResults).length
      : 0;

  return {
    result: "Unable to provide a confident answer.",
    evidence: allEvidence,
    confidence: Math.max(avgConfidence, 0),
    source_type: "computed",
  };
}

/**
 * Stage 5: Replan - Patch affected steps if needed.
 */
async function stageReplan(
  verified: ComponentOutput,
  query: string
): Promise<ComponentOutput> {
  if (verified.confidence < 0.3) {
    const knowledge = await knowledgeIntelligence(query);
    if (knowledge.confidence > verified.confidence) {
      return knowledge;
    }
  }
  return verified;
}

/**
 * Stage 6: Synthesize - Generate final response with explainability.
 */
async function stageSynthesize(
  verified: ComponentOutput,
  query: string,
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>,
  componentResults: Record<string, ComponentOutput>,
  intent: string
): Promise<OrchestratorOutput> {
  const historyText = conversationHistory
    .slice(-4)
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");

  const agentSummary = Object.entries(componentResults)
    .filter(([, r]) => r.confidence > 0)
    .map(([agent, r]) => `[${agent}] ${r.result}`)
    .join("\n");

  const prompt = `
You are synthesizing a final response to the user.

Conversation History:
${historyText}

Current Query: "${query}"

Agent Results:
${agentSummary || "(no agent results)"}

Generate a natural, conversational response that:
1. Directly answers the user's query
2. Explains your reasoning
3. Cites evidence appropriately
4. Expresses appropriate confidence
5. Suggests alternatives if applicable

Respond with JSON:
{
  "result": "Your synthesized answer here",
  "reasoning": "Your reasoning process",
  "confidence": 0.85,
  "evidence": [{"source": "...", "content": "..."}],
  "rejected_alternatives": ["Alternative 1"]
}
`;

  const response = await callGeminiStructured(prompt);

  // If the LLM failed (e.g. rate limited), still return the best component
  // result so the user gets a real, explainable answer.
  if (!isUsablePayload(response)) {
    // Prefer the agent matched to the user's intent, else precedence order.
    const intentComponent: Record<string, string> = {
      events: "events",
      calendar: "calendar",
      academic: "academic",
      career: "career",
      policy: "knowledge",
      analytics: "analytics",
      communication: "communication",
    };
    const preferredName = intentComponent[intent];
    const preferred = preferredName ? componentResults[preferredName] : undefined;
    const best =
      preferred && preferred.confidence > 0
        ? preferred
        : stageVerify(componentResults);
    const mergedEvidence = [
      ...best.evidence,
      ...Object.values(componentResults).flatMap((r) => r.evidence),
    ].filter(
      (e, idx, arr) => arr.findIndex((x) => x.content === e.content) === idx
    );
    return {
      result: best.result ?? "Here's what I found.",
      reasoning: best.result
        ? "Synthesized from the agent results below."
        : "The AI service is temporarily unavailable — showing agent results.",
      confidence: best.confidence || 0.5,
      evidence: mergedEvidence,
      rejected_alternatives: ["Generated by the fallback synthesizer"],
      source_type: best.source_type ?? "computed",
    };
  }

  return {
    result: response.result,
    reasoning: response.reasoning,
    confidence: response.confidence,
    evidence: response.evidence || stageVerify(componentResults).evidence,
    rejected_alternatives: response.rejected_alternatives,
    source_type: stageVerify(componentResults).source_type,
  };
}

/**
 * Main Orchestrator entry point.
 */
export async function orchestrate(input: OrchestratorInput): Promise<OrchestratorOutput> {
  // Create shared context
  const context: SharedContext = {
    userId: input.userId,
    sessionId: input.sessionId,
    userPersona: input.userPersona,
    intent: "",
    plan: null,
    componentResults: {},
  };

  // Load conversation and long-term memory
  const conversationHistory = await getConversationMemory(input.userId, input.sessionId);
  const longTermFacts = await getLongTermMemory(input.userId);

  // Stage 1: Understand
  context.intent = await stageUnderstand(input.userQuery);

  // Stage 2: Plan
  context.plan = await stagePlan(context.intent, input.userQuery, longTermFacts);

  // Stage 3: Route/Dispatch
  context.componentResults = await stageDispatch(context.plan, context, input.userQuery);

  // Stage 4: Verify
  const verified = stageVerify(context.componentResults);

  // Stage 5: Replan
  const replanned = await stageReplan(verified, input.userQuery);

  // Stage 6: Synthesize
  const final = await stageSynthesize(
    replanned,
    input.userQuery,
    conversationHistory,
    context.componentResults,
    context.intent
  );

  // Update conversation memory
  const updatedHistory = [
    ...conversationHistory,
    { role: "user" as const, content: input.userQuery },
    { role: "assistant" as const, content: final.result },
  ];
  await saveConversationMemory(input.userId, input.sessionId, updatedHistory);

  return final;
}
