import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { EmptyState } from "./EmptyState";

type ActionData = {
  title?: string;
  description?: string;
  impact?: string;
  target?: string;
};

export function ApprovalsPanel() {
  const { user } = useAuth();
  const actionsQuery = trpc.actions.useQuery(undefined, {
    enabled: Boolean(user),
    retry: false,
  });
  const approve = trpc.actionsApprove.useMutation({
    onSuccess: () => actionsQuery.refetch(),
  });
  const reject = trpc.actionsReject.useMutation({
    onSuccess: () => actionsQuery.refetch(),
  });

  if (actionsQuery.isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-xl border border-slate-200 p-4">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="mt-2 h-3 w-full" />
            <Skeleton className="mt-3 h-8 w-40" />
          </div>
        ))}
      </div>
    );
  }

  const actions = actionsQuery.data ?? [];
  const busy = approve.isPending || reject.isPending;

  if (actions.length === 0) {
    return (
      <EmptyState
        icon={ShieldCheck}
        title="No pending approvals"
        description="When a high-impact action needs your sign-off, it will show up here."
      />
    );
  }

  return (
    <ul className="space-y-3">
      {actions.map((action) => {
        const data = (action.actionData ?? {}) as ActionData;
        const impact = data.impact ?? "medium";
        const impactTone =
          impact === "high"
            ? "bg-rose-50 text-rose-700 ring-rose-200"
            : impact === "medium"
              ? "bg-amber-50 text-amber-700 ring-amber-200"
              : "bg-blue-50 text-blue-700 ring-blue-200";
        return (
          <li
            key={action.id}
            className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-slate-900">
                  {data.title || action.actionType}
                </p>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${impactTone}`}
                >
                  {impact} impact
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {data.description || "Requires your approval"}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => reject.mutate({ id: action.id })}
                className="border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              >
                {reject.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  "Reject"
                )}
              </Button>
              <Button
                size="sm"
                disabled={busy}
                onClick={() => approve.mutate({ id: action.id })}
                className="bg-slate-900 text-white hover:bg-slate-800"
              >
                {approve.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  "Approve"
                )}
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
