import { callGeminiStructured, StructuredResponse } from "../llm/gemini";
import { retrieveChunks } from "../rag/pipeline";
import { getDb } from "../../db";
import { academicRecords, careerOpportunities } from "../../../drizzle/schema";
import { eq } from "drizzle-orm";

/**
 * Base component interface.
 */
export interface ComponentOutput {
  result: any;
  evidence: Array<{ source: string; content: string; doc_id?: number; section?: string }>;
  confidence: number;
  source_type: "rag" | "computed" | "derived" | "knowledge";
}

/**
 * Academic Intelligence Component.
 * Analyzes student academic standing, performance, and intervention needs.
 */
export async function academicIntelligence(
  studentId: number,
  query: string
): Promise<ComponentOutput> {
  const db = await getDb();
  if (!db) {
    return {
      result: null,
      evidence: [],
      confidence: 0,
      source_type: "computed",
    };
  }

  const records = await db
    .select()
    .from(academicRecords)
    .where(eq(academicRecords.studentId, studentId));

  const prompt = `
You are an Academic Intelligence Component. Analyze the student's academic records and respond to their query.

Student Academic Records:
${records.map((r) => `- ${r.course}: ${r.attendancePercent}% attendance, standing: ${r.standing}`).join("\n")}

User Query: ${query}

Respond with JSON:
{
  "result": "Your analysis here",
  "reasoning": "Why you reached this conclusion",
  "confidence": 0.8,
  "evidence": [{"source": "academic_records", "content": "..."}],
  "rejected_alternatives": ["Alternative 1", "Alternative 2"]
}
`;

  const response = await callGeminiStructured(prompt);
  return {
    result: response.result,
    evidence: response.evidence || [],
    confidence: response.confidence,
    source_type: "computed",
  };
}

/**
 * Career Intelligence Component.
 * Identifies eligible opportunities and career paths.
 */
export async function careerIntelligence(
  studentId: number,
  query: string
): Promise<ComponentOutput> {
  const db = await getDb();
  if (!db) {
    return {
      result: null,
      evidence: [],
      confidence: 0,
      source_type: "computed",
    };
  }

  // Get student's academic records
  const records = await db
    .select()
    .from(academicRecords)
    .where(eq(academicRecords.studentId, studentId));

  // Get all opportunities
  const opportunities = await db.select().from(careerOpportunities);

  const prompt = `
You are a Career Intelligence Component. Analyze career opportunities for the student.

Student Academic Standing:
${records.map((r) => `- ${r.course}: ${r.attendancePercent}% attendance, standing: ${r.standing}`).join("\n")}

Available Opportunities:
${opportunities
  .map(
    (o) => `
- ${o.title}
  Eligibility: ${JSON.stringify(o.eligibilityCriteria)}
  Deadline: ${o.deadline}
`
  )
  .join("\n")}

User Query: ${query}

Respond with JSON:
{
  "result": "Your career analysis here",
  "reasoning": "Why these opportunities are suitable",
  "confidence": 0.85,
  "evidence": [{"source": "career_opportunities", "content": "..."}],
  "rejected_alternatives": []
}
`;

  const response = await callGeminiStructured(prompt);
  return {
    result: response.result,
    evidence: response.evidence || [],
    confidence: response.confidence,
    source_type: "derived",
  };
}

/**
 * Knowledge Intelligence Component (RAG-backed).
 * Answers questions from ingested policy documents.
 */
export async function knowledgeIntelligence(query: string): Promise<ComponentOutput> {
  // Retrieve relevant chunks from RAG
  const chunks = await retrieveChunks(query, 3);

  if (chunks.length === 0 || chunks[0].similarity < 0.3) {
    return {
      result: "I don't have information about this topic in the available policies.",
      evidence: [],
      confidence: 0,
      source_type: "rag",
    };
  }

  const prompt = `
You are a Knowledge Intelligence Component. Answer the user's question based strictly on the provided policy excerpts.

Policy Excerpts:
${chunks.map((c) => `[Document ${c.docId}, ${c.section}]\n${c.content}`).join("\n\n")}

User Query: ${query}

Respond with JSON:
{
  "result": "Your answer based strictly on the policies",
  "reasoning": "How the policies support this answer",
  "confidence": 0.9,
  "evidence": [{"source": "policy", "content": "...", "doc_id": 1, "section": "Section 1"}],
  "rejected_alternatives": []
}
`;

  const response = await callGeminiStructured(prompt);
  return {
    result: response.result,
    evidence: chunks.map((c) => ({
      source: "policy",
      content: c.content,
      doc_id: c.docId,
      section: c.section,
    })),
    confidence: response.confidence,
    source_type: "rag",
  };
}

/**
 * Analytics Intelligence Component.
 * Provides insights and metrics.
 */
export async function analyticsIntelligence(
  studentId: number,
  query: string
): Promise<ComponentOutput> {
  const db = await getDb();
  if (!db) {
    return {
      result: null,
      evidence: [],
      confidence: 0,
      source_type: "computed",
    };
  }

  const records = await db
    .select()
    .from(academicRecords)
    .where(eq(academicRecords.studentId, studentId));

  const avgAttendance =
    records.length > 0
      ? records.reduce((sum, r) => sum + parseFloat(r.attendancePercent.toString()), 0) / records.length
      : 0;

  const prompt = `
You are an Analytics Intelligence Component. Provide insights about the student's performance.

Student Metrics:
- Average Attendance: ${avgAttendance.toFixed(1)}%
- Courses: ${records.length}
- Good Standing Courses: ${records.filter((r) => r.standing === "good").length}
- Probation Courses: ${records.filter((r) => r.standing === "probation").length}

User Query: ${query}

Respond with JSON:
{
  "result": "Your analytics insight here",
  "reasoning": "How you derived this insight",
  "confidence": 0.85,
  "evidence": [{"source": "analytics", "content": "..."}],
  "rejected_alternatives": []
}
`;

  const response = await callGeminiStructured(prompt);
  return {
    result: response.result,
    evidence: response.evidence || [],
    confidence: response.confidence,
    source_type: "computed",
  };
}

/**
 * Communication Intelligence Component.
 * Drafts communications and determines approval needs.
 */
export async function communicationIntelligence(
  userPersona: "student" | "faculty" | "principal",
  query: string,
  context?: string
): Promise<ComponentOutput> {
  const prompt = `
You are a Communication Intelligence Component. Draft a communication for the user.

User Persona: ${userPersona}
Query: ${query}
${context ? `Context: ${context}` : ""}

Respond with JSON:
{
  "result": "Your drafted communication here",
  "reasoning": "Why this communication is appropriate",
  "confidence": 0.8,
  "evidence": [{"source": "communication_draft", "content": "..."}],
  "rejected_alternatives": ["Alternative 1"]
}
`;

  const response = await callGeminiStructured(prompt);
  return {
    result: response.result,
    evidence: response.evidence || [],
    confidence: response.confidence,
    source_type: "knowledge",
  };
}
