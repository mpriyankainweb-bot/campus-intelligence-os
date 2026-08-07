import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

/** True when Supabase env vars are configured in the Keys/API keys tab. */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

/** Browser Supabase client (null until VITE_SUPABASE_URL + ANON key are set). */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export type Persona = "student" | "faculty" | "principal";

const PERSONAS: Persona[] = ["student", "faculty", "principal"];

/** Resolve the persona from a Supabase user's user_metadata (defaults to student). */
export function personaFromUser(user: {
  user_metadata?: Record<string, unknown>;
} | null): Persona {
  const raw = user?.user_metadata?.persona;
  return PERSONAS.includes(raw as Persona) ? (raw as Persona) : "student";
}

export const PERSONA_META: Record<
  Persona,
  { label: string; description: string }
> = {
  student: {
    label: "Student",
    description: "Attendance, opportunities, personal briefs",
  },
  faculty: {
    label: "Faculty",
    description: "Teaching summaries, interventions, approvals",
  },
  principal: {
    label: "Principal",
    description: "Executive brief, institution-wide metrics",
  },
};
