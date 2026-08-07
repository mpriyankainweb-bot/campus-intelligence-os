/**
 * Gemini LLM adapter (replaces the Anthropic/Claude helper).
 *
 * Preserves the exact call surface used by the orchestrator and the
 * intelligence components (`callGeminiStructured` / `callGeminiText`) while
 * backing them with Google's Gemini REST API. No SDK dependency — plain fetch
 * against `generativelanguage.googleapis.com`.
 *
 * Env vars:
 *   GEMINI_API_KEY (or GOOGLE_API_KEY) — required for real completions
 *   GEMINI_MODEL (optional) — defaults to gemini-2.5-flash
 */

export interface StructuredResponse {
  result: any;
  reasoning: string;
  confidence: number;
  evidence: Array<{
    source: string;
    content: string;
    doc_id?: number;
    section?: string;
  }>;
  rejected_alternatives?: string[];
  source_type?: "rag" | "computed" | "derived" | "knowledge";
}

const DEFAULT_MODEL = "gemini-flash-latest";

// Model alias fallbacks: some API keys are provisioned against a subset of
// model versions, so on a 404/empty response we retry with the next alias.
const MODEL_FALLBACKS = [
  "gemini-flash-latest",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
];

const getApiKey = (): string =>
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_API_KEY ||
  process.env.GEMINI_API_KEY_SERVER ||
  "";

const getModels = (): string[] => {
  const configured = (process.env.GEMINI_MODEL || DEFAULT_MODEL).trim();
  if (configured && !configured.includes(",")) {
    return Array.from(new Set([configured, ...MODEL_FALLBACKS]));
  }
  return Array.from(
    new Set([...configured.split(",").map(s => s.trim()).filter(Boolean), ...MODEL_FALLBACKS])
  );
};

const NOT_CONFIGURED_MSG =
  "The AI assistant isn't configured yet — add your Gemini API key (GEMINI_API_KEY) in the Keys tab to enable chat.";

const GENERIC_FAILURE_MSG = "I wasn't able to generate a response right now. Please try again.";

/**
 * Single completion against the Gemini `generateContent` endpoint.
 * With `responseMimeType: "application/json"` the model returns raw JSON text.
 */
async function generateText(
  prompt: string,
  systemPrompt: string | undefined,
  maxOutputTokens: number
): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  let lastError: unknown = new Error("No model could be used");
  for (const model of getModels()) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        model
      )}:generateContent?key=${encodeURIComponent(apiKey)}`;

      const body: Record<string, unknown> = {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens,
          responseMimeType: "application/json",
        },
      };

      if (systemPrompt) {
        body.systemInstruction = { parts: [{ text: systemPrompt }] };
      }

      // 429 (quota/rate limit) retries with growing backoff — free-tier keys
      // rate-limit after bursts, and limits usually clear within seconds.
      for (let attempt = 0; ; attempt++) {
        const response = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });

        if (response.status === 429 && attempt < 2) {
          await sleep(2000 * (attempt + 1));
          continue;
        }

        if (!response.ok) {
          const errorText = await response.text().catch(() => "");
          lastError = new Error(
            `Gemini ${model} failed: ${response.status} ${response.statusText}${errorText ? ` — ${errorText.slice(0, 200)}` : ""}`
          );
          break;
        }

        const data = (await response.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        if (!text) {
          lastError = new Error(`Gemini ${model} returned an empty response`);
          break;
        }

        return stripCodeFence(text);
      }
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Gemini request failed after trying all models");
}

/** Gemini sometimes wraps JSON in ``` fences even in JSON mode. */
function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("```")) {
    const withoutFirst = trimmed.replace(/^```(?:json)?\s*/i, "");
    const withoutLast = withoutFirst.replace(/\s*```$/, "");
    return withoutLast.trim();
  }
  return trimmed;
}

function clampConfidence(value: unknown): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 0.8;
  return Math.min(1, Math.max(0, value));
}

/**
 * Normalize whatever JSON the model returned into a StructuredResponse.
 *
 * Some prompts ask for the full envelope (`{result, reasoning, confidence,
 * evidence}`) while the orchestrator's Understand/Plan stages ask for a raw
 * payload (`{intent}` or `{components}`). When the model returns a payload
 * without a top-level `result`, we wrap it in `result` so the existing
 * callers keep working (e.g. `response.result.intent`).
 */
function normalizeStructured(parsed: unknown): StructuredResponse {
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const candidate = parsed as Record<string, unknown>;
    if (typeof candidate.result === "string" || candidate.result === null) {
      return {
        result: candidate.result ?? null,
        reasoning:
          typeof candidate.reasoning === "string" ? candidate.reasoning : "",
        confidence: clampConfidence(candidate.confidence),
        evidence: Array.isArray(candidate.evidence)
          ? (candidate.evidence as StructuredResponse["evidence"])
          : [],
        rejected_alternatives: Array.isArray(candidate.rejected_alternatives)
          ? (candidate.rejected_alternatives as string[])
          : undefined,
        source_type: candidate.source_type as StructuredResponse["source_type"],
      };
    }
    // Raw payload (intent / plan / metrics): wrap it.
    return {
      result: candidate,
      reasoning: typeof candidate.reasoning === "string" ? candidate.reasoning : "",
      confidence: clampConfidence(candidate.confidence),
      evidence: Array.isArray(candidate.evidence)
        ? (candidate.evidence as StructuredResponse["evidence"])
        : [],
    };
  }
  if (typeof parsed === "string") {
    return { result: parsed, reasoning: "", confidence: 0.8, evidence: [] };
  }
  return { result: parsed, reasoning: "", confidence: 0.8, evidence: [] };
}

function failureResponse(message: string): StructuredResponse {
  return {
    result: message,
    reasoning: "LLM call failed",
    confidence: 0,
    evidence: [],
    source_type: "knowledge",
  };
}

/**
 * Call Gemini with a prompt and return a structured JSON response.
 * Never throws — returns an explicit failure response so the orchestrator
 * and components degrade gracefully (e.g. when the API key is missing).
 */
export async function callGeminiStructured(
  prompt: string,
  systemPrompt?: string
): Promise<StructuredResponse> {
  if (!getApiKey()) {
    console.warn("[LLM] GEMINI_API_KEY is not configured");
    return failureResponse(NOT_CONFIGURED_MSG);
  }

  try {
    const text = await generateText(prompt, systemPrompt, 4096);
    const parsed: unknown = JSON.parse(text);
    return normalizeStructured(parsed);
  } catch (error) {
    console.error("[LLM] Gemini structured call failed:", error);
    return failureResponse(GENERIC_FAILURE_MSG);
  }
}

/**
 * Simple text completion from Gemini (used for brief generation and chat).
 */
export async function callGeminiText(
  prompt: string,
  systemPrompt?: string
): Promise<string> {
  if (!getApiKey()) {
    console.warn("[LLM] GEMINI_API_KEY is not configured");
    return NOT_CONFIGURED_MSG;
  }

  try {
    return await generateText(prompt, systemPrompt, 2048);
  } catch (error) {
    console.error("[LLM] Gemini text call failed:", error);
    return GENERIC_FAILURE_MSG;
  }
}
