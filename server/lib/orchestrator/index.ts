import { callClaudeStructured, StructuredResponse } from "../llm/claude";
import {
  academicIntelligence,
  careerIntelligence,
  knowledgeIntelligence,
  analyticsIntelligence,
  communicationIntelligence,
  ComponentOutput,
} from "../components/index";
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
- general (other)

User Query: "${query}"

Respond with JSON:
{
  "intent": "academic"
}
`;

  const response = await callClaudeStructured(prompt);
  return (response.result as any)?.intent || "general";
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

Respond with JSON:
{
  "components": ["academic", "career", "knowledge"],
  "reasoning": "Why these components are needed"
}
`;

  const response = await callClaudeStructured(prompt);
  return (response.result as any) || { components: [], reasoning: "" };
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
  const components = plan.components || [];

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
 * Precedence: Knowledge > Academic/Career/Analytics > Communication
 */
function stageVerify(componentResults: Record<string, ComponentOutput>): ComponentOutput {
  // Precedence order
  const precedence = ["knowledge", "academic", "career", "analytics", "communication"];

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
 * For now, simple: if confidence is too low, try a fallback.
 */
async function stageReplan(
  verified: ComponentOutput,
  query: string
): Promise<ComponentOutput> {
  if (verified.confidence < 0.3) {
    // Try knowledge component as fallback
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
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>
): Promise<OrchestratorOutput> {
  const historyText = conversationHistory
    .slice(-4) // Last 4 messages for context
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");

  const prompt = `
You are synthesizing a final response to the user.

Conversation History:
${historyText}

Current Query: "${query}"

Component Result:
Result: ${verified.result}
Confidence: ${verified.confidence}
Evidence: ${verified.evidence.map((e) => `${e.source}: ${e.content}`).join("; ")}

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

  const response = await callClaudeStructured(prompt);
  return {
    result: response.result,
    reasoning: response.reasoning,
    confidence: response.confidence,
    evidence: response.evidence || verified.evidence,
    rejected_alternatives: response.rejected_alternatives,
    source_type: verified.source_type,
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
  const final = await stageSynthesize(replanned, input.userQuery, conversationHistory);

  // Update conversation memory
  const updatedHistory = [
    ...conversationHistory,
    { role: "user" as const, content: input.userQuery },
    { role: "assistant" as const, content: final.result },
  ];
  await saveConversationMemory(input.userId, input.sessionId, updatedHistory);

  return final;
}
