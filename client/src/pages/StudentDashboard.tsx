import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { DashboardShell, type NavItem } from "@/components/dashboard/DashboardShell";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { StatCard } from "@/components/dashboard/StatCard";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { Reveal } from "@/components/dashboard/Reveal";
import { ExplainableChat } from "@/components/ExplainableChat";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Area,
  AreaChart,
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
  Briefcase,
  CalendarClock,
  GraduationCap,
  ListChecks,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import {
  ASSIGNMENTS,
  ATTENDANCE_TREND,
  INTERNSHIP_RECOMMENDATIONS,
  PERFORMANCE,
  PLACEMENT_OPPORTUNITIES,
  STUDENT_NOTIFICATIONS,
  TIMETABLE,
} from "@/lib/dashboardData";

const NAV: NavItem[] = [
  { id: "overview", label: "Overview", icon: GraduationCap },
  { id: "assistant", label: "AI Study Assistant", icon: Sparkles },
  { id: "placements", label: "Placements & Internships", icon: Briefcase },
  { id: "deadlines", label: "Assignments & Deadlines", icon: ListChecks },
  { id: "notifications", label: "Notifications", icon: CalendarClock },
];

const TODAY = "Friday";
const MATCH_COLOR = (match: number) =>
  match >= 85 ? "#059669" : match >= 75 ? "#d97706" : "#64748b";

