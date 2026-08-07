import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { ExplainableChat } from "@/components/ExplainableChat";
import { trpc } from "@/lib/trpc";

export default function PrincipalDashboard() {
  const { user: authUser } = useAuth({
    redirectOnUnauthenticated: true,
    redirectPath: "/",
  });

  const actionsQuery = trpc.actions.useQuery(undefined, {
    enabled: Boolean(authUser),
    retry: false,
  });
  const approveMutation = trpc.actionsApprove.useMutation({
    onSuccess: () => actionsQuery.refetch(),
  });
  const rejectMutation = trpc.actionsReject.useMutation({
    onSuccess: () => actionsQuery.refetch(),
  });

  const pendingActions = actionsQuery.data ?? [];

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Principal Dashboard</h1>
          <div className="text-sm text-slate-600">
            Welcome, {authUser?.fullName || "Principal"}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg">Executive Brief</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-slate-700">Total Students</p>
                <p className="text-2xl font-bold text-blue-600">1200</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">High-Impact Actions</p>
                <p className="text-2xl font-bold text-red-600">{pendingActions.length}</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">Pending Approvals</p>
                <Badge className="bg-red-100 text-red-800">{pendingActions.length}</Badge>
              </div>
            </CardContent>
          </Card>

          <ExplainableChat />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">High-Impact Actions Pending Approval</CardTitle>
          </CardHeader>
          <CardContent>
            {pendingActions.length === 0 ? (
              <p className="text-sm text-slate-500">
                {actionsQuery.isLoading ? "Loading approvals…" : "No high-impact actions awaiting your approval."}
              </p>
            ) : (
              <div className="space-y-3">
                {pendingActions.map((action) => {
                  const data = (action.actionData ?? {}) as {
                    title?: string;
                    description?: string;
                    impact?: string;
                  };
                  const busy =
                    approveMutation.isPending || rejectMutation.isPending;
                  return (
                    <div
                      key={action.id}
                      className="flex justify-between items-center p-3 border rounded bg-slate-50"
                    >
                      <div>
                        <p className="font-semibold">{data.title || action.actionType}</p>
                        <p className="text-sm text-slate-600">{data.description || "Requires Principal approval"}</p>
                        {data.impact && (
                          <span className="inline-block mt-1 text-[11px] font-medium uppercase tracking-wide text-red-700">
                            {data.impact} impact
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => rejectMutation.mutate({ id: action.id })}
                        >
                          {rejectMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : "Reject"}
                        </Button>
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={() => approveMutation.mutate({ id: action.id })}
                        >
                          {approveMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : "Approve"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
