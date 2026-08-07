import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { DashboardShell, type NavItem } from "@/components/dashboard/DashboardShell";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { StatCard } from "@/components/dashboard/StatCard";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { Reveal } from "@/components/dashboard/Reveal";
import { ApprovalsPanel } from "@/components/dashboard/ApprovalsPanel";
import { ExplainableChat } from "@/components/ExplainableChat";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  BarChart3,
  Building2,
  FileWarning,
  GraduationCap,
  Landmark,
  Lightbulb,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import {
  AI_RECOMMENDATIONS,
  ALERTS,
  BUDGET_OVERVIEW,
  DEPT_ATTENDANCE,
  FACULTY_PERFORMANCE,
  GRIEVANCES,
  INTERNSHIP_STATS,
  PLACEMENT_STATS,
  PRINCIPAL_NOTIFICATIONS,
  STUDENT_INSIGHTS,
  type Severity,
} from "@/lib/dashboardData";

const NAV: NavItem[] = [
  { id: "overview", label: "Overview", icon: Landmark },
  { id: "analytics", label: "Institution Analytics", icon: BarChart3 },
  { id: "faculty", label: "Faculty Metrics", icon: Users },
  { id: "placement", label: "Placements & Internships", icon: TrendingUp },
  { id: "recommendations", label: "AI Recommendations", icon: Lightbulb },
  { id: "approvals", label: "Pending Approvals", icon: ShieldCheck },
  { id: "alerts", label: "Important Alerts", icon: AlertTriangle },
  { id: "advisor", label: "AI Institutional Advisor", icon: Sparkles },
];

const INSIGHT_TONE: Record<Severity, string> = {
  success: "border-emerald-200 bg-emerald-50/60",
  warning: "border-amber-200 bg-amber-50/60",
  critical: "border-rose-200 bg-rose-50/60",
  info: "border-blue-200 bg-blue-50/60",
};

