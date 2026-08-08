import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Brain,
  BookOpen,
  Briefcase,
  CalendarDays,
  GraduationCap,
  Bell,
  Loader2,
  Send,
  ChevronDown,
  CheckCircle2,
  XCircle,
  Sparkles,
  Wrench,
  AlertTriangle,
  User,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { Streamdown } from "streamdown";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

// ---------------------------------------------------------------------------
// Types (mirror the server orchestrator output)
// ---------------------------------------------------------------------------

type WorkflowStatus = "done" | "failed" | "running";

interface ToolCallResult {
  name: string;
  args: string;
  result: string;
  ok: boolean;
}

interface WorkflowStep {
  id: string;
  agent: string;
  label: string;
  status: WorkflowStatus;
  message: string;
  detail?: string;
  durationMs?: number;
  tools?: ToolCallResult[];
}

interface ActionSummary {
  kind: string;
  title: string;
  detail: string;
  requiresApproval?: boolean;
}

interface AgentSummary {
  understood: string;
  agents: string[];
  findings: string;
  actions: string[];
  sources: string[];
  pendingApprovals: string[];
}

interface Evidence {
  source: string;
  content: string;
  doc_id?: number;
  section?: string;
}

interface MemoryView {
  summary: string;
  previousRequests: string[];
}

interface ChatResult {
  result: string;
  reasoning?: string;
  confidence?: number;
  evidence?: Evidence[];
  rejected_alternatives?: string[];
  workflow?: WorkflowStep[];
  actions?: ActionSummary[];
  sources?: Evidence[];
  summary?: AgentSummary;
  memory?: MemoryView;
}

