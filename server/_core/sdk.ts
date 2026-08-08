import { AXIOS_TIMEOUT_MS, COOKIE_NAME, ONE_YEAR_MS, decodeOAuthState } from "../../shared/const";
import { ForbiddenError } from "../../shared/_core/errors";
import axios, { type AxiosInstance } from "axios";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";
import { verifySupabaseToken, type SupabaseVerifiedUser } from "./supabase";
import type {
  ExchangeTokenRequest,
  ExchangeTokenResponse,
  GetUserInfoResponse,
  GetUserInfoWithJwtRequest,
  GetUserInfoWithJwtResponse,
} from "./types/manusTypes";
// Utility function
const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

export type SessionPayload = {
  openId: string;
  appId: string;
  name: string;
};

const EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
const GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
const GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;

class OAuthService {
  constructor(private client: ReturnType<typeof axios.create>) {
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      console.error(
        "[OAuth] ERROR: OAUTH_SERVER_URL is not configured! Set OAUTH_SERVER_URL environment variable."
      );
    }
  }

  private decodeState(state: string): string {
    return decodeOAuthState(state).redirectUri;
  }

  async getTokenByCode(
    code: string,
    state: string
  ): Promise<ExchangeTokenResponse> {
    const payload: ExchangeTokenRequest = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state),
    };

    const { data } = await this.client.post<ExchangeTokenResponse>(
      EXCHANGE_TOKEN_PATH,
      payload
    );

    return data;
  }

  async getUserInfoByToken(
    token: ExchangeTokenResponse
  ): Promise<GetUserInfoResponse> {
    const { data } = await this.client.post<GetUserInfoResponse>(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken,
      }
    );

    return data;
  }
}

const createOAuthHttpClient = (): AxiosInstance =>
  axios.create({
    baseURL: ENV.oAuthServerUrl,
    timeout: AXIOS_TIMEOUT_MS,
  });

class SDKServer {
  private readonly client: AxiosInstance;
  private readonly oauthService: OAuthService;

  constructor(client: AxiosInstance = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }

  private deriveLoginMethod(
    platforms: unknown,
    fallback: string | null | undefined
  ): string | null {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set<string>(
      platforms.filter((p): p is string => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (
      set.has("REGISTERED_PLATFORM_MICROSOFT") ||
      set.has("REGISTERED_PLATFORM_AZURE")
    )
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }

  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(
    code: string,
    state: string
  ): Promise<ExchangeTokenResponse> {
    return this.oauthService.getTokenByCode(code, state);
  }

  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken: string): Promise<GetUserInfoResponse> {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken,
    } as ExchangeTokenResponse);
    const loginMethod = this.deriveLoginMethod(
      (data as any)?.platforms,
      (data as any)?.platform ?? data.platform ?? null
    );
    return {
      ...(data as any),
      platform: loginMethod,
      loginMethod,
    } as GetUserInfoResponse;
  }

  private parseCookies(cookieHeader: string | undefined) {
    if (!cookieHeader) {
      return new Map<string, string>();
    }

    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }

  private getSessionSecret() {
    let secret = ENV.cookieSecret;
    if (!secret) {
      // Allow demo login before any keys are configured. Production must set
      // JWT_SECRET — this fallback is deterministic and therefore not secure.
      console.warn(
        "[Auth] JWT_SECRET is not configured — using an insecure development fallback. Set JWT_SECRET in production."
      );
      secret = "campus-intelligence-os-dev-only-secret";
    }
    return new TextEncoder().encode(secret);
  }

  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(
    openId: string,
    options: { expiresInMs?: number; name?: string } = {}
  ): Promise<string> {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || "",
      },
      options
    );
  }

  async signSession(
    payload: SessionPayload,
    options: { expiresInMs?: number } = {}
  ): Promise<string> {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1000);
    const secretKey = this.getSessionSecret();

    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name,
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(expirationSeconds)
      .sign(secretKey);
  }

  async verifySession(
    cookieValue: string | undefined | null
  ): Promise<{ openId: string; appId: string; name: string } | null> {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }

    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"],
      });
      const { openId, appId, name } = payload as Record<string, unknown>;

      // The JWT signature is the real security boundary. `appId`/`name` are
      // optional because demo and Supabase sessions sign without a Manus app
      // id (VITE_APP_ID unset) — only `openId` is required.
      if (!isNonEmptyString(openId)) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }

      return {
        openId,
        appId: isNonEmptyString(appId) ? appId : "",
        name: isNonEmptyString(name) ? name : "",
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }

  async getUserInfoWithJwt(
    jwtToken: string
  ): Promise<GetUserInfoWithJwtResponse> {
    const payload: GetUserInfoWithJwtRequest = {
      jwtToken,
      projectId: ENV.appId,
    };

    const { data } = await this.client.post<GetUserInfoWithJwtResponse>(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );

    const loginMethod = this.deriveLoginMethod(
      (data as any)?.platforms,
      (data as any)?.platform ?? data.platform ?? null
    );
    return {
      ...(data as any),
      platform: loginMethod,
      loginMethod,
    } as GetUserInfoWithJwtResponse;
  }

  async authenticateRequest(req: Request): Promise<AuthenticatedUser> {
    const cookies = this.parseCookies(req.headers.cookie);
    const authHeader = req.headers.authorization;
    const bearerToken =
      typeof authHeader === "string" && authHeader.startsWith("Bearer ")
        ? authHeader.slice(7)
        : null;

    // 1. Supabase Auth: the client forwards its session access token as a
    //    Bearer token. Verify it against Supabase and map the user to a local
    //    profile row (created lazily on first sign-in).
    if (bearerToken) {
      const supabaseUser = await verifySupabaseToken(bearerToken);
      if (supabaseUser) {
        return this.authenticateSupabaseUser(supabaseUser);
      }
    }

    // 2. Prefer the session cookie (regular OAuth login).
    let sessionToken = cookies.get(COOKIE_NAME);

    // 3. Fallback to the Authorization header (Preview auto-login via
    //    sessionStorage), used when the browser blocks iframe cookies such as
    //    Safari ITP, private browsing, or iOS/Android WebView. The header is
    //    also where the legacy Manus session token lands; Supabase tokens were
    //    already handled above.
    if (!sessionToken) {
      sessionToken = bearerToken ?? undefined;
    }

    const session = await this.verifySession(sessionToken);

    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }

    if (session.openId.startsWith(CRON_OPEN_ID_PREFIX)) {
      const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
      const taskUid = userInfo.taskUid ?? null;
      if (!taskUid) {
        throw ForbiddenError("Cron session missing task_uid");
      }
      return buildCronUser(userInfo);
    }

    const sessionUserId = session.openId;
    const signedInAt = new Date();
    let user = await db.getUserByOpenId(sessionUserId);

    // Demo personas work even before a database is configured: derive the
    // profile from the openId (`demo-<persona>`) instead of requiring a row.
    if (!user && sessionUserId.startsWith(DEMO_OPEN_ID_PREFIX)) {
      const persona = sessionUserId.slice(DEMO_OPEN_ID_PREFIX.length);
      if ((PERSONAS as readonly string[]).includes(persona)) {
        return buildDemoUser(persona as Persona, session.name);
      }
    }

    // If user not in DB, sync from OAuth server automatically
    if (!user) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
        await db.upsertUser({
          openId: userInfo.openId,
          fullName: userInfo.name || null,
          email: userInfo.email ?? null,
          persona: "student",
          lastSignedIn: signedInAt,
        });
        user = await db.getUserByOpenId(userInfo.openId);
      } catch (error) {
        console.error("[Auth] Failed to sync user from OAuth:", error);
        throw ForbiddenError("Failed to sync user info");
      }
    }

    if (!user) {
      throw ForbiddenError("User not found");
    }

    await db.upsertUser({
      openId: user.openId,
      persona: "student",
      lastSignedIn: signedInAt,
    });

    return user;
  }

  /**
   * Map a verified Supabase user to a local profile row, creating it on first
   * sign-in. Falls back to a synthetic in-memory profile when the database is
   * unavailable so the app still boots for local development.
   */
  private async authenticateSupabaseUser(
    supabaseUser: SupabaseVerifiedUser
  ): Promise<AuthenticatedUser> {
    const signedInAt = new Date();
    let user = await db.getUserByOpenId(supabaseUser.id);

    if (!user) {
      try {
        await db.upsertUser({
          openId: supabaseUser.id,
          fullName: supabaseUser.fullName,
          email: supabaseUser.email,
          persona: supabaseUser.persona,
          department: supabaseUser.department,
          lastSignedIn: signedInAt,
        });
        user = await db.getUserByOpenId(supabaseUser.id);
      } catch (error) {
        console.warn("[Auth] Failed to persist Supabase user:", error);
      }
    } else {
      try {
        await db.upsertUser({
          openId: user.openId,
          fullName: supabaseUser.fullName ?? user.fullName,
          email: supabaseUser.email ?? user.email,
          persona: supabaseUser.persona,
          lastSignedIn: signedInAt,
        });
      } catch (error) {
        console.warn("[Auth] Failed to update Supabase user:", error);
      }
    }

    if (user) return user;

    // Database unavailable: serve a synthetic profile so the UI works.
    const now = new Date();
    return {
      id: -1,
      openId: supabaseUser.id,
      fullName: supabaseUser.fullName,
      email: supabaseUser.email,
      persona: supabaseUser.persona,
      department: supabaseUser.department,
      createdAt: now,
      updatedAt: now,
      lastSignedIn: now,
    } as AuthenticatedUser;
  }
}

const CRON_OPEN_ID_PREFIX = "cron_";
const DEMO_OPEN_ID_PREFIX = "demo-";
const PERSONAS = ["student", "faculty", "principal"] as const;

type Persona = (typeof PERSONAS)[number];

function buildDemoUser(persona: Persona, name: string): AuthenticatedUser {
  const now = new Date();
  const displayNames: Record<Persona, { fullName: string; department: string | null }> = {
    student: { fullName: "Ananya Rao", department: "CSE" },
    faculty: { fullName: "Dr. Vikram Shah", department: "Computer Science" },
    principal: { fullName: "Dr. Meera Iyer", department: null },
  };
  const profile = displayNames[persona];
  return {
    id: -1,
    openId: `${DEMO_OPEN_ID_PREFIX}${persona}`,
    fullName: name || profile.fullName,
    email: `${persona}@demo.edu`,
    persona,
    department: profile.department,
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
  } as AuthenticatedUser;
}

/** Result of `sdk.authenticateRequest`. Cron callbacks set `isCron=true` and `taskUid`; see `/home/ubuntu/skills/webdev-periodic-updates/SKILL.md`. */
export type AuthenticatedUser = User & {
  taskUid?: string;
  isCron?: boolean;
};

function buildCronUser(
  userInfo: GetUserInfoWithJwtResponse
): AuthenticatedUser {
  const now = new Date();
  return {
    id: -1,
    openId: userInfo.openId,
    fullName: userInfo.name || "Manus Scheduled Task",
    email: null,
    persona: "student",
    department: null,
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
    taskUid: userInfo.taskUid ?? undefined,
    isCron: true,
  } as AuthenticatedUser;
}

export const sdk = new SDKServer();
