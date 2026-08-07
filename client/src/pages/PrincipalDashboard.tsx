import { useState, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExplainableChat } from "@/components/ExplainableChat";

export default function PrincipalDashboard() {
  const { user: authUser } = useAuth();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const demoUser = localStorage.getItem("demoUser");
    if (demoUser) {
      setUser(JSON.parse(demoUser));
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Principal Dashboard</h1>
          <div className="text-sm text-slate-600">
            Welcome, {user?.fullName || "Principal"}
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
                <p className="text-2xl font-bold text-red-600">5</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">Pending Approvals</p>
                <Badge className="bg-red-100 text-red-800">3</Badge>
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
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 border rounded bg-slate-50">
                <div>
                  <p className="font-semibold">Department-Wide Communication</p>
                  <p className="text-sm text-slate-600">Requires Principal approval</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline">Reject</Button>
                  <Button size="sm">Approve</Button>
                </div>
              </div>
              <div className="flex justify-between items-center p-3 border rounded bg-slate-50">
                <div>
                  <p className="font-semibold">Institutional Policy Change</p>
                  <p className="text-sm text-slate-600">Requires Principal approval</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline">Reject</Button>
                  <Button size="sm">Approve</Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
