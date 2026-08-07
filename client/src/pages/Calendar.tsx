import { useMemo, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { DashboardShell, type NavItem } from "@/components/dashboard/DashboardShell";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Reveal } from "@/components/dashboard/Reveal";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  CalendarClock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  List,
  MapPin,
  Sparkles,
  Sun,
} from "lucide-react";

type ViewMode = "day" | "week" | "month";

type CalendarEvent = {
  id: string;
  date: string;
  start: string;
  end: string;
  title: string;
  location: string;
  type: string;
  description?: string;
  source: string;
};

const NAV: NavItem[] = [{ id: "calendar", label: "My Calendar", icon: CalendarDays }];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const TYPE_STYLES: Record<string, string> = {
  class: "bg-blue-50 text-blue-700 ring-blue-200",
  exam: "bg-rose-50 text-rose-700 ring-rose-200",
  workshop: "bg-violet-50 text-violet-700 ring-violet-200",
  assignment: "bg-amber-50 text-amber-700 ring-amber-200",
  meeting: "bg-teal-50 text-teal-700 ring-teal-200",
  review: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  event: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  deadline: "bg-orange-50 text-orange-700 ring-orange-200",
};

const TYPE_DOTS: Record<string, string> = {
  class: "bg-blue-500",
  exam: "bg-rose-500",
  workshop: "bg-violet-500",
  assignment: "bg-amber-500",
  meeting: "bg-teal-500",
  review: "bg-indigo-500",
  event: "bg-emerald-500",
  deadline: "bg-orange-500",
};