export default function StudentDashboard() {
  const { user: authUser } = useAuth({
    redirectOnUnauthenticated: true,
    redirectPath: "/",
  });

  const brief = trpc.brief.useQuery(undefined, {
    enabled: Boolean(authUser),
    retry: false,
  });
  const academics = trpc.dashboard.academics.useQuery(undefined, {
    enabled: Boolean(authUser),
    retry: false,
  });

  const records = academics.data ?? [];
  const avgAttendance =
    records.length > 0
      ? Math.round(
          records.reduce((sum, r) => sum + parseFloat(String(r.attendancePercent)), 0) /
            records.length
        )
      : ATTENDANCE_TREND[ATTENDANCE_TREND.length - 1].attendance;
  const goodCourses = records.filter((r) => r.standing === "good").length;
  const todaySessions = TIMETABLE.find((d) => d.day === TODAY)?.sessions ?? TIMETABLE[0].sessions;

  return (
    <DashboardShell
      title="Student Dashboard"
      nav={NAV}
      notifications={STUDENT_NOTIFICATIONS}
    >
      <PageHeader
        title={`Welcome back, ${authUser?.fullName?.split(" ")[0] || "Student"}`}
        subtitle={`${new Date().toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
        })} · Let's make today count.`}
        actions={
          <Button
            className="gap-2 bg-slate-900 text-white hover:bg-slate-800"
            onClick={() =>
              document.getElementById("assistant")?.scrollIntoView({ behavior: "smooth" })
            }
          >
            <Sparkles className="size-4" /> Ask your AI study assistant
          </Button>
        }
      />

      {/* Stats */}
      <Reveal>
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            icon={TrendingUp}
            label="Overall attendance"
            value={`${avgAttendance}%`}
            delta="+2.4%"
            accent="emerald"
            hint="Above the 75% requirement"
          />
          <StatCard
            icon={Target}
            label="CGPA"
            value="8.6"
            delta="+0.2"
            accent="violet"
          />
          <StatCard
            icon={BookOpen}
            label="Courses"
            value={`${records.length || 4}`}
            hint={`${goodCourses} in good standing`}
            accent="blue"
          />
          <StatCard
            icon={Briefcase}
            label="Open opportunities"
            value={`${PLACEMENT_OPPORTUNITIES.length}`}
            delta="2 new"
            accent="amber"
          />
        </div>
      </Reveal>

      {/* Attendance trend + timetable */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Reveal className="lg:col-span-3">
          <SectionCard
            id="overview"
            title="Attendance trend"
            description="Weekly attendance across all courses"
            action={
              <Badge variant="secondary" className="gap-1 text-emerald-700">
                <TrendingUp className="size-3" /> On track
              </Badge>
            }
          >
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={ATTENDANCE_TREND} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="attGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#059669" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#059669" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="week" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <YAxis domain={[60, 100]} tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
                    formatter={(value) => [`${value}%`, "Attendance"]}
                  />
                  <Area type="monotone" dataKey="attendance" stroke="#059669" strokeWidth={2.5} fill="url(#attGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
        </Reveal>

        <Reveal delay={0.08} className="lg:col-span-2">
          <SectionCard
            title={`Today's timetable`}
            description={TODAY}
            action={<Badge variant="secondary">{todaySessions.length} sessions</Badge>}
          >
            <ul className="space-y-3">
              {todaySessions.map((s, i) => (
                <li key={i} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                  <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-white text-xs font-bold text-slate-700 shadow-sm ring-1 ring-slate-200">
                    {s.time}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{s.course}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {s.room} · {s.instructor}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </SectionCard>
        </Reveal>
      </div>

      {/* Performance + recommendations */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Reveal>
          <SectionCard title="Academic performance" description="Your score vs. class average">
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={PERFORMANCE} margin={{ top: 4, right: 8, left: -16, bottom: 0 }} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="course" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
                    cursor={{ fill: "#f1f5f9" }}
                  />
                  <Bar dataKey="score" name="You" radius={[6, 6, 0, 0]}>
                    {PERFORMANCE.map((entry) => (
                      <Cell key={entry.course} fill={entry.score >= 75 ? "#0ea5e9" : "#f59e0b"} />
                    ))}
                  </Bar>
                  <Bar dataKey="classAvg" name="Class avg" fill="#cbd5e1" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
        </Reveal>

        <Reveal delay={0.08}>
          <SectionCard
            id="placements"
            title="AI internship recommendations"
            description="Personalized matches from your profile"
            action={
              <Button variant="outline" size="sm" className="text-xs">
                View all
              </Button>
            }
          >
            <ul className="space-y-3">
              {INTERNSHIP_RECOMMENDATIONS.map((r) => (
                <li key={r.id} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3 transition-colors hover:border-emerald-200 hover:bg-emerald-50/40">
                  <span
                    className="flex size-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
                    style={{ backgroundColor: MATCH_COLOR(r.match) }}
                  >
                    {r.match}%
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900">{r.title}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{r.why}</p>
                  </div>
                </li>
              ))}
            </ul>
          </SectionCard>
        </Reveal>
      </div>

      {/* Placements + deadlines */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Reveal>
          <SectionCard title="Placement opportunities" description="Eligibility-verified openings">
            <ul className="divide-y divide-slate-100">
              {PLACEMENT_OPPORTUNITIES.map((o) => (
                <li key={o.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{o.title}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{o.eligibility}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge
                      className={
                        o.match === "high"
                          ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                          : "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                      }
                    >
                      {o.match}
                    </Badge>
                    <span className="text-[11px] text-slate-400">{o.deadline}</span>
                  </div>
                </li>
              ))}
            </ul>
          </SectionCard>
        </Reveal>

        <Reveal delay={0.08}>
          <SectionCard
            id="deadlines"
            title="Assignments & deadlines"
            description="Everything due, at a glance"
            action={<Badge variant="secondary">{ASSIGNMENTS.filter((a) => a.status === "pending").length} pending</Badge>}
          >
            <ul className="space-y-3">
              {ASSIGNMENTS.map((a) => (
                <li key={a.id} className="rounded-xl border border-slate-100 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{a.title}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {a.course} · {a.due}
                      </p>
                    </div>
                    <Badge
                      variant="secondary"
                      className={
                        a.status === "pending"
                          ? "bg-amber-50 text-amber-700"
                          : a.status === "in-review"
                            ? "bg-blue-50 text-blue-700"
                            : "bg-emerald-50 text-emerald-700"
                      }
                    >
                      {a.status === "pending" ? "Due" : a.status === "in-review" ? "In review" : "Done"}
                    </Badge>
                  </div>
                  {a.status === "pending" && (
                    <div className="mt-2.5 flex items-center gap-2">
                      <Progress value={a.progress} className="h-1.5" />
                      <span className="text-[11px] text-slate-400">{a.progress}%</span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </SectionCard>
        </Reveal>
      </div>

      {/* Brief + notifications */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Reveal>
          <SectionCard
            title="Personalized daily brief"
            description="Curated for your role"
            action={<Badge variant="secondary">Today</Badge>}
          >
            <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">
              {brief.isLoading
                ? "Loading your brief…"
                : brief.data?.content ?? "Welcome! Your daily brief will appear here."}
            </p>
          </SectionCard>
        </Reveal>

        <Reveal delay={0.08}>
          <SectionCard
            id="notifications"
            title="Notifications"
            description="Recent activity"
            action={
              <Button variant="ghost" size="sm" className="text-xs text-slate-500">
                See all
              </Button>
            }
          >
            <ul className="space-y-2.5">
              {STUDENT_NOTIFICATIONS.map((n) => (
                <li key={n.id} className="flex items-start gap-3 rounded-xl border border-slate-100 p-3">
                  <span
                    className={
                      n.type === "success"
                        ? "mt-1 size-2 shrink-0 rounded-full bg-emerald-500"
                        : n.type === "warning"
                          ? "mt-1 size-2 shrink-0 rounded-full bg-amber-500"
                          : "mt-1 size-2 shrink-0 rounded-full bg-blue-500"
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800">{n.title}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{n.body}</p>
                  </div>
                  <span className="shrink-0 text-[11px] text-slate-400">{n.time}</span>
                </li>
              ))}
            </ul>
          </SectionCard>
        </Reveal>
      </div>

      {/* AI Study Assistant */}
      <Reveal className="mt-6">
        <SectionCard
          id="assistant"
          title="AI study assistant"
          description="Powered by Gemini · explains every answer with reasoning and evidence"
          bodyClassName="p-0"
        >
          <ExplainableChat />
        </SectionCard>
      </Reveal>
    </DashboardShell>
  );
}
