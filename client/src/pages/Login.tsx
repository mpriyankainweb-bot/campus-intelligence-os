import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export default function Login() {
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState<string | null>(null);

  const handleDemoLogin = async (persona: "student" | "faculty" | "principal") => {
    setLoading(persona);
    try {
      // Create demo session by calling a login endpoint
      const response = await fetch("/api/trpc/auth.demoLogin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ persona }),
      });

      if (response.ok) {
        // Redirect to dashboard
        setLocation(`/dashboard/${persona}`);
      }
    } catch (error) {
      console.error("Login failed:", error);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl border-slate-700 bg-slate-800">
        <CardHeader className="space-y-2">
          <CardTitle className="text-3xl text-white">Campus Intelligence OS</CardTitle>
          <CardDescription className="text-slate-300">
            Select your role to access the system
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            onClick={() => handleDemoLogin("student")}
            disabled={loading !== null}
            className="w-full h-12 text-base bg-blue-600 hover:bg-blue-700"
          >
            {loading === "student" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading === "student" ? "Logging in..." : "Login as Student"}
          </Button>

          <Button
            onClick={() => handleDemoLogin("faculty")}
            disabled={loading !== null}
            className="w-full h-12 text-base bg-green-600 hover:bg-green-700"
          >
            {loading === "faculty" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading === "faculty" ? "Logging in..." : "Login as Faculty"}
          </Button>

          <Button
            onClick={() => handleDemoLogin("principal")}
            disabled={loading !== null}
            className="w-full h-12 text-base bg-purple-600 hover:bg-purple-700"
          >
            {loading === "principal" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading === "principal" ? "Logging in..." : "Login as Principal"}
          </Button>

          <div className="pt-4 text-center text-xs text-slate-400">
            <p>Demo credentials - no password required</p>
            <p className="mt-1">Student: Ananya Rao</p>
            <p>Faculty: Dr. Vikram Shah</p>
            <p>Principal: Dr. Meera Iyer</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
