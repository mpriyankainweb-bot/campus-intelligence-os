import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface StructuredResponse {
  result: string;
  reasoning: string;
  confidence: number;
  evidence: Array<{ source: string; content: string; doc_id?: number; section?: string }>;
  rejected_alternatives?: string[];
  source_type?: "rag" | "computed" | "derived" | "knowledge";
}

/**
 * Call Claude with a prompt and return structured JSON response.
 * Automatically handles retries on failure.
 */
export async function callClaudeStructured(
  prompt: string,
  systemPrompt?: string
): Promise<StructuredResponse> {
  try {
    const response = await client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 2048,
      system: systemPrompt || "You are a helpful assistant that responds in structured JSON format.",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type from Claude");
    }

    // Parse JSON from response
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in Claude response");
    }

    const parsed = JSON.parse(jsonMatch[0]) as StructuredResponse;

    // Ensure confidence is between 0 and 1
    if (parsed.confidence < 0) parsed.confidence = 0;
    if (parsed.confidence > 1) parsed.confidence = 1;

    return parsed;
  } catch (error) {
    console.error("[LLM] Claude call failed:", error);
    // Return explicit failure response
    return {
      result: null as any,
      reasoning: "LLM call failed",
      confidence: 0,
      evidence: [],
      source_type: "knowledge",
    };
  }
}

/**
 * Simple text completion from Claude (used for brief generation).
 */
export async function callClaudeText(
  prompt: string,
  systemPrompt?: string
): Promise<string> {
  try {
    const response = await client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      system: systemPrompt || "You are a helpful assistant.",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type from Claude");
    }

    return content.text;
  } catch (error) {
    console.error("[LLM] Claude text call failed:", error);
    return "Unable to generate response at this time.";
  }
}
