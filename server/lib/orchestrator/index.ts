import { callGeminiStructured, StructuredResponse } from "../llm/gemini";
import { knowledgeIntelligence } from "../components/index";
import { AGENT_MAP, AGENT_LABELS } from "../agents/index";
import type {
  WorkflowStep,
  ActionSummary,
  AgentEvidence,
  AgentRunResult,
  AgentSummary,
} from "../agents/types";
import {
  getSessionFacts,
  updateSessionFacts,
  extractFactsFromQuery,
  publicFacts,
} from "../agents/session";
import {
  getConversationMemory,
  saveConversationMemory,
  getLongTermMemory,
} from "../memory/store";

/**
 * Multi-agent Orchestrator.
 *
 * Understand → Plan → Dispatch (specialized agents calling real tools) →
 * Verify → Replan → Synthesize. Every dispatched agent records a genuine
 * workflow step (with real timings, tools and status), and the result carries
 * the full trace + actions + sources + session memory so the client can render
 * the visible orchestration workflow.
 */

export interface OrchestratorInput {
  userId: number;
  sessionId: string;
  userPersona: "student" | "faculty" | "principal";
  userQuery: string;
  /** Optional — used to target notifications/reminders at the right feed. */
  openId?: string;
  /** Optional — used to personalize session memory. */
  fullName?: string;
}

export interface OrchestratorOutput extends StructuredResponse {
  source_type: "rag" | "computed" | "derived" | "knowledge";
  workflow?: WorkflowStep[];
  actions?: ActionSummary[];
  sources?: AgentEvidence[];
  summary?: AgentSummary;
  memory?: { summary: string; previousRequests: string[] };
}

// ---------------------------------------------------------------------------
// Deterministic routing helpers (LLM-independent safety net).
// ---------------------------------------------------------------------------

const KEYWORD_RULES: Array<{ intent: string; pattern: RegExp }> = [
  // \battend\b so "attendance" doesn't get misrouted to events.
  { intent: "events", pattern: /register|sign\s?up|enroll|workshop|hackathon|seminar|placement drive|\battend\b|campus event|rsvp|book a seat/i },
  { intent: "calendar", pattern: /schedule|timetable|calendar|today'?s (plan|day)|what.*(today|tomorrow|this week)|upcoming (classes|meetings|exams)|meeting|class timings|my day/i },
  { intent: "policy", pattern: /policy|rule|regulation|guideline|allowed|permitted|rule say|handbook/i },
  { intent: "career", pattern: /intern|placement|job|career|opportunit|resume|cv|hiring|recruit|eligible/i },
  { intent: "academic", pattern: /attend|grade|score|marks?|exam|course|semester|cgpa|gpa|class|assignment|academic/i },
  { intent: "analytics", pattern: /trend|statistic|metric|insight|performance|dashboard|analy|compare|drop|improve/i },
  { intent: "communication", pattern: /draft|email|message|write to|notify|communicat|compose|send (a )?(message|mail|email)|remind/i },
];

const GREETING_PATTERN = /^(hi+|hel+o+|hey|yo|hola|namaste|thanks|thank you|good (morning|afternoon|evening))\b/i;

function classifyIntentByKeywords(query: string): string {
  for (const rule of KEYWORD_RULES) {
    if (rule.pattern.test(query)) return rule.intent;
  }
  return "general";
}

/** Agents guaranteed for an intent/query when the LLM plan is weak or missing. */
function agentsForIntent(intent: string, query: string): string[] {
  const set = new Set<string>();
  const push = (c: string) => set.add(c);

  if (/intern|placement|eligible|career|opportunit/i.test(query)) {
    push("career");
    push("academic"); // eligibility needs academic standing
    push("knowledge"); // and policy context
  }
  if (/register|sign\s?up|enroll|workshop|hackathon|seminar|placement drive|\battend\b/i.test(query)) {
    push("events");
    push("calendar");
    push("knowledge");
  }
  if (/draft|email|message|communicat|notify|compose/i.test(query)) {
    push("communication");
    push("knowledge");
  }
  if (/remind/i.test(query)) {
    push("communication");
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
        // Advice-style policy questions ("what should I do?", "how do I fix…")
        // pair the cited policy with a personalized recommendation.
        if (/should i do|advice|recommend|what can i|how do i|fix|improve/i.test(query)) {
          push("academic");
        }
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
      case "general":
        break; // answered directly — no agents required
      default:
        push("knowledge");
        push("academic");
    }
  }

  return Array.from(set);
}

