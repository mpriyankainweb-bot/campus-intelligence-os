import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { DashboardShell, type NavItem } from "@/components/dashboard/DashboardShell";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Reveal } from "@/components/dashboard/Reveal";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  CalendarCheck2,
  CalendarPlus,
  CheckCircle2,
  Code2,
  Loader2,
  MapPin,
  Megaphone,
  Rocket,
  Ticket,
  Users,
} from "lucide-react";

type EventType =
  | "workshop"
  | "hackathon"
  | "seminar"
  | "placement_drive"
  | "webinar";

type CampusEvent = {
  id: number;
  title: string;
  type: EventType;
  date: string;
  start: string;
  end: string;
  location: string;
  description: string;
  audience: string;
  capacity: number;
  registered: number;
  isRegistered: boolean;
};

const NAV: NavItem[] = [{ id: "events", label: "Campus Events", icon: Ticket }];

const TYPE_META: Record<EventType, { icon: typeof Ticket; label: string; classes: string }> = {
  workshop: { icon: Code2, label: "Workshop", classes: "bg-violet-50 text-violet-700 ring-violet-200" },
  hackathon: { icon: Rocket, label: "Hackathon", classes: "bg-rose-50 text-rose-700 ring-rose-200" },
  seminar: { icon: Megaphone, label: "Seminar", classes: "bg-teal-50 text-teal-700 ring-teal-200" },
  placement_drive: { icon: Users, label: "Placement drive", classes: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  webinar: { icon: CalendarCheck2, label: "Webinar", classes: "bg-blue-50 text-blue-700 ring-blue-200" },
};

function formatDate(dateIso: string): string {
  const d = new Date(`${dateIso}T00:00:00`);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function Events() {
  const { user } = useAuth({ redirectOnUnauthenticated: true, redirectPath: "/" });
  const eventsQuery = trpc.events.list.useQuery(undefined, {
    enabled: Boolean(user),
    retry: false,
  });
  const register = trpc.events.register.useMutation({
    onSuccess: () => eventsQuery.refetch(),
  });
  const [busyId, setBusyId] = useState<number | null>(null);

  const events = eventsQuery.data?.events ?? [];
  const registeredCount = events.filter((e) => e.isRegistered).length;

  const handleRegister = async (event: CampusEvent) => {
    setBusyId(event.id);
    try {
      const result = await register.mutateAsync({ eventId: event.id });
      toast.success("Registered!", {
        description: `You're on the list for "${result.event.title}". It was added to your calendar.`,
        duration: 5000,
      });
    } catch (error) {
      toast.error("Registration failed", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <DashboardShell title="Campus Events" nav={NAV} notifications={[]}>
      <PageHeader
        title="Discover & register for campus events"
        subtitle="Workshops, hackathons, seminars and placement drives — registering adds them to your calendar"
        actions={
          registeredCount > 0 ? (
            <Badge className="gap-1.5 bg-emerald-50 px-3 py-1.5 text-emerald-700 ring-1 ring-emerald-200">
              <CheckCircle2 className="size-3.5" /> {registeredCount} registered
            </Badge>
          ) : undefined
        }
      />

      {eventsQuery.isLoading ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-2xl" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <Reveal className="mt-6">
          <EmptyState
            icon={Ticket}
            title="No events right now"
            description="Campus events will appear here as they're announced."
          />
        </Reveal>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event, i) => {
            const meta = TYPE_META[event.type] ?? TYPE_META.workshop;
            const Icon = meta.icon;
            const isBusy = busyId === event.id;
            const spotsLeft = Math.max(event.capacity - event.registered, 0);
            const almostFull = spotsLeft <= 15 && spotsLeft > 0;
            const full = spotsLeft === 0;
            return (
              <Reveal key={event.id} delay={Math.min(i * 0.05, 0.3)}>
                <article className="group flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-lg hover:shadow-emerald-500/5">
                  <div className="flex items-start justify-between gap-3">
                    <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl ring-1", meta.classes)}>
                      <Icon className="size-5" />
                    </span>
                    <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ring-1", meta.classes)}>
                      {meta.label}
                    </span>
                  </div>

                  <h3 className="mt-4 text-base font-semibold leading-snug text-slate-900">
                    {event.title}
                  </h3>
                  <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-slate-500">
                    {event.description}
                  </p>

                  <div className="mt-4 space-y-1.5 text-xs text-slate-500">
                    <p className="flex items-center gap-2">
                      <CalendarCheck2 className="size-3.5 text-slate-400" />
                      {formatDate(event.date)} · {event.start}–{event.end}
                    </p>
                    <p className="flex items-center gap-2">
                      <MapPin className="size-3.5 text-slate-400" />
                      {event.location}
                    </p>
                  </div>

                  <div className="mt-4">
                    {event.isRegistered ? (
                      <Button
                        disabled
                        className="w-full gap-1.5 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/10"
                      >
                        <CheckCircle2 className="size-4" /> Registered · on your calendar
                      </Button>
                    ) : (
                      <Button
                        disabled={isBusy || full}
                        onClick={() => handleRegister(event)}
                        className="w-full gap-1.5 bg-slate-900 text-white hover:bg-slate-800"
                      >
                        {isBusy ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <CalendarPlus className="size-4" />
                        )}
                        {full ? "Full" : "Register"}
                      </Button>
                    )}
                    {!full && !event.isRegistered && (
                      <p className={cn("mt-2 text-center text-[11px]", almostFull ? "font-medium text-rose-500" : "text-slate-400")}>
                        {almostFull
                          ? `Only ${spotsLeft} spots left!`
                          : `${spotsLeft} spots available`}
                      </p>
                    )}
                  </div>
                </article>
              </Reveal>
            );
          })}
        </div>
      )}
    </DashboardShell>
  );
}
