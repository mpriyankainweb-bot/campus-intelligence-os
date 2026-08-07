/**
 * Demo-mode approval workflow.
 *
 * When Supabase/DATABASE_URL is not configured the app runs fully in demo
 * mode. This module provides a small in-memory set of pending high-impact
 * actions so Faculty and Principal dashboards can exercise the Approve /
 * Reject workflow end-to-end. The moment a database is available the real
 * `executionState` table is used instead and this store is ignored.
 */

export type DemoAction = {
  id: number;
  actionType: string;
  actionData: {
    title: string;
    description: string;
    impact: "low" | "medium" | "high";
    target?: string;
  };
  status: "pending" | "approved" | "rejected";
  createdAt: string;
};

let demoActions: DemoAction[] | null = null;

function seed(): DemoAction[] {
  const now = new Date().toISOString();
  return [
    {
      id: 101,
      actionType: "fee_waiver",
      actionData: {
        title: "Fee waiver request — R. Sharma (CSE, Year 3)",
        description:
          "Merit-based fee waiver for a student with 9.1 CGPA and family income below threshold. Finance recommends approval.",
        impact: "high",
        target: "Finance Office",
      },
      status: "pending",
      createdAt: now,
    },
    {
      id: 102,
      actionType: "announcement",
      actionData: {
        title: "Campus announcement — extended library hours",
        description:
          "Library open until 12 AM during exam week. Requires principal sign-off before broadcasting to all students.",
        impact: "medium",
        target: "All students",
      },
      status: "pending",
      createdAt: now,
    },
    {
      id: 103,
      actionType: "course_proposal",
      actionData: {
        title: "New elective — 'Introduction to Generative AI'",
        description:
          "Curriculum committee approved the syllabus. Final approval needed to open enrollment for next semester.",
        impact: "high",
        target: "Curriculum Committee",
      },
      status: "pending",
      createdAt: now,
    },
  ];
}

export function getDemoPendingActions(): DemoAction[] {
  if (!demoActions) demoActions = seed();
  return demoActions.filter((a) => a.status === "pending");
}

/** Returns true when the action existed and was updated. */
export function demoApproveAction(id: number): boolean {
  if (!demoActions) demoActions = seed();
  const action = demoActions.find((a) => a.id === id);
  if (!action) return false;
  action.status = "approved";
  return true;
}

/** Returns true when the action existed and was updated. */
export function demoRejectAction(id: number): boolean {
  if (!demoActions) demoActions = seed();
  const action = demoActions.find((a) => a.id === id);
  if (!action) return false;
  action.status = "rejected";
  return true;
}