const ALERT_TONE: Record<Severity, string> = {
  critical: "bg-rose-50 text-rose-700 ring-rose-200",
  warning: "bg-amber-50 text-amber-700 ring-amber-200",
  info: "bg-blue-50 text-blue-700 ring-blue-200",
  success: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

const INTERNSHIP_COLORS = ["#0ea5e9", "#059669", "#8b5cf6", "#f59e0b"];

export default function PrincipalDashboard() {
  const { user: authUser } = useAuth({
    redirectOnUnauthenticated: true,
    redirectPath: "/",
  });
  const brief = trpc.brief.useQuery(undefined, { enabled: Boolean(authUser), retry: false });
  const actionsQuery = trpc.actions.useQuery(undefined, { enabled: Boolean(authUser), retry: false });
  const pendingApprovals = actionsQuery.data?.length ?? 0;
  const placementRate = PLACEMENT_STATS[PLACEMENT_STATS.length - 1].placed;

  return (
    <DashboardShell
      title="Principal Dashboard"
      nav={NAV}
      notifications={PRINCIPAL_NOTIFICATIONS}
    >
      <PageHeader
        title={`Executive view, ${authUser?.fullName?.split(" ")[0] || "Principal"}`}
        subtitle={`${new Date().toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
        })} · Institution-wide oversight`}
      />

      {/* Stats */}
      <Reveal>
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard icon={GraduationCap} label="Total students" value="1,280" delta="+4.2%" accent="blue" />
          <StatCard icon={Building2} label="Departments" value="5" hint="CSE · ECE · ME · CE · MBA" accent="violet" />
          <StatCard icon={ShieldCheck} label="Pending approvals" value={`${pendingApprovals}`} accent="amber" hint="High-impact actions" />
          <StatCard icon={TrendingUp} label="Placement rate" value={`${placementRate}%`} delta="+6 pts" accent="emerald" hint="Class of 2026" />
        </div>
      </Reveal>

      {/* Analytics */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Reveal className="lg:col-span-3">
          <SectionCard
            id="analytics"
            title="Attendance statistics across departments"
            description="Average attendance by department"
            action={<Badge variant="secondary">{DEPT_ATTENDANCE.length} departments</Badge>}
          >
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={DEPT_ATTENDANCE} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="department" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
                    cursor={{ fill: "#f1f5f9" }}
                    formatter={(value, _name, props) => [`${value}%`, `${props.payload.department} attendance`]}
                  />
                  <Bar dataKey="attendance" radius={[6, 6, 0, 0]}>
                    {DEPT_ATTENDANCE.map((d) => (
                      <Cell
                        key={d.department}
                        fill={d.attendance >= 80 ? "#059669" : d.attendance >= 75 ? "#f59e0b" : "#ef4444"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
        </Reveal>

        <Reveal delay={0.08} className="lg:col-span-2">
          <SectionCard title="Student performance insights" description="AI-flagged trends">
            <ul className="space-y-3">
              {STUDENT_INSIGHTS.map((s) => (
                <li key={s.id} className={`rounded-xl border p-3 ${INSIGHT_TONE[s.severity]}`}>
                  <p className="text-sm font-semibold text-slate-900">{s.title}</p>
                  <p className="mt-1 text-xs text-slate-600">{s.body}</p>
                </li>
              ))}
            </ul>
          </SectionCard>
        </Reveal>
      </div>

      {/* Faculty + placement */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Reveal>
          <SectionCard
            id="faculty"
            title="Faculty performance metrics"
            description="Teaching load and student ratings"
            action={<Badge variant="secondary">Top rated: 4.8</Badge>}
          >
            <ul className="divide-y divide-slate-100">
              {FACULTY_PERFORMANCE.map((f) => (
                <li key={f.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900">{f.faculty}</p>
                    <p className="text-xs text-slate-500">
                      {f.dept} · {f.courses} courses
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <span
                          key={star}
                          className={`text-sm ${star <= Math.round(f.rating) ? "text-amber-400" : "text-slate-200"}`}
                        >
                          ★
                        </span>
                      ))}
                    </div>
                    <span className="text-sm font-bold text-slate-800">{f.rating}</span>
                  </div>
                </li>
              ))}
            </ul>
          </SectionCard>
        </Reveal>

        <Reveal delay={0.08}>
          <SectionCard
            id="placement"
            title="Placement statistics"
            description="Placed students over the last 4 years (%)"
            action={<Badge variant="secondary">Class of 2026</Badge>}
          >
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={PLACEMENT_STATS} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="plcGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#059669" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#059669" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="year" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
                    formatter={(value) => [`${value}%`, "Placed"]}
                  />
                  <Area type="monotone" dataKey="placed" stroke="#059669" strokeWidth={2.5} fill="url(#plcGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
        </Reveal>
      </div>

      {/* Internship stats + AI recommendations */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Reveal className="lg:col-span-2">
          <SectionCard title="Internship statistics" description="Distribution by type">
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={INTERNSHIP_STATS}
                    dataKey="count"
                    nameKey="type"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={3}
                    strokeWidth={2}
                  >
                    {INTERNSHIP_STATS.map((entry, i) => (
                      <Cell key={entry.type} fill={INTERNSHIP_COLORS[i % INTERNSHIP_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="mt-2 grid grid-cols-2 gap-2">
              {INTERNSHIP_STATS.map((s, i) => (
                <li key={s.type} className="flex items-center gap-2 text-xs text-slate-600">
                  <span className="size-2.5 rounded-sm" style={{ backgroundColor: INTERNSHIP_COLORS[i % INTERNSHIP_COLORS.length] }} />
                  {s.type} · {s.count}
                </li>
              ))}
            </ul>
          </SectionCard>
        </Reveal>

        <Reveal delay={0.08} className="lg:col-span-3">
          <SectionCard
            id="recommendations"
            title="AI-generated institutional recommendations"
            description="Gemini-driven suggestions for the institution"
            action={
              <Badge className="gap-1 bg-violet-50 text-violet-700 ring-1 ring-violet-200">
                <Sparkles className="size-3" /> AI
              </Badge>
            }
          >
            <ul className="space-y-3">
              {AI_RECOMMENDATIONS.map((r) => (
                <li key={r.id} className="flex items-start gap-3 rounded-xl border border-slate-100 p-3 transition-colors hover:border-violet-200 hover:bg-violet-50/40">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600">
                    <Lightbulb className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">{r.title}</p>
                      <Badge
                        variant="secondary"
                        className={
                          r.impact === "High"
                            ? "bg-rose-50 text-rose-700"
                            : "bg-amber-50 text-amber-700"
                        }
                      >
                        {r.impact} impact
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{r.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </SectionCard>
        </Reveal>
      </div>

      {/* Approvals + alerts */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Reveal>
          <SectionCard
            id="approvals"
            title="High-impact actions pending approval"
            description="Your decision gates execution"
            action={<Badge variant="secondary">{pendingApprovals}</Badge>}
          >
            <ApprovalsPanel />
          </SectionCard>
        </Reveal>

        <Reveal delay={0.08}>
          <SectionCard
            id="alerts"
            title="Important alerts"
            description="Items that need your attention"
            action={<Badge variant="secondary">{ALERTS.filter((a) => a.severity === "critical").length} critical</Badge>}
          >
            <ul className="space-y-3">
              {ALERTS.map((a) => (
                <li key={a.id} className="flex items-start gap-3 rounded-xl border border-slate-100 p-3">
                  <Badge className={ALERT_TONE[a.severity]}>{a.severity}</Badge>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900">{a.title}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{a.body}</p>
                    <p className="mt-1 text-[11px] text-slate-400">{a.time}</p>
                  </div>
                </li>
              ))}
            </ul>
          </SectionCard>
        </Reveal>
      </div>

      {/* Grievances + budget */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Reveal>
          <SectionCard
            title="Student grievances"
            description="Open cases awaiting resolution"
            action={
              <Badge variant="secondary">
                {GRIEVANCES.filter((g) => g.status === "pending").length} pending
              </Badge>
            }
          >
            <ul className="space-y-3">
              {GRIEVANCES.map((g) => (
                <li
                  key={g.id}
                  className="flex items-center gap-3 rounded-xl border border-slate-100 p-3 transition-colors hover:border-amber-200 hover:bg-amber-50/30"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
                    <FileWarning className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900">{g.student}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{g.category}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge
                      className={
                        g.status === "pending"
                          ? "bg-amber-50 text-amber-700"
                          : "bg-emerald-50 text-emerald-700"
                      }
                    >
                      {g.status}
                    </Badge>
                    <span className="text-[11px] text-slate-400">{g.age}</span>
                  </div>
                </li>
              ))}
            </ul>
          </SectionCard>
        </Reveal>

        <Reveal delay={0.08}>
          <SectionCard
            title="Budget & administration"
            description="FY 2026-27 allocation vs. spend"
            action={
              <Badge className="gap-1 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
                <Wallet className="size-3" /> ₹1.2 Cr total
              </Badge>
            }
          >
            <ul className="space-y-4">
              {BUDGET_OVERVIEW.map((b) => {
                const pct = Math.round((b.spent / b.allocated) * 100);
                return (
                  <li key={b.category}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700">{b.category}</span>
                      <span className="text-slate-500">
                        {b.spent} / {b.allocated} {b.unit} · {pct}%
                      </span>
                    </div>
                    <Progress
                      value={pct}
                      className={`mt-1.5 h-2 ${pct > 80 ? "bg-rose-100" : pct > 60 ? "bg-amber-100" : "bg-emerald-100"}`}
                    />
                  </li>
                );
              })}
            </ul>
            <p className="mt-4 rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-xs leading-relaxed text-slate-500">
              Overall utilization is <span className="font-semibold text-slate-700">62%</span> —
              reallocate surplus from Infrastructure toward the proposed AI research lab
              before the Q3 review.
            </p>
          </SectionCard>
        </Reveal>
      </div>

      {/* Executive brief */}
      <Reveal className="mt-6">
        <SectionCard
          id="overview"
          title="Personalized executive brief"
          description="Curated for the principal's office"
          action={<Badge variant="secondary">Today</Badge>}
        >
          <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">
            {brief.isLoading ? "Loading your brief…" : brief.data?.content ?? "Your executive brief will appear here."}
          </p>
        </SectionCard>
      </Reveal>

      {/* AI Advisor */}
      <Reveal className="mt-6">
        <SectionCard
          id="advisor"
          title="AI institutional advisor"
          description="Powered by Gemini · explains every answer with reasoning and evidence"
          bodyClassName="p-0"
        >
          <ExplainableChat />
        </SectionCard>
      </Reveal>
    </DashboardShell>
  );
}
