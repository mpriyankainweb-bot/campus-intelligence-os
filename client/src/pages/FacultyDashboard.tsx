import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { DashboardShell, type NavItem } from "@/components/dashboard/DashboardShell";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { StatCard } from "@/components/dashboard/StatCard";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { Reveal } from "@/components/dashboard/Reveal";
import { ApprovalsPanel } from "@/components/dashboard/ApprovalsPanel";
import { ExplainableChat } from "@/components/ExplainableChat";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BookOpen,
  Check,
  ClipboardList,
  GraduationCap,
  Megaphone,
  NotebookPen,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import {
  ANNOUNCEMENTS,
  ASSIGNMENT_REVIEWS,
  FACULTY_ATTENDANCE,
  FACULTY_CLASSES,
  FACULTY_NOTIFICATIONS,
  LEAVE_REQUESTS,
  STUDENT_PERFORMANCE,
} from "@/lib/dashboardData";

const NAV: NavItem[] = [
  { id: "overview", label: "Overview", icon: GraduationCap },
  { id: "classes", label: "Classes", icon: BookOpen },
  { id: "analytics", label: "Student Analytics", icon: Users },
  { id: "assignments", label: "Assignments", icon: ClipboardList },
  { id: "assistant", label: "AI Teaching Assistant", icon: Sparkles },
  { id: "leave", label: "Leave Requests", icon: NotebookPen },
  { id: "announcements", label: "Announcements", icon: Megaphone },
];

const STATUS_TONE = (status: string) =>
  status === "good"
    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
    : status === "warning"
      ? "bg-amber-50 text-amber-700 ring-amber-200"
      : "bg-rose-50 text-rose-700 ring-rose-200";

