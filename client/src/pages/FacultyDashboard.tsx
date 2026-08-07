import { useState, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExplainableChat } from "@/components/ExplainableChat";

export default function FacultyDashboard() {
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
          <h1 className="text-3xl font-bold">Faculty Dashboard</h1>
          <div className="text-sm text-slate-600">
            Welcome, {user?.fullName || "Faculty"}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg">Teaching Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-slate-700">Students</p>
                <p className="text-2xl font-bold text-blue-600">45</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">Needing Intervention</p>
                <p className="text-2xl font-bold text-orange-600">3</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">Pending Approvals</p>
                <Badge className="bg-yellow-100 text-yellow-800">2</Badge>
              </div>
            </CardContent>
          </Card>

          <ExplainableChat />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Pending Approvals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 border rounded bg-slate-50">
                <div>
                  <p className="font-semibold">Communication to Department</p>
                  <p className="text-sm text-slate-600">Requires approval before sending</p>
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
