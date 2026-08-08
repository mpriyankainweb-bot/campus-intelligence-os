/**
 * Multi-agent orchestration layer — shared types.
 *
 * The orchestrator dispatches a user request to a set of specialized agents.
 * Each agent calls real tools (defined in ./tools.ts) and records a workflow
 * step. Every step, tool call and action is returned to the client so the AI
 * Assistant UI can render the visible, honest execution trace.
 */

export type WorkflowStatus = "done" | "failed" | "running";

export interface ToolCallResult {
  /** Tool name, e.g. "checkStudentProfile", "searchInternships". */
  name: string;
  /** Short human-readable arguments summary. */
  args: string;
  /** Short human-readable result of the tool. */
  result: string;
  ok: boolean;
}

export interface WorkflowStep {
  id: string;
  /** Agent key, e.g. "orchestrator" | "knowledge" | "placement" | "events" | "support" | "action". */
  agent: string;
  /** Display label, e.g. "Knowledge/RAG Agent". */
  label: string;
  status: WorkflowStatus;
  /** One-line status message, e.g. "Retrieved 2 policy documents". */
  message: string;
  /** Optional longer detail (agent answer) surfaced in the UI. */
  detail?: string;
  /** Real wall-clock time the step took, for the UI replay animation. */
  durationMs?: number;
  /** Tools this agent actually called, in order. */
  tools?: ToolCallResult[];
}

export interface ActionSummary {
  /** Action kind, e.g. "register", "calendar", "reminder", "notification", "draft". */
  kind: string;
  /** Short label, e.g. "Registered for workshop". */
  title: string;
  /** Longer description of what was done. */
  detail: string;
  /** True when this action requires a human (e.g. principal) approval. */
  requiresApproval?: boolean;
}

export interface AgentSummary {
  /** What the system understood (intent + key entities). */
  understood: string;
  /** Display labels of the agents that actually ran. */
  agents: string[];
  /** Key findings from the agents. */
  findings: string;
  /** Completed actions, e.g. ["Registered for Generative AI Workshop"]. */
  actions: string[];
  /** Sources used (RAG citations), e.g. ["Campus Attendance Policy §1"]. */
  sources: string[];
  /** Actions still pending human approval. */
  pendingApprovals: string[];
}

export interface SessionFacts {
  fullName?: string;
  year?: string;
  department?: string;
  interests: string[];
  previousRequests: string[];
  selectedEvents: string[];
  selectedInternships: string[];
  /** Arbitrary facts learned during the conversation, e.g. "3rd year CSE student". */
  learned: string[];
}

/**
 * Context shared by the orchestrator with every agent.
 */
export interface AgentCtx {
  userId: number;
  sessionId: string;
  openId: string;
  persona: "student" | "faculty" | "principal";
  query: string;
  /** In-memory session facts for this conversation. */
  facts: SessionFacts;
}

export interface AgentEvidence {
  source: string;
  content: string;
  doc_id?: number;
  section?: string;
}

/**
 * What an agent returns to the orchestrator after running: its workflow
 * step (tools + status), the answer content used for synthesis, evidence,
 * actions performed, and any session facts to persist.
 */
export interface AgentRunResult {
  step: WorkflowStep;
  answer?: string;
  evidence: AgentEvidence[];
  confidence: number;
  actions?: ActionSummary[];
  memoryPatch?: Partial<SessionFacts>;
}
