import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Loader2, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

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
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const chatMutation = trpc.chat.useMutation();

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || chatMutation.isPending) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: "user",
      content: trimmed,
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    try {
      // The chat procedure runs the multi-agent orchestrator (Gemini-backed)
      // and returns the explainable answer envelope.
      const sessionId = user?.openId ? `session-${user.openId}` : "demo-session";
      const data = await chatMutation.mutateAsync({ query: trimmed, sessionId });

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
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          type: "assistant",
          content:
            "Failed to reach the AI assistant. Please make sure you're signed in, then try again.",
          confidence: 0,
        },
      ]);
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
                  <p className="text-sm font-medium whitespace-pre-wrap">{message.content}</p>

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
            {chatMutation.isPending && (
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
            onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
            disabled={chatMutation.isPending}
            className="flex-1"
          />
          <Button onClick={handleSendMessage} disabled={chatMutation.isPending || !input.trim()}>
            {chatMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Send"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
