/**
 * In-memory demo datasets.
 *
 * Used as graceful fallbacks when the database is unavailable so the
 * orchestrator components (and therefore chat + dashboards) still produce
 * rich, realistic answers in the preview. When DATABASE_URL is configured and
 * `pnpm db:seed` has run, the same data is served from Supabase Postgres.
 */

export const DEMO_ACADEMIC_RECORDS = [
  { id: 1, studentId: -1, course: "Data Structures", attendancePercent: "86.0", standing: "good" as const },
  { id: 2, studentId: -1, course: "Operating Systems", attendancePercent: "78.5", standing: "good" as const },
  { id: 3, studentId: -1, course: "Discrete Mathematics", attendancePercent: "62.0", standing: "probation" as const },
  { id: 4, studentId: -1, course: "Computer Networks", attendancePercent: "91.0", standing: "good" as const },
];

export const DEMO_CAREER_OPPORTUNITIES = [
  {
    id: 1,
    title: "Google Software Engineering Internship",
    eligibilityCriteria: { minAttendance: 75, minCgpa: 8.0, standing: "good" },
    deadline: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
  },
  {
    id: 2,
    title: "Microsoft Research Summer Fellowship",
    eligibilityCriteria: { minAttendance: 70, minCgpa: 8.5, standing: "good" },
    deadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
  },
  {
    id: 3,
    title: "Open Source Contributor Program (Campus Chapters)",
    eligibilityCriteria: { minAttendance: 60, standing: ["good", "probation"] },
    deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  },
];

/** Policy documents pre-split into chunks with keyword tags for the demo RAG fallback. */
export const DEMO_POLICY_CHUNKS: Array<{
  docId: number;
  section: string;
  content: string;
  keywords: string[];
}> = [
  {
    docId: 1,
    section: "Section 1",
    keywords: ["attendance", "75%", "75", "minimum", "requirement", "eligible", "examination", "exams"],
    content:
      "Campus Attendance Policy: Every student must maintain at least 75% attendance in each course to be eligible to appear for end-semester examinations.",
  },
  {
    docId: 1,
    section: "Section 3",
    keywords: ["consequence", "shortfall", "shortage", "warning", "probation", "60%", "60", "below", "counselling", "make-up"],
    content:
      "Consequences of shortfall: Students below 75% attendance will be placed on academic warning. Continued shortfall below 60% results in probation and mandatory counselling sessions.",
  },
  {
    docId: 1,
    section: "Section 4",
    keywords: ["make-up", "medical", "leave", "exemption", "7 days", "emergency"],
    content:
      "Make-up policy: Students may request make-up attendance for documented medical emergencies within 7 days of the absence. Medical leave and approved college events are exempted.",
  },
  {
    docId: 2,
    section: "Section 1",
    keywords: ["integrity", "plagiarism", "cheating", "academic", "conduct", "violation"],
    content:
      "Code of Conduct — Academic integrity: Plagiarism, cheating, and unauthorized collaboration are strictly prohibited. Violations are reviewed by the Academic Integrity Committee.",
  },
  {
    docId: 2,
    section: "Section 4",
    keywords: ["communication", "channel", "official", "email", "institutional", "lms"],
    content:
      "Communication channels: Students and faculty should route official communications through approved institutional channels such as institutional email and the learning management system.",
  },
  {
    docId: 3,
    section: "Section 1",
    keywords: ["internship", "eligibility", "placement", "75%", "good standing", "register"],
    content:
      "Internship and Placement Policy: Students with at least 75% attendance and good academic standing may register for on-campus internship opportunities. Probation students require department head approval.",
  },
  {
    docId: 3,
    section: "Section 5",
    keywords: ["communication", "approval", "placement cell", "employer", "department head"],
    content:
      "Communications to the placement cell or external employers must be approved by the department head before dispatch.",
  },
];

/** Common words that add no retrieval signal. */
const POLICY_STOPWORDS = new Set([
  "what", "which", "when", "where", "who", "how", "why", "the", "and", "for", "are", "is",
  "am", "do", "does", "did", "should", "would", "could", "will", "with", "from", "into",
  "over", "under", "this", "that", "these", "those", "me", "my", "our", "i", "a", "an",
  "of", "to", "in", "on", "at", "by", "its", "or", "as", "be", "been", "can", "may",
  "not", "no", "so", "too", "very", "about", "any", "all", "also", "but", "if", "then",
  "than", "there", "their", "they", "have", "has", "had", "please", "tell", "said",
]);

/**
 * Simple keyword-scored retrieval over the demo policy chunks — a stand-in
 * for RAG when the vector store (database) is unavailable. Stopwords are
 * dropped so natural-language questions ("what rules apply...") still match
 * the corpus precisely.
 */
export function searchDemoPolicyChunks(query: string, topK = 3) {
  const tokens = query
    .toLowerCase()
    .split(/[^a-z0-9%]+/)
    .filter((t) => t.length > 2 && !POLICY_STOPWORDS.has(t));

  if (tokens.length === 0) return [];

  return DEMO_POLICY_CHUNKS.map((chunk) => {
    const haystack = `${chunk.content} ${chunk.keywords.join(" ")}`.toLowerCase();
    const score = tokens.reduce((sum, token) => sum + (haystack.includes(token) ? 1 : 0), 0);
    return {
      docId: chunk.docId,
      section: chunk.section,
      content: chunk.content,
      similarity: score / Math.max(tokens.length, 1),
    };
  })
    .filter((r) => r.similarity >= 0.4)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
}
