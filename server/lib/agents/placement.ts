/**
 * Placement & Internship Agent.
 *
 * Checks the student's profile (attendance, CGPA, standing), screens open
 * internship/placement opportunities for eligibility, and recommends the best
 * ones ranked by fit. Uses the real demo/DB opportunity catalog.
 */

import type { AgentCtx, AgentRunResult, SessionFacts } from "./types";
import { checkStudentProfile, searchInternships } from "./tools";

export async function placementAgent(ctx: AgentCtx): Promise<AgentRunResult> {
  const started = Date.now();

  const profile = await checkStudentProfile(ctx.userId, ctx.persona);
  const recommendations = await searchInternships(profile, ctx.query);

  const eligible = recommendations.filter((r) => r.eligible);
  const relevant = recommendations.slice(0, 3);

  const lines = relevant.map(
    (r) =>
      `${r.eligible ? "✅" : "⛔"} ${r.title}${r.eligible ? "" : " (not eligible)"} — deadline ${r.deadline}`
  );

  const answer = [
    `${profile.fullName}'s profile: ${profile.year}, ${profile.department} · avg attendance ${profile.avgAttendance.toFixed(1)}% · CGPA ${profile.cgpa}` +
      (profile.flaggedCourses.length
        ? ` · flagged: ${profile.flaggedCourses.join(", ")}`
        : ""),
    "",
    ...lines,
    eligible.length > 0
      ? ""
      : "You're not currently eligible for any open opportunity — focus on the unmet criteria below.",
  ]
    .filter(Boolean)
    .join("\n");

  const durationMs = Date.now() - started;
  const memoryPatch: Partial<SessionFacts> = {
    year: profile.year !== "—" ? profile.year : ctx.facts.year,
    department: profile.department !== "General" ? profile.department : ctx.facts.department,
    fullName: profile.fullName !== "Student" ? profile.fullName : ctx.facts.fullName,
    selectedInternships: Array.from(
      new Set([
        ...ctx.facts.selectedInternships,
        ...relevant.filter((r) => r.eligible).map((r) => r.title),
      ])
    ).slice(-5),
  };

  return {
    step: {
      id: `step-${Date.now()}-placement`,
      agent: "placement",
      label: "Placement & Internship Agent",
      status: "done",
      message: `Screened ${recommendations.length} opportunities against your profile`,
      detail: answer,
      durationMs,
      tools: [
        {
          name: "checkStudentProfile",
          args: `userId: ${ctx.userId}`,
          result: `${profile.fullName} · ${profile.year} ${profile.department} · attendance ${profile.avgAttendance.toFixed(1)}% · CGPA ${profile.cgpa}`,
          ok: true,
        },
        {
          name: "searchInternships",
          args: `query: "${ctx.query.slice(0, 60)}"`,
          result: `${recommendations.length} opportunity(ies) screened, ${eligible.length} eligible`,
          ok: true,
        },
      ],
    },
    answer,
    evidence: [
      {
        source: "academic_records",
        content: `avg attendance ${profile.avgAttendance.toFixed(1)}% · CGPA ${profile.cgpa} · ${profile.goodStandingRatio >= 0.75 ? "good standing" : "standing flagged"}`,
      },
      {
        source: "career_opportunities",
        content: relevant
          .map((r) => `${r.title} (${r.eligible ? "eligible" : "not eligible"})`)
          .join("; "),
      },
    ],
    confidence: 0.85,
    memoryPatch,
  };
}
