import { useState, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

export default function StudentDashboard() {
  const { user: authUser } = useAuth();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const demoUser = localStorage.getItem("demoUser");
    if (demoUser) {
      setUser(JSON.parse(demoUser));
    }
  }, []);
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    setMessages((prev) => [...prev, { role: "user", content: input }]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/trpc/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: input, sessionId: "demo-session" }),
      });

      if (response.ok) {
        const data = await response.json();
        setMessages((prev) => [...prev, { role: "assistant", content: data.result || "No response" }]);
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => [...prev, { role: "assistant", content: "Error sending message" }]);
    } finally {
      setLoading(false);
    }
  };

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

          <Card className="lg:col-span-2 flex flex-col h-96">
            <CardHeader>
              <CardTitle className="text-lg">AI Assistant</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <ScrollArea className="flex-1 pr-4 mb-4 border rounded p-3 bg-white">
                <div className="space-y-3">
                  {messages.length === 0 && (
                    <p className="text-sm text-slate-400 text-center py-8">
                      Start a conversation with the AI assistant
                    </p>
                  )}
                  {messages.map((msg, i) => (
                    <div
                      key={i}
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-xs px-3 py-2 rounded text-sm ${
                          msg.role === "user"
                            ? "bg-blue-600 text-white"
                            : "bg-slate-200 text-slate-900"
                        }`}
                      >
                        {msg.content}
                      </div>
                    </div>
                  ))}
                  {loading && (
                    <div className="flex justify-start">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  )}
                </div>
              </ScrollArea>

              <div className="flex gap-2">
                <Input
                  placeholder="Ask me anything..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                  disabled={loading}
                />
                <Button onClick={handleSendMessage} disabled={loading || !input.trim()}>
                  Send
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
