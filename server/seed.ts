/**
 * Seed script for Campus Intelligence OS (Supabase Postgres).
 *
 * Creates the three demo personas, academic records, career opportunities,
 * pending approval actions, and (optionally) ingests the policy documents
 * used by the RAG pipeline.
 *
 * Usage: pnpm db:seed   (requires DATABASE_URL to be set)
 * The script is idempotent — re-running it skips data that already exists.
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { getDb, upsertUser, getUserByOpenId } from "./db";
import {
  academicRecords,
  careerOpportunities,
  documents,
  executionState,
  type Persona,
} from "../drizzle/schema";
import { createAction } from "./lib/memory/store";
import { ingestDocument } from "./lib/rag/pipeline";

const DEMO_USERS: Array<{
  persona: Persona;
  fullName: string;
  email: string;
  department: string | null;
}> = [
  { persona: "student", fullName: "Ananya Rao", email: "student@demo.edu", department: "CSE" },
  { persona: "faculty", fullName: "Dr. Vikram Shah", email: "faculty@demo.edu", department: "Computer Science" },
  { persona: "principal", fullName: "Dr. Meera Iyer", email: "principal@demo.edu", department: null },
];

const CAREER_OPPORTUNITIES = [
  {
    title: "Google Software Engineering Internship",
    eligibilityCriteria: { minAttendance: 75, minCgpa: 8.0, standing: "good" },
    deadline: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
  },
  {
    title: "Microsoft Research Summer Fellowship",
    eligibilityCriteria: { minAttendance: 70, minCgpa: 8.5, standing: "good" },
    deadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
  },
  {
    title: "Open Source Contributor Program (Campus Chapters)",
    eligibilityCriteria: { minAttendance: 60, standing: ["good", "probation"] },
    deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  },
];

const POLICY_DOCUMENTS: Array<{ title: string; docType: string; content: string }> = [
  {
    title: "Attendance Policy",
    docType: "policy",
    content: `Campus Attendance Policy (Effective 2025)

1. Minimum attendance requirement: Every student must maintain at least 75% attendance in each course to be eligible to appear for end-semester examinations.

2. Exemptions: Medical leave, approved college events, and internship interviews supported by documentation are exempted from attendance calculations.

3. Consequences of shortfall: Students below 75% attendance will be placed on academic warning. Continued shortfall below 60% results in probation and mandatory counselling sessions.

4. Make-up policy: Students may request make-up attendance for documented medical emergencies within 7 days of the absence.

5. Faculty responsibility: Faculty must publish attendance within 48 hours of each class and notify the academic office of students below the threshold.`,
  },
  {
    title: "Code of Conduct",
    docType: "policy",
    content: `Campus Code of Conduct (Effective 2025)

1. Academic integrity: Plagiarism, cheating, and unauthorized collaboration are strictly prohibited. Violations are reviewed by the Academic Integrity Committee.

2. Respectful environment: Harassment, discrimination, and bullying of any kind are not tolerated. Complaints may be filed confidentially with the Dean of Students.

3. Digital usage: Use of campus networks must comply with institutional policies. Unauthorized access to systems or data is a serious violation.

4. Communication channels: Students and faculty should route official communications through approved institutional channels (institutional email, learning management system).

5. Disciplinary process: Alleged violations are investigated, and outcomes range from warnings to suspension depending on severity and prior record.`,
  },
  {
    title: "Internship & Placement Policy",
    docType: "policy",
    content: `Internship and Placement Policy (Effective 2025)

1. Eligibility: Students with at least 75% attendance and good academic standing may register for on-campus internship opportunities. Probation students require department head approval.

2. Registration: Students must apply through the careers portal. The placement cell verifies eligibility before forwarding applications.

3. Offer acceptance: Students who accept an offer must notify the placement cell within 72 hours. Multiple concurrent offers require disclosure.

4. Credits: Approved internships of 8 weeks or more count toward industry experience credits with faculty endorsement.

5. Communications to the placement cell or external employers must be approved by the department head before dispatch.`,
  },
];

async function main() {
  const db = await getDb();
  if (!db) {
    console.log(
      "\n[Seed] DATABASE_URL is not configured — skipping. Set DATABASE_URL (Supabase Postgres) and run `pnpm db:push` first.\n"
    );
    process.exit(0);
  }

  console.log("[Seed] Connected to database.");

  // 1. Demo personas -----------------------------------------------------------------
  const userIds: Record<Persona, number> = { student: -1, faculty: -1, principal: -1 };
  for (const demo of DEMO_USERS) {
    const openId = `demo-${demo.persona}`;
    await upsertUser({
      openId,
      fullName: demo.fullName,
      email: demo.email,
      persona: demo.persona,
      department: demo.department,
      lastSignedIn: new Date(),
    });
    const user = await getUserByOpenId(openId);
    if (user) {
      userIds[demo.persona] = user.id;
      console.log(`[Seed] Demo ${demo.persona} ready (id=${user.id}).`);
    }
  }

  // 2. Academic records for the demo student -----------------------------------------
  const existingRecord = await db
    .select({ id: academicRecords.id })
    .from(academicRecords)
    .where(eq(academicRecords.studentId, userIds.student))
    .limit(1);
  if (existingRecord.length === 0) {
    await db.insert(academicRecords).values([
      { studentId: userIds.student, course: "Data Structures", attendancePercent: "86.0", standing: "good" },
      { studentId: userIds.student, course: "Operating Systems", attendancePercent: "78.5", standing: "good" },
      { studentId: userIds.student, course: "Discrete Mathematics", attendancePercent: "62.0", standing: "probation" },
      { studentId: userIds.student, course: "Computer Networks", attendancePercent: "91.0", standing: "good" },
    ]);
    console.log("[Seed] Academic records created for demo student.");
  } else {
    console.log("[Seed] Academic records already present — skipping.");
  }

  // 3. Career opportunities -----------------------------------------------------------
  const existingOpp = await db.select({ id: careerOpportunities.id }).from(careerOpportunities).limit(1);
  if (existingOpp.length === 0) {
    await db.insert(careerOpportunities).values(CAREER_OPPORTUNITIES);
    console.log("[Seed] Career opportunities created.");
  } else {
    console.log("[Seed] Career opportunities already present — skipping.");
  }

  // 4. Pending approval actions -------------------------------------------------------
  const pending = await db
    .select({ id: executionState.id })
    .from(executionState)
    .where(eq(executionState.status, "pending"))
    .limit(1);
  if (pending.length === 0) {
    const studentAction = await createAction(
      userIds.student,
      "communication",
      {
        title: "Internship Registration — Google SWE Internship",
        description:
          "Ananya Rao requested approval to register for the Google Software Engineering Internship on the careers portal.",
        target: "placement-cell",
        impact: "medium",
      },
      userIds.faculty
    );
    const facultyAction = await createAction(
      userIds.faculty,
      "communication",
      {
        title: "Department-Wide Communication",
        description:
          "Dr. Vikram Shah drafted a communication to the Computer Science department regarding the upcoming research symposium.",
        target: "department",
        impact: "high",
      },
      userIds.principal
    );
    console.log(`[Seed] Pending actions created (student#${studentAction} → faculty, faculty#${facultyAction} → principal).`);
  } else {
    console.log("[Seed] Pending actions already present — skipping.");
  }

  // 5. Policy documents for RAG -------------------------------------------------------
  const existingDoc = await db.select({ id: documents.id }).from(documents).limit(1);
  if (existingDoc.length === 0) {
    console.log(
      "[Seed] Ingesting policy documents for RAG (first run downloads the local embedding model — this can take a minute or two)..."
    );
    for (const doc of POLICY_DOCUMENTS) {
      try {
        const result = await ingestDocument(doc.title, doc.docType, doc.content, new Date());
        console.log(`[Seed] Ingested "${doc.title}" → ${result.chunkCount} chunks.`);
      } catch (error) {
        console.warn(`[Seed] Failed to ingest "${doc.title}":`, error);
      }
    }
  } else {
    console.log("[Seed] Policy documents already present — skipping.");
  }

  console.log("\n[Seed] Done. Open the app and sign in as a demo persona to explore.\n");
  process.exit(0);
}

main().catch((error) => {
  console.error("[Seed] Failed:", error);
  process.exit(1);
});
