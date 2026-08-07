import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Loader2, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface Message {
  id: string;
  type: "user" | "assistant";
  content: string;
  reasoning?: string;
  evidence?: Array<{ source: string; doc_id?: number; section?: string; content: string }>;
  confidence?: number;
  rejected_alternatives?: string[];
}

export function ExplainableChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: "user",
      content: input,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/trpc/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: input,
          sessionId: "demo-session",
        }),
      });

      if (response.ok) {
        const data = await response.json();
        
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          type: "assistant",
          content: data.result || "No response generated",
          reasoning: data.reasoning || "",
          evidence: data.evidence || [],
          confidence: data.confidence !== undefined ? data.confidence : 0.5,
          rejected_alternatives: data.rejected_alternatives || [],
        };

        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          type: "assistant",
          content: "Error communicating with the AI assistant",
          confidence: 0,
        };
        setMessages((prev) => [...prev, errorMessage]);
      }
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: "assistant",
        content: "Failed to send message. Please try again.",
        confidence: 0,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="flex flex-col h-full">
      <CardHeader>
        <CardTitle className="text-lg">AI Assistant</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col overflow-hidden">
        <ScrollArea className="flex-1 pr-4 mb-4 border rounded p-3 bg-white">
          <div className="space-y-4">
            {messages.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-8">
                Start a conversation with the AI assistant
              </p>
            )}
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.type === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-md px-4 py-3 rounded-lg ${
                    message.type === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-900"
                  }`}
                >
                  <p className="text-sm font-medium">{message.content}</p>

                  {message.type === "assistant" && message.reasoning && (
                    <Collapsible className="mt-3 border-t pt-2">
                      <CollapsibleTrigger className="text-xs font-semibold text-slate-600 flex items-center gap-1 hover:text-slate-800">
                        <ChevronDown className="h-3 w-3" />
                        Reasoning
                      </CollapsibleTrigger>
                      <CollapsibleContent className="text-xs text-slate-600 mt-2 bg-slate-50 p-2 rounded">
                        {message.reasoning}
                      </CollapsibleContent>
                    </Collapsible>
                  )}

                  {message.type === "assistant" && message.evidence && message.evidence.length > 0 && (
                    <Collapsible className="mt-2 border-t pt-2">
                      <CollapsibleTrigger className="text-xs font-semibold text-slate-600 flex items-center gap-1 hover:text-slate-800">
                        <ChevronDown className="h-3 w-3" />
                        Evidence ({message.evidence.length})
                      </CollapsibleTrigger>
                      <CollapsibleContent className="text-xs text-slate-600 mt-2 space-y-2">
                        {message.evidence.map((e, i) => (
                          <div key={i} className="bg-slate-50 p-2 rounded border-l-2 border-blue-400">
                            <p className="font-semibold text-slate-700">{e.source}</p>
                            {e.doc_id && <p className="text-xs text-slate-500">Doc #{e.doc_id}</p>}
                            {e.section && <p className="text-xs text-slate-500">Section: {e.section}</p>}
                            <p className="text-xs line-clamp-2 mt-1">{e.content}</p>
                          </div>
                        ))}
                      </CollapsibleContent>
                    </Collapsible>
                  )}

                  {message.type === "assistant" && message.confidence !== undefined && (
                    <div className="mt-2 flex items-center gap-2 border-t pt-2">
                      <span className="text-xs font-semibold text-slate-600">Confidence:</span>
                      <Badge
                        variant={message.confidence > 0.7 ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {(message.confidence * 100).toFixed(0)}%
                      </Badge>
                    </div>
                  )}

                  {message.type === "assistant" &&
                    message.rejected_alternatives &&
                    message.rejected_alternatives.length > 0 && (
                      <Collapsible className="mt-2 border-t pt-2">
                        <CollapsibleTrigger className="text-xs font-semibold text-slate-600 flex items-center gap-1 hover:text-slate-800">
                          <ChevronDown className="h-3 w-3" />
                          Alternatives Considered
                        </CollapsibleTrigger>
                        <CollapsibleContent className="text-xs text-slate-600 mt-2 space-y-1 bg-slate-50 p-2 rounded">
                          {message.rejected_alternatives.map((alt, i) => (
                            <p key={i} className="text-xs">
                              • {alt}
                            </p>
                          ))}
                        </CollapsibleContent>
                      </Collapsible>
                    )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-slate-100 px-4 py-3 rounded-lg">
                  <Loader2 className="h-4 w-4 animate-spin text-slate-600" />
                </div>
              </div>
            )}
            <div ref={scrollRef} />
          </div>
        </ScrollArea>

        <div className="flex gap-2">
          <Input
            placeholder="Ask me anything..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
            disabled={loading}
            className="flex-1"
          />
          <Button onClick={handleSendMessage} disabled={loading || !input.trim()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