export default function FacultyDashboard() {
  const { user: authUser } = useAuth({
    redirectOnUnauthenticated: true,
    redirectPath: "/",
  });
  const brief = trpc.brief.useQuery(undefined, { enabled: Boolean(authUser), retry: false });
  const actionsQuery = trpc.actions.useQuery(undefined, { enabled: Boolean(authUser), retry: false });
  const [leaveRequests, setLeaveRequests] = useState(LEAVE_REQUESTS);

  const pendingApprovals = actionsQuery.data?.length ?? 0;

  const decideLeave = (id: number, decision: "approved" | "rejected") =>
    setLeaveRequests((prev) => prev.map((l) => (l.id === id ? { ...l, status: decision } : l)));

  return (
    <DashboardShell
      title="Faculty Dashboard"
      nav={NAV}
      notifications={FACULTY_NOTIFICATIONS}
    >
      <PageHeader
        title={`Welcome, ${authUser?.fullName?.split(" ")[0] || "Faculty"}`}
        subtitle={`${new Date().toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
        })} · ${FACULTY_CLASSES.length} classes · ${FACULTY_CLASSES.reduce((s, c) => s + c.students, 0)} students`}
        actions={
          <Button
            className="gap-2 bg-slate-900 text-white hover:bg-slate-800"
            onClick={() =>
              document.getElementById("assistant")?.scrollIntoView({ behavior: "smooth" })
            }
          >
            <Sparkles className="size-4" /> Open AI teaching assistant
          </Button>
        }
      />

      {/* Stats */}
      <Reveal>
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard icon={Users} label="Students taught" value="165" delta="+6" accent="blue" />
          <StatCard icon={BookOpen} label="Classes" value={`${FACULTY_CLASSES.length}`} hint="4 active courses" accent="violet" />
          <StatCard
            icon={Check}
            label="Pending approvals"
            value={`${pendingApprovals}`}
            accent="amber"
            hint="Actions awaiting your sign-off"
          />
          <StatCard
            icon={GraduationCap}
            label="Avg attendance"
            value={`${Math.round(FACULTY_ATTENDANCE.reduce((s, c) => s + c.rate, 0) / FACULTY_ATTENDANCE.length)}%`}
            delta="-1.2%"
            deltaGood={false}
            accent="emerald"
          />
        </div>
      </Reveal>

      {/* Classes + attendance */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Reveal className="lg:col-span-3">
          <SectionCard
            id="classes"
            title="Class management"
            description="Your courses and next sessions"
            action={<Badge variant="secondary">Semester 6</Badge>}
          >
            <ul className="space-y-3">
              {FACULTY_CLASSES.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-3 transition-colors hover:border-blue-200 hover:bg-blue-50/40"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-slate-900 px-2 py-0.5 font-mono text-[11px] font-semibold text-white">
                        {c.code}
                      </span>
                      <p className="truncate text-sm font-semibold text-slate-900">{c.course}</p>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {c.students} students · Next: {c.nextClass} · {c.room}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge variant="secondary">{c.attendanceRate}% attendance</Badge>
                  </div>
                </li>
              ))}
            </ul>
          </SectionCard>
        </Reveal>

        <Reveal delay={0.08} className="lg:col-span-2">
          <SectionCard
            id="analytics"
            title="Attendance management"
            description="Per-course attendance rates"
          >
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={FACULTY_ATTENDANCE} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="course" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
                    cursor={{ fill: "#f1f5f9" }}
                    formatter={(value) => [`${value}%`, "Attendance"]}
                  />
                  <Bar dataKey="rate" radius={[6, 6, 0, 0]}>
                    {FACULTY_ATTENDANCE.map((c) => (
                      <Cell
                        key={c.course}
                        fill={c.rate >= 80 ? "#0ea5e9" : c.rate >= 70 ? "#f59e0b" : "#ef4444"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
        </Reveal>
      </div>

      {/* Performance + assignments */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Reveal>
          <SectionCard title="Student performance analytics" description="Intervention flags for your courses">
            <ul className="divide-y divide-slate-100">
              {STUDENT_PERFORMANCE.map((s) => (
                <li key={s.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <Avatar className="size-8 border border-slate-200 bg-slate-100">
                    <AvatarFallback className="text-[10px] font-semibold text-slate-600">
                      {s.student.split(" ").map((p) => p[0]).join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900">{s.student}</p>
                    <p className="text-xs text-slate-500">
                      Attendance {s.attendance}% · Avg {s.score}
                    </p>
                  </div>
                  <Badge className={STATUS_TONE(s.status)}>
                    {s.status === "good" ? "Good" : s.status === "warning" ? "Watch" : "Intervene"}
                  </Badge>
                </li>
              ))}
            </ul>
          </SectionCard>
        </Reveal>

        <Reveal delay={0.08}>
          <SectionCard
            id="assignments"
            title="Assignment review"
            description="Grading queue"
            action={<Badge variant="secondary">1 in review</Badge>}
          >
            <ul className="space-y-3">
              {ASSIGNMENT_REVIEWS.map((a) => (
                <li key={a.id} className="rounded-xl border border-slate-100 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{a.title}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {a.graded}/{a.submissions} graded
                      </p>
                    </div>
                    {a.status === "pending" ? (
                      <Button size="sm" variant="outline" disabled className="text-xs">
                        Not opened
                      </Button>
                    ) : a.status === "in-review" ? (
                      <Button size="sm" className="bg-slate-900 text-white hover:bg-slate-800 text-xs">
                        Review {a.submissions - a.graded} left
                      </Button>
                    ) : (
                      <Badge className="bg-emerald-50 text-emerald-700">Complete</Badge>
                    )}
                  </div>
                  <div className="mt-2.5 flex items-center gap-2">
                    <Progress
                      value={(a.graded / Math.max(a.submissions, 1)) * 100}
                      className="h-1.5"
                    />
                    <span className="text-[11px] text-slate-400">
                      {Math.round((a.graded / Math.max(a.submissions, 1)) * 100)}%
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </SectionCard>
        </Reveal>
      </div>

      {/* Approvals + leave */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Reveal>
          <SectionCard
            title="Pending approvals"
            description="High-impact actions requiring your sign-off"
            action={<Badge variant="secondary">{pendingApprovals}</Badge>}
          >
            <ApprovalsPanel />
          </SectionCard>
        </Reveal>

        <Reveal delay={0.08}>
          <SectionCard
            id="leave"
            title="Leave requests"
            description="From your teaching staff"
            action={<Badge variant="secondary">{leaveRequests.filter((l) => l.status === "pending").length} pending</Badge>}
          >
            <ul className="space-y-3">
              {leaveRequests.map((l) => (
                <li key={l.id} className="rounded-xl border border-slate-100 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{l.teacher}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {l.type} · {l.from} → {l.to}
                      </p>
                    </div>
                    {l.status === "pending" ? (
                      <div className="flex shrink-0 gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="size-8 p-0 text-rose-500 hover:text-rose-600"
                          onClick={() => decideLeave(l.id, "rejected")}
                          aria-label={`Reject ${l.teacher}`}
                        >
                          <X className="size-4" />
                        </Button>
                        <Button
                          size="sm"
                          className="size-8 bg-slate-900 p-0 text-white hover:bg-slate-800"
                          onClick={() => decideLeave(l.id, "approved")}
                          aria-label={`Approve ${l.teacher}`}
                        >
                          <Check className="size-4" />
                        </Button>
                      </div>
                    ) : (
                      <Badge
                        className={
                          l.status === "approved"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-rose-50 text-rose-700"
                        }
                      >
                        {l.status}
                      </Badge>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </SectionCard>
        </Reveal>
      </div>

      {/* Announcements + daily tasks */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Reveal>
          <SectionCard
            id="announcements"
            title="Department announcements"
            description="Latest from the institution"
          >
            <ul className="space-y-3">
              {ANNOUNCEMENTS.map((a) => (
                <li key={a.id} className="rounded-xl border border-slate-100 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">{a.title}</p>
                    <span className="shrink-0 text-[11px] text-slate-400">{a.time}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{a.body}</p>
                  <Badge variant="secondary" className="mt-2">
                    {a.audience}
                  </Badge>
                </li>
              ))}
            </ul>
          </SectionCard>
        </Reveal>

        <Reveal delay={0.08}>
          <SectionCard
            title="Personalized daily tasks"
            description="Curated for your teaching day"
            action={<Badge variant="secondary">Today</Badge>}
          >
            <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">
              {brief.isLoading
                ? "Loading your tasks…"
                : brief.data?.content ?? "Your daily tasks will appear here."}
            </p>
          </SectionCard>
        </Reveal>
      </div>

      {/* AI Teaching Assistant */}
      <Reveal className="mt-6">
        <SectionCard
          id="assistant"
          title="AI teaching assistant"
          description="Powered by Gemini · explains every answer with reasoning and evidence"
          bodyClassName="p-0"
        >
          <ExplainableChat />
        </SectionCard>
      </Reveal>
    </DashboardShell>
  );
}