const INTENT_LABELS: Record<string, string> = {
  academic: "an academic question",
  career: "a career and placement question",
  policy: "an institutional policy question",
  analytics: "an analytics and insights question",
  communication: "a communication or notification request",
  events: "an events and registration request",
  calendar: "a schedule question",
  general: "a general question",
};

/** True when the LLM response looks like a real structured payload. */
function isUsablePayload(response: StructuredResponse): boolean {
  return (
    response.confidence > 0 &&
    response.result !== null &&
    response.result !== undefined &&
    typeof response.result === "object"
  );
}

/** True when the LLM produced a usable text answer (not a failure envelope). */
function isUsableText(response: StructuredResponse): boolean {
  return (
    response.confidence > 0 &&
    typeof response.result === "string" &&
    response.result.length > 0 &&
    !response.result.startsWith("I wasn't able to generate") &&
    !response.result.startsWith("The AI assistant isn't configured")
  );
}

let stepCounter = 0;
function nextStepId(agent: string): string {
  stepCounter += 1;
  return `wf-${stepCounter}-${agent}`;
}

function orcStep(message: string, durationMs: number): WorkflowStep {
  return {
    id: nextStepId("orchestrator"),
    agent: "orchestrator",
    label: "Orchestrator Agent",
    status: "done",
    message,
    durationMs,
  };
}

