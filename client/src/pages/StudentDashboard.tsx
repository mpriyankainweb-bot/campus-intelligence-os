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
  FileCheck2,
  GraduationCap,
  ListChecks,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  Users2,
  Wallet,
} from "lucide-react";
import {
  ASSIGNMENTS,
  ATTENDANCE_TREND,
  CLUB_RECOMMENDATIONS,
  FEE_STATUS,
  INTERNAL_MARKS,
  INTERNSHIP_RECOMMENDATIONS,
  PERFORMANCE,
  PLACEMENT_OPPORTUNITIES,
  RESUME_SCORE,
  SCHOLARSHIP_STATUS,
  SEMESTER_PROGRESS,
  STUDENT_NOTIFICATIONS,
  TIMETABLE,
  UPCOMING_EXAMS,
  WORKSHOPS,
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

      {/* Exams, internal marks, semester progress */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Reveal className="lg:col-span-3">
          <SectionCard
            title="Upcoming exams & internal marks"
            description="What's on the academic calendar"
            action={<Badge variant="secondary">{UPCOMING_EXAMS.length} exams</Badge>}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Exams</p>
                <ul className="space-y-2">
                  {UPCOMING_EXAMS.map((e) => (
                    <li key={e.id} className="rounded-xl border border-slate-100 bg-slate-50/50 p-2.5">
                      <p className="text-xs font-semibold text-slate-800">{e.title}</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {e.date} · {e.time} · {e.hall}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Internal marks</p>
                <ul className="space-y-2.5">
                  {INTERNAL_MARKS.map((m) => (
                    <li key={m.course}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-700">{m.course}</span>
                        <span className="text-slate-500">
                          {m.internal}/{m.max}
                        </span>
                      </div>
                      <Progress
                        value={(m.internal / m.max) * 100}
                        className="mt-1 h-1.5"
                      />
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </SectionCard>
        </Reveal>

        <Reveal delay={0.08} className="lg:col-span-2">
          <SectionCard
            title="Semester progress & resume"
            description="Where you stand right now"
          >
            <div className="flex items-center gap-4">
              <div className="relative flex size-20 shrink-0 items-center justify-center rounded-full bg-slate-100">
                <div
                  className="absolute inset-1 rounded-full"
                  style={{
                    background: `conic-gradient(#059669 ${RESUME_SCORE * 3.6}deg, #e2e8f0 0deg)`,
                  }}
                />
                <div className="flex size-16 items-center justify-center rounded-full bg-white">
                  <span className="text-lg font-bold text-slate-900">{RESUME_SCORE}</span>
                </div>
              </div>
              <div>
                <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                  <FileCheck2 className="size-4 text-blue-500" /> Resume score
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {RESUME_SCORE >= 80
                    ? "Strong — placement-cell ready. Add project metrics to push higher."
                    : "Good start — add project details and internship experience to reach 85+."}
                </p>
              </div>
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-700">
                  {SEMESTER_PROGRESS.semester} progress
                </span>
                <span className="text-slate-500">
                  {SEMESTER_PROGRESS.weeksCompleted}/{SEMESTER_PROGRESS.totalWeeks} weeks
                </span>
              </div>
              <Progress
                value={(SEMESTER_PROGRESS.weeksCompleted / SEMESTER_PROGRESS.totalWeeks) * 100}
                className="mt-2 h-2"
              />
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
                  <Wallet className="size-3.5" /> Fees
                </p>
                <p className="mt-1 text-sm font-bold text-slate-900">{FEE_STATUS.status}</p>
                <p className="text-[11px] text-slate-500">
                  {FEE_STATUS.paid} of {FEE_STATUS.total}
                </p>
              </div>
              <div className="rounded-xl border border-violet-100 bg-violet-50/60 p-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-violet-800">
                  <Trophy className="size-3.5" /> Scholarship
                </p>
                <p className="mt-1 text-sm font-bold text-slate-900">{SCHOLARSHIP_STATUS.status}</p>
                <p className="text-[11px] text-slate-500">{SCHOLARSHIP_STATUS.amount}</p>
              </div>
            </div>
          </SectionCard>
        </Reveal>
      </div>

      {/* Clubs, workshops, scholarships */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Reveal>
          <SectionCard
            title="Club recommendations"
            description="Clubs matched to your interests"
            action={
              <Badge className="gap-1 bg-violet-50 text-violet-700 ring-1 ring-violet-200">
                <Sparkles className="size-3" /> AI matches
              </Badge>
            }
          >
            <ul className="space-y-3">
              {CLUB_RECOMMENDATIONS.map((c) => (
                <li key={c.id} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3 transition-colors hover:border-violet-200 hover:bg-violet-50/40">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600">
                    <Users2 className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900">{c.name}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{c.why}</p>
                  </div>
                  <Badge variant="secondary">{c.match}</Badge>
                </li>
              ))}
            </ul>
          </SectionCard>
        </Reveal>

        <Reveal delay={0.08}>
          <SectionCard
            title="Workshops & scholarships"
            description="Opportunities to grow and fund your journey"
          >
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Workshops</p>
            <ul className="space-y-2">
              {WORKSHOPS.map((w) => (
                <li key={w.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-slate-800">{w.title}</p>
                    <p className="text-[11px] text-slate-500">{w.date}</p>
                  </div>
                  <Badge
                    variant="secondary"
                    className={
                      w.status === "Open"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-amber-50 text-amber-700"
                    }
                  >
                    {w.status}
                  </Badge>
                </li>
              ))}
            </ul>
            <div className="mt-4 rounded-xl border border-violet-100 bg-violet-50/50 p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-violet-900">{SCHOLARSHIP_STATUS.name}</span>
                <span className="text-violet-600">{SCHOLARSHIP_STATUS.progress}%</span>
              </div>
              <Progress value={SCHOLARSHIP_STATUS.progress} className="mt-2 h-1.5" />
              <p className="mt-2 text-[11px] text-slate-500">
                {SCHOLARSHIP_STATUS.amount} · {SCHOLARSHIP_STATUS.status}
              </p>
            </div>
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
