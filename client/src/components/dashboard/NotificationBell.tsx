import { useState } from "react";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import type { Severity } from "@/lib/dashboardData";

export type NotificationItem = {
  id: number;
  type: Severity;
  title: string;
  body: string;
  time: string;
  unread: boolean;
};

const SEVERITY_DOT: Record<Severity, string> = {
  info: "bg-blue-500",
  warning: "bg-amber-500",
  critical: "bg-rose-500",
  success: "bg-emerald-500",
};

export function NotificationBell({
  notifications: seed,
}: {
  notifications: NotificationItem[];
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const listQuery = trpc.notifications.list.useQuery(undefined, {
    enabled: Boolean(user),
    retry: false,
    refetchOnWindowFocus: false,
  });
  const markAll = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => listQuery.refetch(),
  });
  const markOne = trpc.notifications.markRead.useMutation({
    onSuccess: () => listQuery.refetch(),
  });

  // Server feed wins; seeded demo data is only a fallback before it loads.
  const items: NotificationItem[] =
    listQuery.data && listQuery.data.length > 0 ? listQuery.data : seed;
  const unread = items.filter((n) => n.unread).length;
  const loading = listQuery.isLoading && Boolean(user);

  const handleMarkAllRead = () => {
    if (!user || markAll.isPending) return;
    markAll.mutate();
  };

  const handleClick = (item: NotificationItem) => {
    if (!user || !item.unread) return;
    markOne.mutate({ id: item.id });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative size-9 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          aria-label="Notifications"
        >
          <Bell className="size-4.5" />
          {loading && (
            <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center">
              <Loader2 className="size-3 animate-spin text-slate-400" />
            </span>
          )}
          {!loading && unread > 0 && (
            <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white ring-2 ring-white">
              {unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold text-slate-900">Notifications</p>
          {unread > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs text-slate-500 hover:text-slate-900"
              onClick={handleMarkAllRead}
              disabled={markAll.isPending}
            >
              {markAll.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <CheckCheck className="size-3.5" />
              )}
              Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="h-80">
          {items.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-slate-400">
              You're all caught up 🎉
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {items.map((n) => (
                <li key={n.id} className="flex gap-3 px-4 py-3 hover:bg-slate-50">
                  <span
                    className={cn(
                      "mt-1.5 size-2 shrink-0 rounded-full",
                      SEVERITY_DOT[n.type]
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => handleClick(n)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="text-sm font-medium text-slate-800">
                      {n.title}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">
                      {n.body}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400">{n.time}</p>
                  </button>
                  {n.unread && (
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-blue-500" />
                  )}
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