interface Message {
  id: string;
  type: "user" | "assistant";
  content: string;
  workflow?: WorkflowStep[];
  actions?: ActionSummary[];
  sources?: Evidence[];
  summary?: AgentSummary;
  memory?: MemoryView;
  reasoning?: string;
  confidence?: number;
  rejected_alternatives?: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clampDuration(ms: number | undefined): number {
  if (!ms || Number.isNaN(ms) || ms <= 0) return 500;
  return Math.min(1400, Math.max(350, ms));
}

const AGENT_ICONS: Record<string, React.ReactNode> = {
  orchestrator: <Brain className="size-3.5" />,
  knowledge: <BookOpen className="size-3.5" />,
  career: <Briefcase className="size-3.5" />,
  placement: <Briefcase className="size-3.5" />,
  events: <CalendarDays className="size-3.5" />,
  academic: <GraduationCap className="size-3.5" />,
  support: <GraduationCap className="size-3.5" />,
  calendar: <CalendarDays className="size-3.5" />,
  communication: <Bell className="size-3.5" />,
  action: <Bell className="size-3.5" />,
};

const AGENT_COLORS: Record<string, string> = {
  orchestrator: "bg-violet-100 text-violet-700 border-violet-200",
  knowledge: "bg-amber-100 text-amber-700 border-amber-200",
  career: "bg-sky-100 text-sky-700 border-sky-200",
  placement: "bg-sky-100 text-sky-700 border-sky-200",
  events: "bg-emerald-100 text-emerald-700 border-emerald-200",
  academic: "bg-rose-100 text-rose-700 border-rose-200",
  support: "bg-rose-100 text-rose-700 border-rose-200",
  calendar: "bg-emerald-100 text-emerald-700 border-emerald-200",
  communication: "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200",
  action: "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200",
};

const DEMO_PROMPTS = [
  "I'm a 3rd year CSE student. Check whether I'm eligible for the Google internship, find a relevant upcoming workshop, register me for it, add it to my calendar and remind me one hour before.",
  "What campus rules apply to attendance shortage and what should I do?",
  "Find internships suitable for me based on my profile and recommend the best three.",
];

// ---------------------------------------------------------------------------
// Workflow timeline with reveal animation
// ---------------------------------------------------------------------------

function WorkflowTimeline({
  steps,
  animate,
  onComplete,
}: {
  steps: WorkflowStep[];
  animate: boolean;
  onComplete?: () => void;
}) {
  const [visible, setVisible] = useState(animate ? 0 : steps.length);

  useEffect(() => {
    if (!animate) {
      setVisible(steps.length);
      onComplete?.();
      return;
    }
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const revealNext = (index: number) => {
      if (cancelled) return;
      setVisible(index);
      if (index >= steps.length) {
        onComplete?.();
        return;
      }
      timers.push(setTimeout(() => revealNext(index + 1), clampDuration(steps[index].durationMs)));
    };
    timers.push(setTimeout(() => revealNext(1), clampDuration(steps[0]?.durationMs)));
    return () => {
      cancelled = true;
      timers.forEach((t) => clearTimeout(t));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animate, steps]);

  const shown = steps.slice(0, visible);

  return (
    <div className="space-y-1.5">
      {shown.map((step) => {
        const Icon = AGENT_ICONS[step.agent] ?? <Sparkles className="size-3.5" />;
        const color = AGENT_COLORS[step.agent] ?? "bg-slate-100 text-slate-700 border-slate-200";
        return (
          <div key={step.id} className="flex items-start gap-2 rounded-lg border bg-card px-2.5 py-2">
            <div
              className={cn(
                "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border",
                color
              )}
            >
              {Icon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="text-xs font-semibold text-foreground">{step.label}</span>
                {step.status === "failed" && (
                  <Badge variant="destructive" className="h-4 px-1.5 text-[10px]">
                    failed
                  </Badge>
                )}
              </div>
              <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                {step.status === "failed" ? "⚠ " : "✓ "}
                {step.message}
              </p>
              {step.tools && step.tools.length > 0 && (
                <div className="mt-1.5 space-y-1">
                  {step.tools.map((tool, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-1.5 rounded border bg-muted/40 px-2 py-1"
                    >
                      <Wrench className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="font-mono text-[10px] font-medium text-foreground/90">
                          {tool.name}({tool.args})
                        </p>
                        <p className="text-[10px] leading-snug text-muted-foreground">
                          {tool.ok ? "→" : "✗"} {tool.result}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {step.status === "done" && (
              <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
            )}
            {step.status === "failed" && (
              <XCircle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pending state: orchestrator working
// ---------------------------------------------------------------------------

function PendingWorkflow() {
  return (
    <div className="space-y-1.5">
      <div className="flex items-start gap-2 rounded-lg border bg-card px-2.5 py-2">
        <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-violet-200 bg-violet-100 text-violet-700">
          <Brain className="size-3.5 animate-pulse" />
        </div>
        <div className="flex-1">
          <p className="text-xs font-semibold">Orchestrator Agent</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Understanding your request…</p>
        </div>
        <Loader2 className="mt-0.5 size-3.5 animate-spin text-violet-500" />
      </div>
      <div className="flex items-start gap-2 rounded-lg border bg-card px-2.5 py-2 opacity-80">
        <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-violet-200 bg-violet-100 text-violet-700">
          <Brain className="size-3.5 animate-pulse" />
        </div>
        <div className="flex-1">
          <p className="text-xs font-semibold">Orchestrator Agent</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Planning which agents to invoke…</p>
        </div>
        <Loader2 className="mt-0.5 size-3.5 animate-spin text-violet-500" />
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-dashed bg-muted/30 px-2.5 py-2">
        <Sparkles className="size-3.5 animate-pulse text-muted-foreground" />
        <p className="text-[11px] text-muted-foreground">
          Specialized agents are working… (profile, knowledge, placement, events)
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Final answer + summary panel
// ---------------------------------------------------------------------------

function CollapsibleBlock({
  label,
  children,
  defaultOpen,
  badge,
}: {
  label: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: string;
}) {
  return (
    <Collapsible defaultOpen={defaultOpen} className="mt-2 border-t pt-2">
      <CollapsibleTrigger className="flex w-full items-center justify-between text-xs font-semibold text-muted-foreground hover:text-foreground">
        <span className="flex items-center gap-1.5">
          {badge && <Badge className="h-4 px-1.5 text-[10px]">{badge}</Badge>}
          {label}
        </span>
        <ChevronDown className="size-3.5" />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2">{children}</CollapsibleContent>
    </Collapsible>
  );
}

function SummaryPanel({ summary }: { summary: AgentSummary }) {
  return (
    <div className="mt-3 space-y-2 rounded-lg border bg-background/60 p-2.5">
      <div className="flex items-start gap-2">
        <Brain className="mt-0.5 size-3.5 shrink-0 text-violet-500" />
        <p className="text-[11px] leading-snug text-muted-foreground">
          <span className="font-semibold text-foreground">What I understood:</span>{" "}
          {summary.understood}
        </p>
      </div>

      {summary.agents.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Agents used
          </span>
          {summary.agents.map((a) => (
            <Badge key={a} variant="secondary" className="h-4.5 text-[10px]">
              {a}
            </Badge>
          ))}
        </div>
      )}

      {summary.actions.length > 0 && (
        <div className="space-y-1">
          {summary.actions.map((action) => (
            <p key={action} className="flex items-center gap-1.5 text-[11px] text-emerald-600">
              <CheckCircle2 className="size-3 shrink-0" />
              {action}
            </p>
          ))}
        </div>
      )}

      {summary.pendingApprovals.length > 0 && (
        <div className="space-y-1 rounded-md border border-amber-200 bg-amber-50 p-2 dark:border-amber-900 dark:bg-amber-950/40">
          {summary.pendingApprovals.map((p) => (
            <p key={p} className="flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-400">
              <AlertTriangle className="size-3 shrink-0" />
              {p}
            </p>
          ))}
        </div>
      )}

      {summary.sources.length > 0 && (
        <div className="space-y-1">
          {summary.sources.map((s) => (
            <p key={s} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <BookOpen className="size-3 shrink-0 text-amber-500" />
              Source: {s}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ExplainableChat() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [latestMemory, setLatestMemory] = useState<MemoryView | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const chatMutation = trpc.chat.useMutation();

  const scrollToBottom = () => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, chatMutation.isPending]);

  const handleSendMessage = async (text?: string) => {
    const trimmed = (text ?? input).trim();
    if (!trimmed || chatMutation.isPending) return;

    const userMessage: Message = { id: `u-${Date.now()}`, type: "user", content: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    try {
      const sessionId = user?.openId ? `session-${user.openId}` : "demo-session";
      const data = (await chatMutation.mutateAsync({
        query: trimmed,
        sessionId,
      })) as ChatResult;

      const assistantMessage: Message = {
        id: `a-${Date.now()}`,
        type: "assistant",
        content: data.result || "No response generated",
        workflow: data.workflow ?? [],
        actions: data.actions ?? [],
        sources: data.sources ?? [],
        summary: data.summary,
        memory: data.memory,
        reasoning: data.reasoning ?? "",
        confidence: data.confidence ?? 0.5,
        rejected_alternatives: data.rejected_alternatives ?? [],
      };
      setMessages((prev) => [...prev, assistantMessage]);
      if (data.memory) setLatestMemory(data.memory);
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          type: "assistant",
          content:
            "Failed to reach the AI assistant. Please make sure you're signed in, then try again.",
          confidence: 0,
        },
      ]);
    }
  };

  return (
    <Card className="flex h-full min-h-[540px] flex-col overflow-hidden rounded-none border-0 shadow-none">
      <CardHeader className="border-b px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="flex size-7 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
                <Brain className="size-4" />
              </span>
              AI Assistant
            </CardTitle>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Multi-agent orchestration · Gemini-powered · explainable
            </p>
          </div>
          {chatMutation.isPending && (
            <Badge variant="secondary" className="animate-pulse text-[10px]">
              orchestrating…
            </Badge>
          )}
        </div>
        {latestMemory?.summary && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Memory
            </span>
            <Badge variant="outline" className="text-[10px]">
              <Sparkles className="mr-1 size-2.5" />
              {latestMemory.summary}
            </Badge>
            {latestMemory.previousRequests.length > 1 && (
              <Badge variant="outline" className="text-[10px]">
                {latestMemory.previousRequests.length} requests this session
              </Badge>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
        <ScrollArea className="min-h-0 flex-1 px-4 py-4">
          <div className="space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-4 py-8 text-center">
                <div className="flex size-14 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
                  <Brain className="size-7" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Campus Intelligence Command Center
                  </p>
                  <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
                    One request can dispatch multiple agents — eligibility checks, policy search,
                    event registration, calendar updates and reminders — all shown live as they
                    execute.
                  </p>
                </div>
                <div className="flex w-full max-w-md flex-col gap-2">
                  {DEMO_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => handleSendMessage(prompt)}
                      disabled={chatMutation.isPending}
                      className="rounded-lg border border-border bg-card px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:border-violet-300 hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message) => {
              if (message.type === "user") {
                return (
                  <div key={message.id} className="flex justify-end">
                    <div className="flex max-w-[85%] items-start gap-2">
                      <div className="rounded-2xl rounded-br-sm bg-primary px-3.5 py-2.5 text-sm text-primary-foreground">
                        <p className="whitespace-pre-wrap">{message.content}</p>
                      </div>
                      <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary">
                        <User className="size-3.5 text-secondary-foreground" />
                      </div>
                    </div>
                  </div>
                );
              }

              const hasWorkflow = (message.workflow?.length ?? 0) > 0;
              return (
                <div key={message.id} className="flex justify-start">
                  <div className="max-w-[92%] min-w-0 flex-1">
                    {hasWorkflow && (
                      <div className="mb-2 overflow-hidden rounded-xl border bg-card p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Agent workflow
                          </p>
                          <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                            {message.workflow?.length ?? 0} steps
                          </Badge>
                        </div>
                        <WorkflowTimeline
                          steps={message.workflow ?? []}
                          animate
                          onComplete={scrollToBottom}
                        />
                      </div>
                    )}

                    <div className="rounded-2xl rounded-tl-sm border bg-muted px-3.5 py-2.5">
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <Streamdown>{message.content}</Streamdown>
                      </div>

                      {message.summary && <SummaryPanel summary={message.summary} />}

                      <div className="mt-2 flex items-center gap-2 border-t pt-2">
                        {typeof message.confidence === "number" && (
                          <Badge
                            variant={message.confidence > 0.7 ? "default" : "secondary"}
                            className="text-[10px]"
                          >
                            confidence {(message.confidence * 100).toFixed(0)}%
                          </Badge>
                        )}
                        {message.reasoning && (
                          <CollapsibleBlock label="Reasoning">
                            <p className="whitespace-pre-wrap text-xs text-muted-foreground">
                              {message.reasoning}
                            </p>
                          </CollapsibleBlock>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {chatMutation.isPending && (
              <div className="flex justify-start">
                <div className="w-full max-w-[92%]">
                  <div className="overflow-hidden rounded-xl border bg-card p-3">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Agent workflow
                    </p>
                    <PendingWorkflow />
                  </div>
                </div>
              </div>
            )}
            <div ref={scrollRef} />
          </div>
        </ScrollArea>

        <div className="flex items-center gap-2 border-t bg-background/50 p-3">
          <Input
            placeholder="Ask the campus agents… (e.g. am I eligible for the Google internship?)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
            disabled={chatMutation.isPending}
            className="flex-1"
          />
          <Button
            size="icon"
            onClick={() => handleSendMessage()}
            disabled={chatMutation.isPending || !input.trim()}
          >
            {chatMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
