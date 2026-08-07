import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import {
  isSupabaseConfigured,
  personaFromUser,
  supabase,
  PERSONA_META,
  type Persona,
} from "@/lib/supabase";
import { startLogin } from "@/const";
import { Check, GraduationCap, Landmark, Loader2, ShieldCheck, Sparkles, Users, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const PERSONAS: Persona[] = ["student", "faculty", "principal"];

const PERSONA_ICONS: Record<Persona, typeof GraduationCap> = {
  student: GraduationCap,
  faculty: Users,
  principal: Landmark,
};

const FEATURES = [
  {
    icon: Sparkles,
    title: "Explainable AI",
    description: "Every answer shows its reasoning, evidence citations and confidence — no black boxes.",
  },
  {
    icon: ShieldCheck,
    title: "Role-based access",
    description: "Student, Faculty and Principal views with persona-scoped permissions enforced server-side.",
  },
  {
    icon: Zap,
    title: "Knowledge base (RAG)",
    description: "Institutional policies are ingested and retrieved with local embeddings for grounded answers.",
  },
  {
    icon: Users,
    title: "Approval workflows",
    description: "High-impact actions are queued for approval before anything is executed.",
  },
];

function PersonaPicker({
  value,
  onChange,
}: {
  value: Persona | null;
  onChange: (persona: Persona) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-2" role="radiogroup" aria-label="Choose your role">
      {PERSONAS.map((persona) => {
        const Icon = PERSONA_ICONS[persona];
        const meta = PERSONA_META[persona];
        const selected = value === persona;
        return (
          <button
            key={persona}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(persona)}
            className={cn(
              "group flex items-center gap-3 rounded-xl border p-3 text-left transition-all duration-200",
              selected
                ? "border-emerald-400/70 bg-emerald-400/10 ring-1 ring-emerald-400/40"
                : "border-white/10 bg-white/5 hover:border-white/25 hover:bg-white/10"
            )}
          >
            <span
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors",
                selected ? "bg-emerald-400/20 text-emerald-300" : "bg-white/10 text-slate-300"
              )}
            >
              <Icon className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-white">{meta.label}</span>
              <span className="block truncate text-xs text-slate-400">{meta.description}</span>
            </span>
            <span
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-full border transition-all",
                selected ? "border-emerald-400 bg-emerald-400 text-slate-950" : "border-white/20 text-transparent"
              )}
            >
              <Check className="size-3" />
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default function Home() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const meQuery = trpc.auth.me.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });
  const demoLogin = trpc.auth.demoLogin.useMutation();
  const signup = trpc.auth.signup.useMutation();
  const localSignup = trpc.auth.localSignup.useMutation();
  const localLogin = trpc.auth.localLogin.useMutation();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [persona, setPersona] = useState<Persona | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"signin" | "signup" | null>(null);
  const [demoBusy, setDemoBusy] = useState<Persona | null>(null);

  const authenticatedUser = meQuery.data ?? null;

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setBusy("signin");
    try {
      if (!supabase) {
        // Demo mode: sign in against the in-memory local account registry.
        const result = await localLogin.mutateAsync({ email, password });
        await utils.auth.me.invalidate();
        setLocation(result.redirectTo);
        return;
      }
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setAuthError(error.message);
        return;
      }
      const userPersona = personaFromUser(data.user);
      await utils.auth.me.invalidate();
      setLocation(`/dashboard/${userPersona}`);
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : "Sign in failed. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (!persona) {
      setAuthError("Pick the role that best describes you.");
      return;
    }
    setBusy("signup");
    try {
      if (!supabase) {
        // Demo mode: create the account in-memory and sign straight in.
        const result = await localSignup.mutateAsync({ email, password, fullName, persona });
        await utils.auth.me.invalidate();
        setLocation(result.redirectTo);
        return;
      }
      await signup.mutateAsync({ email, password, fullName, persona });
      // Account was auto-confirmed server-side — sign in immediately.
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setAuthError(`Account created. ${error.message}`);
        return;
      }
      const userPersona = personaFromUser(data.user);
      await utils.auth.me.invalidate();
      setLocation(`/dashboard/${userPersona}`);
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const handleDemoLogin = async (demoPersona: Persona) => {
    setDemoBusy(demoPersona);
    setAuthError(null);
    try {
      const result = await demoLogin.mutateAsync({ persona: demoPersona });
      await utils.auth.me.invalidate();
      setLocation(result.redirectTo);
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : "Demo login failed. Is the server running?");
    } finally {
      setDemoBusy(null);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase?.auth.signOut();
    } catch {
      // ignore
    }
    utils.auth.me.setData(undefined, null);
    await utils.auth.me.invalidate();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[480px] w-[820px] -translate-x-1/2 rounded-full bg-emerald-500/15 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-[360px] w-[520px] rounded-full bg-teal-500/10 blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6">
        {/* Nav */}
        <header className="flex items-center justify-between py-6">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/30">
              <GraduationCap className="size-5" />
            </span>
            <div className="leading-tight">
              <p className="text-sm font-semibold tracking-tight text-white">Campus Intelligence OS</p>
              <p className="text-[11px] text-slate-400">AI institutional assistant</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {authenticatedUser ? (
              <>
                <span className="hidden rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 sm:block">
                  {authenticatedUser.fullName || "Signed in"}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-white/15 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
                  onClick={() =>
                    setLocation(`/dashboard/${authenticatedUser.persona || "student"}`)
                  }
                >
                  Open dashboard
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-slate-400 hover:text-white"
                  onClick={handleLogout}
                >
                  Sign out
                </Button>
              </>
            ) : (
              <a href="#auth" className="text-sm font-medium text-slate-300 transition-colors hover:text-white">
                Sign in
              </a>
            )}
          </div>
        </header>

        {/* Hero */}
        <main className="grid flex-1 items-center gap-12 py-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3.5 py-1.5 text-xs font-medium text-emerald-300">
              <Sparkles className="size-3.5" />
              Multi-agent explainable reasoning
            </div>

            <h1 className="text-4xl font-bold leading-[1.08] tracking-tight text-white sm:text-5xl">
              Your campus,
              <br />
              running on{" "}
              <span className="bg-gradient-to-r from-emerald-300 via-teal-300 to-cyan-300 bg-clip-text text-transparent">
                intelligence
              </span>
              .
            </h1>

            <p className="max-w-xl text-base leading-relaxed text-slate-400 sm:text-lg">
              Campus Intelligence OS is an institutional assistant that understands policy, tracks
              records, and explains every decision. Students, faculty and principals each get an
              assistant shaped to their role.
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              {FEATURES.map((feature) => (
                <div
                  key={feature.title}
                  className="group rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition-all duration-200 hover:border-emerald-400/30 hover:bg-white/[0.06]"
                >
                  <feature.icon className="size-5 text-emerald-300 transition-transform duration-200 group-hover:scale-110" />
                  <p className="mt-3 text-sm font-semibold text-white">{feature.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-400">{feature.description}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
              {[
                ["6", "orchestration stages"],
                ["5", "intelligence modules"],
                ["3", "role dashboards"],
              ].map(([stat, label]) => (
                <div key={label} className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-white">{stat}</span>
                  <span className="text-xs text-slate-400">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Auth card */}
          <div id="auth" className="scroll-mt-8">
            <Card className="w-full border-white/10 bg-slate-900/70 shadow-2xl shadow-black/40 backdrop-blur-xl">
              <CardContent className="p-6 sm:p-8">
                <div className="mb-6 flex rounded-xl border border-white/10 bg-white/5 p-1">
                  {(["signin", "signup"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => {
                        setMode(m);
                        setAuthError(null);
                      }}
                      className={cn(
                        "flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200",
                        mode === m
                          ? "bg-emerald-400 text-slate-950 shadow"
                          : "text-slate-400 hover:text-white"
                      )}
                    >
                      {m === "signin" ? "Sign in" : "Create account"}
                    </button>
                  ))}
                </div>

                {!isSupabaseConfigured && (
                  <div className="mb-5 rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-xs leading-relaxed text-amber-200">
                    Supabase keys aren't set — accounts are stored in this session (built-in demo mode).
                    Add <code className="font-mono">VITE_SUPABASE_URL</code> and{" "}
                    <code className="font-mono">VITE_SUPABASE_ANON_KEY</code> in the Keys tab to enable
                    persistent cloud accounts. Demo personas work right away.
                  </div>
                )}

                {mode === "signin" ? (
                  <form onSubmit={handleSignIn} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="email" className="text-xs font-medium text-slate-300">
                        Email
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        required
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@campus.edu"
                        className="h-11 border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus-visible:ring-emerald-400/50"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="password" className="text-xs font-medium text-slate-300">
                        Password
                      </Label>
                      <Input
                        id="password"
                        type="password"
                        required
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="h-11 border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus-visible:ring-emerald-400/50"
                      />
                    </div>

                    {authError && (
                      <p className="rounded-lg border border-red-400/25 bg-red-400/10 px-3 py-2 text-xs text-red-200">
                        {authError}
                      </p>
                    )}

                    <Button
                      type="submit"
                      disabled={busy === "signin"}
                      className="h-11 w-full bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-300"
                    >
                      {busy === "signin" ? (
                        <>
                          <Loader2 className="mr-2 size-4 animate-spin" /> Signing in…
                        </>
                      ) : (
                        "Sign in"
                      )}
                    </Button>

                    <div className="flex items-center gap-3 py-1">
                      <span className="h-px flex-1 bg-white/10" />
                      <span className="text-[11px] uppercase tracking-wider text-slate-500">or</span>
                      <span className="h-px flex-1 bg-white/10" />
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 w-full border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
                      onClick={() => startLogin()}
                    >
                      Sign in with Manus
                    </Button>
                  </form>
                ) : (
                  <form onSubmit={handleSignUp} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="fullName" className="text-xs font-medium text-slate-300">
                        Full name
                      </Label>
                      <Input
                        id="fullName"
                        type="text"
                        required
                        autoComplete="name"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Ada Lovelace"
                        className="h-11 border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus-visible:ring-emerald-400/50"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="signupEmail" className="text-xs font-medium text-slate-300">
                        Email
                      </Label>
                      <Input
                        id="signupEmail"
                        type="email"
                        required
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@campus.edu"
                        className="h-11 border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus-visible:ring-emerald-400/50"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="signupPassword" className="text-xs font-medium text-slate-300">
                        Password
                      </Label>
                      <Input
                        id="signupPassword"
                        type="password"
                        required
                        minLength={8}
                        autoComplete="new-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="At least 8 characters"
                        className="h-11 border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus-visible:ring-emerald-400/50"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-slate-300">I am a…</Label>
                      <PersonaPicker value={persona} onChange={setPersona} />
                    </div>

                    {authError && (
                      <p className="rounded-lg border border-red-400/25 bg-red-400/10 px-3 py-2 text-xs text-red-200">
                        {authError}
                      </p>
                    )}

                    <Button
                      type="submit"
                      disabled={busy === "signup"}
                      className="h-11 w-full bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-300"
                    >
                      {busy === "signup" ? (
                        <>
                          <Loader2 className="mr-2 size-4 animate-spin" /> Creating account…
                        </>
                      ) : (
                        "Create account"
                      )}
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          </div>
        </main>

        {/* Demo personas */}
        <section className="pb-16 pt-4">
          <div className="mb-5 text-center">
            <p className="text-sm font-medium text-slate-300">Or explore instantly as a demo persona</p>
            <p className="mt-1 text-xs text-slate-500">No account needed — data is seeded per role</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {PERSONAS.map((personaItem) => {
              const Icon = PERSONA_ICONS[personaItem];
              const meta = PERSONA_META[personaItem];
              const isBusy = demoBusy === personaItem;
              return (
                <button
                  key={personaItem}
                  onClick={() => handleDemoLogin(personaItem)}
                  disabled={demoBusy !== null}
                  className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left transition-all duration-200 hover:border-emerald-400/40 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-slate-200 transition-colors group-hover:bg-emerald-400/15 group-hover:text-emerald-300">
                    {isBusy ? <Loader2 className="size-5 animate-spin" /> : <Icon className="size-5" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-white">{meta.label}</span>
                    <span className="mt-0.5 block text-xs text-slate-400">{meta.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <footer className="border-t border-white/5 py-6 text-center text-xs text-slate-500">
          Campus Intelligence OS · Express + tRPC + Supabase Auth &amp; Postgres · Gemini by Google
        </footer>
      </div>
    </div>
  );
}
