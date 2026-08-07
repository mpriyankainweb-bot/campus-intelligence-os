import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ENV } from "./env";

let _adminClient: SupabaseClient | null = null;

/**
 * Lazy service-role client. Returns null when Supabase isn't configured so the
 * rest of the app still boots for local development / demo personas.
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  if (!ENV.supabaseUrl || !ENV.supabaseServiceRoleKey) return null;
  if (!_adminClient) {
    _adminClient = createClient(ENV.supabaseUrl, ENV.supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return _adminClient;
}

export type SupabaseVerifiedUser = {
  id: string;
  email: string | null;
  fullName: string | null;
  persona: "student" | "faculty" | "principal";
  department: string | null;
};

const PERSONAS = ["student", "faculty", "principal"] as const;

/**
 * Verify a Supabase access token (JWT) against the project and return the
 * resolved profile. Falls back to "student" persona when metadata is absent.
 */
export async function verifySupabaseToken(
  token: string
): Promise<SupabaseVerifiedUser | null> {
  const admin = getSupabaseAdmin();
  if (!admin) return null;

  try {
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data.user) return null;

    const meta = (data.user.user_metadata ?? {}) as Record<string, unknown>;
    const personaRaw = meta.persona;
    const persona = PERSONAS.includes(personaRaw as (typeof PERSONAS)[number])
      ? (personaRaw as "student")
      : "student";

    return {
      id: data.user.id,
      email: data.user.email ?? null,
      fullName: typeof meta.fullName === "string" ? meta.fullName : null,
      persona,
      department: typeof meta.department === "string" ? meta.department : null,
    };
  } catch {
    return null;
  }
}
