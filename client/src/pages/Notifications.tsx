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
  BellRing,
  CheckCheck,
  Inbox,
  Loader2,
} from "lucide-react";

type Severity = "info" | "warning" | "critical" | "success";

type NotificationItem = {
  id: number;
  type: Severity;
  title: string;
  body: string;
  time: string;
  unread: boolean;
};

const NAV: NavItem[] = [{ id: "notifications", label: "Notifications", icon: BellRing }];

const SEVERITY_META: Record<Severity, { dot: string; badge: string; label: string }> = {
  info: { dot: "bg-blue-500", badge: "bg-blue-50 text-blue-700 ring-blue-200", label: "Info" },
  warning: { dot: "bg-amber-500", badge: "bg-amber-50 text-amber-700 ring-amber-200", label: "Warning" },
  critical: { dot: "bg-rose-500", badge: "bg-rose-50 text-rose-700 ring-rose-200", label: "Critical" },
  success: { dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 ring-emerald-200", label: "Success" },
};

export default function Notifications() {
  const { user } = useAuth({ redirectOnUnauthenticated: true, redirectPath: "/" });
  const listQuery = trpc.notifications.list.useQuery(undefined, {
    enabled: Boolean(user),
    retry: false,
    refetchOnWindowFocus: true,
  });
  const markAll = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => listQuery.refetch(),
  });
  const markOne = trpc.notifications.markRead.useMutation({
    onSuccess: () => listQuery.refetch(),
  });

  const items = listQuery.data ?? [];
  const unread = items.filter((n) => n.unread).length;

  return (
    <DashboardShell title="Notification Center" nav={NAV} notifications={items}>
      <PageHeader
        title="Stay on top of everything"
        subtitle="Attendance alerts, reminders, approvals and institution updates — curated for your role"
        actions={
          unread > 0 ? (
            <Button
              size="sm"
              className="gap-1.5 bg-slate-900 text-white hover:bg-slate-800"
              onClick={() => markAll.mutate()}
              disabled={markAll.isPending}
            >
              {markAll.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <CheckCheck className="size-3.5" />
              )}
              Mark all read
            </Button>
          ) : undefined
        }
      />

      <Reveal className="mt-6">
        <div className="mb-4 flex items-center gap-2">
          <Badge
            className={cn(
              "gap-1 px-2.5 py-1 ring-1",
              unread > 0
                ? "bg-rose-50 text-rose-700 ring-rose-200"
                : "bg-emerald-50 text-emerald-700 ring-emerald-200"
            )}
          >
            <span className={cn("size-1.5 rounded-full", unread > 0 ? "bg-rose-500" : "bg-emerald-500")} />
            {unread > 0 ? `${unread} unread` : "All caught up"}
          </Badge>
        </div>

        {listQuery.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-2xl" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="No notifications"
            description="When something needs your attention, it will show up here."
          />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <ul className="divide-y divide-slate-100">
              {items.map((n) => {
                const meta = SEVERITY_META[n.type] ?? SEVERITY_META.info;
                return (
                  <li key={n.id}>
                    <button
                      onClick={() => {
                        if (n.unread) markOne.mutate({ id: n.id });
                      }}
                      className={cn(
                        "flex w-full items-start gap-4 px-4 py-4 text-left transition-colors sm:px-5",
                        n.unread ? "bg-emerald-50/40 hover:bg-emerald-50/70" : "hover:bg-slate-50",
                        n.unread && "cursor-pointer"
                      )}
                    >
                      <span className={cn("mt-1.5 size-2.5 shrink-0 rounded-full", meta.dot)} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900">{n.title}</p>
                          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1", meta.badge)}>
                            {meta.label}
                          </span>
                          {n.unread && (
                            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                              New
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm leading-relaxed text-slate-500">{n.body}</p>
                        <p className="mt-1.5 text-[11px] text-slate-400">{n.time}</p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </Reveal>
    </DashboardShell>
  );
}