// ---------------------------------------------------------------------------
// Stage 1: Understand
// ---------------------------------------------------------------------------
async function stageUnderstand(query: string): Promise<string> {
  const prompt = `
Classify the user's intent in one word. Choose from:
- academic (about courses, grades, attendance)
- career (about internships, opportunities)
- policy (about institutional rules, regulations)
- analytics (about performance metrics, insights)
- communication (drafting messages, reminders, notifications)
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
  if (typeof intent === "string" && intent.length > 0) return intent;
  return classifyIntentByKeywords(query);
}

// ---------------------------------------------------------------------------
// Stage 2: Plan
// ---------------------------------------------------------------------------
async function stagePlan(intent: string, query: string): Promise<any> {
  const prompt = `
You are planning how to answer a user query on a Smart Campus OS. Determine which specialized agents to invoke.

Intent: ${intent}
Query: "${query}"

Available agents:
- career: placement & internship (eligibility, opportunities)
- knowledge: institutional policy / RAG retrieval
- academic: academic records, attendance, grades
- analytics: performance metrics, insights
- events: campus events, workshop registration
- calendar: today's schedule, timetable, meetings
- communication: reminders, notifications, drafting messages

Pick ALL agents relevant to fully answering the query. Multi-step requests (e.g.
"am I eligible for an internship, register me for a workshop, remind me") must
pick multiple agents. If the query is simple or general, pick none and the
orchestrator will answer directly.

Respond with JSON:
{
  "agents": ["career", "knowledge", "events", "communication"],
  "reasoning": "Why these agents are needed"
}
`;

  const response = await callGeminiStructured(prompt);
  const plan = (response.result as any) || {};
  if (Array.isArray(plan.agents) && plan.agents.length > 0) return plan;
  return {
    agents: agentsForIntent(intent, query),
    reasoning: "Deterministic fallback (LLM plan unavailable)",
  };
}

// ---------------------------------------------------------------------------
// Stage 3: Dispatch — run the specialized agents (they call real tools)
// ---------------------------------------------------------------------------
async function stageDispatch(
  plan: any,
  ctx: {
    userId: number;
    sessionId: string;
    openId: string;
    persona: "student" | "faculty" | "principal";
    query: string;
  },
  intent: string
): Promise<{
  runs: AgentRunResult[];
  steps: WorkflowStep[];
  actions: ActionSummary[];
  evidence: AgentEvidence[];
}> {
  const planned = Array.isArray(plan?.agents) ? plan.agents : [];
  const guaranteed = agentsForIntent(intent, ctx.query);

  // Map plan components to agent implementations, then dedupe so an agent that
  // was dispatched for several components (e.g. academic + calendar -> Student
  // Support) only runs once and shows once in the workflow.
  const componentToAgent: Record<string, string> = {
    knowledge: "knowledge",
    career: "placement",
    events: "events",
    academic: "support",
    analytics: "support",
    calendar: "support",
    communication: "action",
  };
  const merged = Array.from(new Set([...planned, ...guaranteed]));
  const agents = Array.from(new Set(merged.map((c) => componentToAgent[c] ?? c)));
  const steps: WorkflowStep[] = [];
  const runs: AgentRunResult[] = [];
  const actions: ActionSummary[] = [];
  const evidence: AgentEvidence[] = [];

  if (agents.length === 0) return { runs, steps, actions, evidence };

  const agentCtx = {
    userId: ctx.userId,
    sessionId: ctx.sessionId,
    openId: ctx.openId,
    persona: ctx.persona,
    query: ctx.query,
    facts: getSessionFacts(ctx.sessionId),
  };

  const dispatchStart = Date.now();
  steps.push(
    orcStep(
      `Routing to ${agents.length} specialized agent${agents.length === 1 ? "" : "s"}: ${agents.map((a) => AGENT_LABELS[a] ?? a).join(", ")}`,
      Date.now() - dispatchStart
    )
  );

  for (const agent of agents) {
    const runAgent = AGENT_MAP[agent];
    if (!runAgent) continue;
    const start = Date.now();
    try {
      const run = await runAgent({ ...agentCtx, facts: getSessionFacts(ctx.sessionId) });
      runs.push(run);
      steps.push(run.step);
      if (run.actions) actions.push(...run.actions);
      if (run.evidence) evidence.push(...run.evidence);
      if (run.memoryPatch) {
        updateSessionFacts(ctx.sessionId, run.memoryPatch);
      }
    } catch (error) {
      console.error(`[Orchestrator] Agent ${agent} failed:`, error);
      steps.push({
        id: nextStepId(agent),
        agent,
        label: AGENT_LABELS[agent] ?? agent,
        status: "failed",
        message: `${AGENT_LABELS[agent] ?? agent} encountered an error — continuing without it`,
        durationMs: Date.now() - start,
      });
    }
  }

  return { runs, steps, actions, evidence };
}

// ---------------------------------------------------------------------------
// Stage 4+5: Verify & Replan
// ---------------------------------------------------------------------------
function stageVerify(runs: AgentRunResult[]): {
  answer: string;
  evidence: AgentEvidence[];
  confidence: number;
  source_type: OrchestratorOutput["source_type"];
} {
  // Precedence: cited policy (RAG) knowledge > placement/career > academic
  // support > events > actions. A grounded policy citation outranks a
  // higher-confidence but less authoritative computed answer.
  const precedence = [
    "knowledge",
    "placement",
    "career",
    "academic",
    "support",
    "analytics",
    "calendar",
    "events",
    "action",
    "communication",
  ];

  const withAnswer = runs.filter((r) => r.answer && r.confidence > 0.3);
  const ranked = withAnswer.slice().sort((a, b) => {
    const pa = precedence.indexOf(a.step.agent);
    const pb = precedence.indexOf(b.step.agent);
    return (pa === -1 ? 99 : pa) - (pb === -1 ? 99 : pb);
  });
  const best = ranked[0];

  if (best) {
    return {
      answer: best.answer as string,
      evidence: best.evidence,
      confidence: best.confidence,
      source_type: best.evidence.some((e) => e.source === "policy")
        ? "rag"
        : "computed",
    };
  }

  const allEvidence = runs.flatMap((r) => r.evidence);
  const avg =
    runs.length > 0
      ? runs.reduce((s, r) => s + r.confidence, 0) / runs.length
      : 0;
  return {
    answer: "I couldn't find a confident answer in the campus data for that request.",
    evidence: allEvidence,
    confidence: Math.max(avg, 0),
    source_type: "computed",
  };
}

// ---------------------------------------------------------------------------
// Stage 6: Synthesize
// ---------------------------------------------------------------------------
async function stageSynthesize(
  verified: ReturnType<typeof stageVerify>,
  query: string,
  runs: AgentRunResult[],
  actions: ActionSummary[],
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>,
  intent: string,
  memoryLine: string
): Promise<Omit<OrchestratorOutput, "workflow" | "actions" | "sources" | "summary" | "memory">> {
  const historyText = conversationHistory
    .slice(-4)
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");

  const agentSummary = runs
    .filter((r) => r.answer)
    .map((r) => `[${AGENT_LABELS[r.step.agent] ?? r.step.agent}] ${r.answer}`)
    .join("\n");

  const actionsText = actions.length
    ? `\nActions completed:\n${actions.map((a) => `- ${a.title}: ${a.detail}`).join("\n")}`
    : "";

  const sourcesText = verified.evidence.length
    ? `\nSources:\n${verified.evidence.map((e) => `- ${e.source}${e.section ? ` (${e.section})` : ""}`).join("\n")}`
    : "";

  const prompt = `
You are synthesizing the final response of a multi-agent Smart Campus OS to the user.

Conversation History:
${historyText}

Known about the user: ${memoryLine || "nothing yet"}

Current Query: "${query}"

Agent Results:
${agentSummary || "(no agent results)"}
${actionsText}
${sourcesText}

Generate a natural, conversational response that:
1. Directly answers the user's query
2. References which agents contributed (if multiple)
3. Lists completed actions clearly (with ✓ marks)
4. Cites sources when policy/knowledge was used
5. Flags anything awaiting approval
6. Expresses appropriate confidence

Respond with JSON:
{
  "result": "Your synthesized answer here",
  "reasoning": "How you combined the agent results",
  "confidence": 0.85,
  "evidence": [{"source": "...", "content": "..."}],
  "rejected_alternatives": ["Alternative 1"]
}
`;

  const response = await callGeminiStructured(prompt);

  // LLM failed (rate limit etc.) — build a real, structured fallback answer
  // that merges every agent's findings (grounded answer first).
  if (!isUsableText(response)) {
    const runLines = runs
      .filter((r) => r.answer)
      .map((r) => r.answer as string);
    const merged = [verified.answer, ...runLines.filter((l) => l !== verified.answer)];
    const actionLines = actions.map((a) => `✓ ${a.title}`).join("\n");
    const sourceLines = verified.evidence
      .map((e) => `• ${e.source}${e.section ? ` (${e.section})` : ""}`)
      .join("\n");
    return {
      result: [
        merged.join("\n\n"),
        actionLines ? `\n\nActions:\n${actionLines}` : "",
        sourceLines ? `\n\nSources:\n${sourceLines}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      reasoning: "Synthesized from the agent results below (LLM unavailable).",
      confidence: verified.confidence || 0.5,
      evidence: verified.evidence,
      rejected_alternatives: ["Generated by the fallback synthesizer"],
      source_type: verified.source_type,
    };
  }

  return {
    result: response.result,
    reasoning: response.reasoning,
    confidence: response.confidence,
    evidence: response.evidence?.length ? response.evidence : verified.evidence,
    rejected_alternatives: response.rejected_alternatives,
    source_type: verified.source_type,
  };
}

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------
export async function orchestrate(input: OrchestratorInput): Promise<OrchestratorOutput> {
  const { userId, sessionId, userPersona, userQuery } = input;
  const openId = input.openId ?? `demo-${userPersona}`;
  const workflow: WorkflowStep[] = [];
  const allActions: ActionSummary[] = [];

  // ---- Session memory ------------------------------------------------------
  const facts = getSessionFacts(sessionId);
  if (input.fullName && !facts.fullName) {
    updateSessionFacts(sessionId, { fullName: input.fullName });
  }
  const extracted = extractFactsFromQuery(userQuery);
  if (extracted.year || extracted.department || extracted.interests.length || extracted.name) {
    updateSessionFacts(sessionId, {
      year: extracted.year ?? facts.year,
      department: extracted.department ?? facts.department,
      interests: Array.from(new Set([...facts.interests, ...extracted.interests])).slice(-6),
      fullName: extracted.name ?? facts.fullName,
      learned: [
        ...[
          extracted.year ? `is a ${extracted.year}` : "",
          extracted.department ? `${extracted.department} student` : "",
          extracted.interests.length ? `interested in ${extracted.interests.join(", ")}` : "",
        ].filter(Boolean),
        ...facts.learned,
      ].slice(-6),
    });
  }
  updateSessionFacts(sessionId, {
    previousRequests: [...facts.previousRequests, userQuery].slice(-8),
  });
  const memoryView = publicFacts(getSessionFacts(sessionId));

  const conversationHistory = await getConversationMemory(userId, sessionId);
  const longTermFacts = await getLongTermMemory(userId);

  // ---- Greeting / direct-answer path ---------------------------------------
  const isGreeting = GREETING_PATTERN.test(userQuery.trim()) && userQuery.trim().split(/\s+/).length <= 6;

  // Stage 1: Understand
  const understandStart = Date.now();
  const intent = await stageUnderstand(userQuery);
  workflow.push(
    orcStep(
      `Understood: ${INTENT_LABELS[intent] ?? "your request"}`,
      Date.now() - understandStart
    )
  );

  if (isGreeting) {
    const answer =
      userPersona === "student"
        ? `Hello${memoryView.fullName ? `, ${memoryView.fullName}` : ""}! 👋 I'm the Campus Intelligence assistant. I can check your attendance and grades, find internships you're eligible for, register you for workshops, answer campus policy questions, manage reminders and summarize your day. Try one of the suggested prompts below.`
        : `Hello${memoryView.fullName ? `, ${memoryView.fullName}` : ""}! 👋 I'm the Campus Intelligence assistant. I can help with institutional analytics, approvals, schedule and campus operations. What would you like to do?`;
    workflow.push(
      orcStep(
        "Answered directly (simple greeting)",
        Date.now() - understandStart
      )
    );
    const final: OrchestratorOutput = {
      result: answer,
      reasoning: "Greeting detected — no agents required.",
      confidence: 0.95,
      evidence: [],
      source_type: "computed",
      workflow,
      actions: [],
      sources: [],
      summary: {
        understood: "A friendly greeting",
        agents: [],
        findings: answer,
        actions: [],
        sources: [],
        pendingApprovals: [],
      },
      memory: { summary: memoryView.summary, previousRequests: memoryView.previousRequests },
    };
    return final;
  }

  // Stage 2: Plan
  const planStart = Date.now();
  const plan = await stagePlan(intent, userQuery);
  workflow.push(
    orcStep(
      plan.agents?.length
        ? `Planned ${plan.agents.length} step${plan.agents.length === 1 ? "" : "s"}: ${plan.agents.map((a: string) => AGENT_LABELS[a] ?? a).join(", ")}`
        : "Planning complete — answering directly",
      Date.now() - planStart
    )
  );

  // Stage 3: Dispatch
  const { runs, steps, actions, evidence } = await stageDispatch(plan, {
    userId,
    sessionId,
    openId,
    persona: userPersona,
    query: userQuery,
  }, intent);
  workflow.push(...steps);
  allActions.push(...actions);

  let final: OrchestratorOutput;

  // ---- Direct answer for general/simple queries -----------------------------
  if (runs.length === 0) {
    const directStart = Date.now();
    const prompt = `
The user asked: "${userQuery}"

Answer directly and conversationally. Keep it helpful and brief. If you cannot
answer from campus data, say what you can help with instead.

Respond with JSON:
{
  "result": "Your answer",
  "reasoning": "Why you answered this way",
  "confidence": 0.8,
  "evidence": [],
  "rejected_alternatives": []
}
`;
    const response = await callGeminiStructured(prompt);
    const answer = isUsableText(response)
      ? response.result
      : `I can help with attendance and grades, internship eligibility, campus events and registrations, policy questions, schedule summaries and reminders. Ask me anything about campus life!`;
    workflow.push(
      orcStep("Answered directly — no specialized agent required", Date.now() - directStart)
    );
    final = {
      result: answer,
      reasoning: response.reasoning || "Direct answer (no agents dispatched).",
      confidence: response.confidence || 0.7,
      evidence: [],
      source_type: "computed",
      workflow,
      actions: [],
      sources: [],
      summary: {
        understood: INTENT_LABELS[intent] ?? "your request",
        agents: [],
        findings: answer,
        actions: [],
        sources: [],
        pendingApprovals: [],
      },
      memory: { summary: memoryView.summary, previousRequests: memoryView.previousRequests },
    };
    await saveConversationMemory(userId, sessionId, [
      ...conversationHistory,
      { role: "user" as const, content: userQuery },
      { role: "assistant" as const, content: final.result },
    ]);
    return final;
  }

  // Stage 4: Verify
  const verified = stageVerify(runs);

  // Stage 5: Replan — patch low-confidence answers with knowledge when possible.
  let verifiedFinal = verified;
  if (verified.confidence < 0.3) {
    const knowledge = await knowledgeIntelligence(userQuery);
    if (knowledge.confidence > verified.confidence) {
      verifiedFinal = {
        answer: typeof knowledge.result === "string" ? knowledge.result : verified.answer,
        evidence: knowledge.evidence,
        confidence: knowledge.confidence,
        source_type: "rag",
      };
    }
  }

  const memoryLine = [
    memoryView.fullName,
    memoryView.year,
    memoryView.department,
    memoryView.interests.length ? `interests: ${memoryView.interests.join(", ")}` : "",
    ...longTermFacts,
  ]
    .filter(Boolean)
    .join(" · ");

  // Stage 6: Synthesize
  const synthStart = Date.now();
  const synthesized = await stageSynthesize(
    verifiedFinal,
    userQuery,
    runs,
    allActions,
    conversationHistory,
    intent,
    memoryLine
  );
  workflow.push(
    orcStep(
      `Combined results from ${runs.filter((r) => r.step.status === "done").length} agent${runs.filter((r) => r.step.status === "done").length === 1 ? "" : "s"} into your final answer`,
      Date.now() - synthStart
    )
  );

  const usedAgents = Array.from(
    new Set(runs.filter((r) => r.step.status === "done").map((r) => AGENT_LABELS[r.step.agent] ?? r.step.agent))
  );
  const findings = runs
    .filter((r) => r.answer)
    .map((r) => r.answer)
    .join("\n\n");

  final = {
    ...synthesized,
    workflow,
    actions: allActions,
    sources: evidence,
    summary: {
      understood: `${INTENT_LABELS[intent] ?? "your request"}${memoryView.summary ? ` — for ${memoryView.summary}` : ""}`,
      agents: usedAgents,
      findings,
      actions: allActions.map((a) => a.title),
      sources: Array.from(new Set(evidence.map((e) => `${e.source}${e.section ? ` (${e.section})` : ""}`))),
      pendingApprovals: allActions.filter((a) => a.requiresApproval).map((a) => a.title),
    },
    memory: { summary: memoryView.summary, previousRequests: memoryView.previousRequests },
  };

  // Persist conversation memory
  await saveConversationMemory(userId, sessionId, [
    ...conversationHistory,
    { role: "user" as const, content: userQuery },
    { role: "assistant" as const, content: final.result },
  ]);

  return final;
}
