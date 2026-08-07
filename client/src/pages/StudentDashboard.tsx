import { useState, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExplainableChat } from "@/components/ExplainableChat";

export default function StudentDashboard() {
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
          <h1 className="text-3xl font-bold">Student Dashboard</h1>
          <div className="text-sm text-slate-600">
            Welcome, {user?.fullName || "Student"}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg">Daily Brief</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-slate-700">Attendance</p>
                <p className="text-2xl font-bold text-blue-600">82%</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">Opportunities</p>
                <p className="text-2xl font-bold text-green-600">3</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">Status</p>
                <Badge className="bg-green-100 text-green-800">Good Standing</Badge>
              </div>
            </CardContent>
          </Card>

          <ExplainableChat />
        </div>
      </div>
    </div>
  );
}