function iso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export default function Calendar() {
  const { user } = useAuth({ redirectOnUnauthenticated: true, redirectPath: "/" });
  const calendarQuery = trpc.calendar.list.useQuery(undefined, {
    enabled: Boolean(user),
    retry: false,
  });

  const [view, setView] = useState<ViewMode>("month");
  const [cursor, setCursor] = useState(() => new Date());

  const events = calendarQuery.data?.events ?? [];
  const byDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const list = map.get(e.date) ?? [];
      list.push(e);
      map.set(e.date, list);
    }
    Array.from(map.values()).forEach((list) =>
      list.sort((a, b) => a.start.localeCompare(b.start))
    );
    return map;
  }, [events]);

  const todayIso = iso(new Date());
  const selectedIso = iso(cursor);

  // Month grid
  const monthCells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = addDays(first, -first.getDay());
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [cursor]);

  const weekStart = useMemo(() => {
    const d = new Date(cursor);
    d.setDate(d.getDate() - d.getDay());
    return d;
  }, [cursor]);
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const selectedEvents = byDate.get(selectedIso) ?? [];
  const weekEvents = weekDays.map((d) => byDate.get(iso(d)) ?? []);

  const move = (delta: number) => {
    if (view === "month") {
      setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1));
    } else if (view === "week") {
      setCursor(addDays(cursor, delta * 7));
    } else {
      setCursor(addDays(cursor, delta));
    }
  };

  const viewLabel =
    view === "month"
      ? `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`
      : view === "week"
        ? `${MONTHS[weekStart.getMonth()]} ${weekStart.getDate()} – ${MONTHS[addDays(weekStart, 6).getMonth()].slice(0, 3)} ${addDays(weekStart, 6).getDate()}`
        : `${MONTHS[cursor.getMonth()].slice(0, 3)} ${cursor.getDate()}, ${cursor.getFullYear()}`;

  const EventChip = ({ e, compact }: { e: CalendarEvent; compact?: boolean }) => (
    <div
      className={cn(
        "rounded-lg px-2 py-1.5 ring-1 transition-colors hover:brightness-95",
        TYPE_STYLES[e.type] ?? "bg-slate-100 text-slate-700 ring-slate-200"
      )}
      title={`${e.title} — ${e.start}-${e.end} @ ${e.location}`}
    >
      <p className="truncate text-xs font-semibold">{e.title}</p>
      {!compact && (
        <p className="mt-0.5 flex items-center gap-1 text-[11px] opacity-80">
          <Clock className="size-3" /> {e.start}
          {e.location && (
            <span className="inline-flex items-center gap-0.5">
              · <MapPin className="size-3" /> {e.location}
            </span>
          )}
        </p>
      )}
    </div>
  );

  return (
    <DashboardShell
      title="Calendar"
      nav={NAV}
      notifications={[]}
    >
      <PageHeader
        title={`${user?.fullName?.split(" ")[0] || "Your"}, here's your schedule`}
        subtitle="Classes, exams, meetings and registered events — auto-generated for your role"
        actions={
          <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1">
            {(["day", "week", "month"] as ViewMode[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-all",
                  view === v
                    ? "bg-slate-900 text-white shadow"
                    : "text-slate-500 hover:text-slate-900"
                )}
              >
                {v}
              </button>
            ))}
          </div>
        }
      />

      {/* Controls */}
      <Reveal>
        <div className="mt-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="size-9" onClick={() => move(-1)} aria-label="Previous">
              <ChevronLeft className="size-4" />
            </Button>
            <Button variant="outline" size="icon" className="size-9" onClick={() => move(1)} aria-label="Next">
              <ChevronRight className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => setCursor(new Date())}
            >
              <Sun className="size-3.5" /> Today
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <CalendarClock className="size-4 text-slate-400" />
            <p className="text-sm font-semibold text-slate-800">{viewLabel}</p>
            <Badge variant="secondary" className="ml-1 hidden sm:inline-flex">
              {events.length} events
            </Badge>
          </div>
        </div>
      </Reveal>

      {calendarQuery.isLoading ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : (
        <Reveal className="mt-4">
          {view === "month" && (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/60">
                {WEEKDAYS.map((d) => (
                  <p key={d} className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    {d}
                  </p>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {monthCells.map((day, i) => {
                  const key = iso(day);
                  const dayEvents = byDate.get(key) ?? [];
                  const inMonth = day.getMonth() === cursor.getMonth();
                  const isToday = key === todayIso;
                  return (
                    <div
                      key={key}
                      className={cn(
                        "min-h-24 border-b border-r border-slate-100 p-1.5 last:border-r-0",
                        !inMonth && "bg-slate-50/50",
                        isToday && "bg-emerald-50/50"
                      )}
                    >
                      <button
                        onClick={() => setCursor(day)}
                        className={cn(
                          "flex size-6 items-center justify-center rounded-full text-xs font-medium transition-colors",
                          isToday
                            ? "bg-emerald-500 text-white"
                            : inMonth
                              ? "text-slate-700 hover:bg-slate-100"
                              : "text-slate-300"
                        )}
                      >
                        {day.getDate()}
                      </button>
                      <div className="mt-1 space-y-1">
                        {dayEvents.slice(0, 3).map((e) => (
                          <EventChip key={e.id} e={e} compact />
                        ))}
                        {dayEvents.length > 3 && (
                          <p className="px-1 text-[10px] font-medium text-slate-400">
                            +{dayEvents.length - 3} more
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {view === "week" && (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/60">
                {weekDays.map((d, i) => {
                  const key = iso(d);
                  const isToday = key === todayIso;
                  return (
                    <button
                      key={key}
                      onClick={() => { setCursor(d); setView("day"); }}
                      className={cn(
                        "px-2 py-2 text-center transition-colors hover:bg-white",
                        i > 0 && "border-l border-slate-100"
                      )}
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        {WEEKDAYS[d.getDay()]}
                      </p>
                      <p className={cn(
                        "mx-auto mt-0.5 flex size-7 items-center justify-center rounded-full text-sm font-semibold",
                        isToday ? "bg-emerald-500 text-white" : "text-slate-700"
                      )}>
                        {d.getDate()}
                      </p>
                    </button>
                  );
                })}
              </div>
              <div className="grid grid-cols-7">
                {weekDays.map((d, i) => {
                  const key = iso(d);
                  const dayEvents = byDate.get(key) ?? [];
                  return (
                    <div
                      key={key}
                      className={cn("min-h-40 p-1.5", i > 0 && "border-l border-slate-100")}
                    >
                      <div className="space-y-1.5">
                        {dayEvents.length === 0 && (
                          <p className="px-1 pt-2 text-center text-[11px] text-slate-300">—</p>
                        )}
                        {dayEvents.slice(0, 6).map((e) => (
                          <EventChip key={e.id} e={e} />
                        ))}
                        {dayEvents.length > 6 && (
                          <p className="px-1 text-[10px] font-medium text-slate-400">
                            +{dayEvents.length - 6} more
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {view === "day" && (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-4 py-3">
                <p className="text-sm font-semibold text-slate-800">
                  {WEEKDAYS[cursor.getDay()]}, {MONTHS[cursor.getMonth()].slice(0, 3)} {cursor.getDate()}
                </p>
                <Badge variant="secondary">{selectedEvents.length} items</Badge>
              </div>
              {selectedEvents.length === 0 ? (
                <EmptyState
                  icon={List}
                  title="Nothing scheduled"
                  description="This day is free — registered events and your role schedule will appear here."
                />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {selectedEvents.map((e) => (
                    <li key={e.id} className="flex items-start gap-4 px-4 py-3.5">
                      <div className="w-24 shrink-0 text-right">
                        <p className="text-sm font-bold text-slate-800">{e.start}</p>
                        <p className="text-[11px] text-slate-400">{e.end}</p>
                      </div>
                      <span className={cn("mt-1 size-2.5 shrink-0 rounded-full", TYPE_DOTS[e.type] ?? "bg-slate-300")} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900">{e.title}</p>
                          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ring-1", TYPE_STYLES[e.type] ?? "bg-slate-100 text-slate-600 ring-slate-200")}>
                            {e.type}
                          </span>
                          {e.source === "registered" && (
                            <Badge className="gap-1 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
                              <Sparkles className="size-2.5" /> Registered
                            </Badge>
                          )}
                        </div>
                        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                          <MapPin className="size-3" /> {e.location}
                        </p>
                        {e.description && (
                          <p className="mt-1 text-xs text-slate-500">{e.description}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Reveal>
      )}
    </DashboardShell>
  );
}
