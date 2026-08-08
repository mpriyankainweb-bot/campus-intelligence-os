/**
 * Knowledge/RAG Agent.
 *
 * Searches the institutional knowledge base (vector RAG when a database is
 * configured, keyword-scored demo policy corpus otherwise) and returns the
 * answer WITH the source documents. When no source matches, it says so
 * explicitly rather than inventing institutional policy.
 */

import type { AgentCtx, AgentRunResult } from "./types";
import { searchKnowledge } from "./tools";

export async function knowledgeAgent(ctx: AgentCtx): Promise<AgentRunResult> {
  const started = Date.now();
  const toolArgs = `query: "${ctx.query.slice(0, 60)}"`;

  const result = await searchKnowledge(ctx.query);

  const durationMs = Date.now() - started;
  const ok = result.confidence > 0 && result.sources.length > 0;

  return {
    step: {
      id: `step-${Date.now()}-knowledge`,
      agent: "knowledge",
      label: "Knowledge/RAG Agent",
      status: ok ? "done" : "failed",
      message: ok
        ? `Retrieved ${result.sources.length} relevant document${result.sources.length === 1 ? "" : "s"}`
        : "No matching policy document found",
      detail: ok ? result.answer : undefined,
      durationMs,
      tools: [
        {
          name: "searchKnowledge",
          args: toolArgs,
          result: ok
            ? `${result.sources.length} source(s) retrieved from the knowledge base`
            : "no relevant source found — policy not invented",
          ok: true,
        },
      ],
    },
    answer: ok ? result.answer : undefined,
    evidence: ok ? result.sources : [],
    confidence: ok ? result.confidence : 0,
  };
}
