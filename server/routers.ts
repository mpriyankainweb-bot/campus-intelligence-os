import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { getSessionCookieOptions } from "./_core/cookies";
import { sdk } from "./_core/sdk";
import { getSupabaseAdmin } from "./_core/supabase";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import * as db from "./db";
import { orchestrate } from "./lib/orchestrator/index";
import { ingestDocument } from "./lib/rag/pipeline";
import { getPendingActions, approveAction, rejectAction } from "./lib/memory/store";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { academicRecords, careerOpportunities } from "../drizzle/schema";
import { DEMO_ACADEMIC_RECORDS, DEMO_CAREER_OPPORTUNITIES } from "./lib/demo/data";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),

    /**
     * Create a Supabase Auth user (auto-confirmed, so signup is instant) with
     * the chosen persona stored in user_metadata, then create the local
     * profile row. The client signs in with the same credentials afterwards.
     */
    signup: publicProcedure
      .input(
        z.object({
          email: z.string().email(),
          password: z.string().min(8, "Password must be at least 8 characters"),
          fullName: z.string().min(1, "Full name is required"),
          persona: z.enum(["student", "faculty", "principal"]),
          department: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const supabase = getSupabaseAdmin();
        if (!supabase) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Supabase is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
          });
        }

        const { data, error } = await supabase.auth.admin.createUser({
          email: input.email,
          password: input.password,
          email_confirm: true,
          user_metadata: {
            fullName: input.fullName,
            persona: input.persona,
            department: input.department ?? null,
          },
        });

        if (error) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: error.message,
          });
        }
        if (!data.user) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create user",
          });
        }

        // Persist the local profile row keyed by the Supabase user UUID.
        await db.upsertUser({
          openId: data.user.id,
          fullName: input.fullName,
          email: input.email,
          persona: input.persona,
          department: input.department ?? null,
          lastSignedIn: new Date(),
        });

        return { success: true, email: input.email } as const;
      }),

    /**
     * Demo persona login (no Supabase required): creates/refreshes the demo
     * profile row and issues the standard session cookie.
     */
    demoLogin: publicProcedure
      .input(z.object({ persona: z.enum(["student", "faculty", "principal"]) }))
      .mutation(async ({ input, ctx }) => {
        const signedInAt = new Date();
        const openId = `demo-${input.persona}`;
        const names: Record<string, { fullName: string; department: string | null }> = {
          student: { fullName: "Ananya Rao", department: "CSE" },
          faculty: { fullName: "Dr. Vikram Shah", department: "Computer Science" },
          principal: { fullName: "Dr. Meera Iyer", department: null },
        };
        const { fullName, department } = names[input.persona];

        await db.upsertUser({
          openId,
          fullName,
          email: `${input.persona}@demo.edu`,
          persona: input.persona,
          department,
          lastSignedIn: signedInAt,
        });

        const token = await sdk.createSessionToken(openId, { name: fullName });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, cookieOptions);

        return {
          success: true,
          redirectTo: `/dashboard/${input.persona}`,
        } as const;
      }),
  }),

  chat: protectedProcedure
    .input(z.object({ query: z.string(), sessionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) {
        return {
          result: "Unauthorized",
          reasoning: "",
          confidence: 0,
          evidence: [],
          source_type: "computed" as const,
        };
      }

      try {
        const response = await orchestrate({
          userId: ctx.user.id,
          sessionId: input.sessionId,
          userPersona: ctx.user.persona,
          userQuery: input.query,
        });

        return response;
      } catch (error) {
        console.error("[Chat] Orchestration failed:", error);
        return {
          result: "An error occurred while processing your request.",
          reasoning: "Internal error",
          confidence: 0,
          evidence: [],
          source_type: "computed" as const,
        };
      }
    }),

  brief: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.user) {
      return { title: "Brief", content: "Unable to load brief." };
    }

    let content = "";

    if (ctx.user.persona === "student") {
      content = `Welcome, ${ctx.user.fullName}! Here is your daily brief:\n\n- Check your attendance across all courses\n- Review upcoming internship deadlines\n- Any new opportunities matching your profile`;
    } else if (ctx.user.persona === "faculty") {
      content = `Welcome, ${ctx.user.fullName}! Here is your teaching summary:\n\n- Students needing intervention\n- Pending communications for approval\n- Department announcements`;
    } else if (ctx.user.persona === "principal") {
      content = `Welcome, ${ctx.user.fullName}! Here is your executive brief:\n\n- High-impact actions pending approval\n- Institution-wide metrics\n- Critical escalations`;
    }

    return {
      title: `Daily Brief - ${new Date().toLocaleDateString()}`,
      content,
    };
  }),

  actions: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.user) return [];

    const pending = await getPendingActions(undefined, ctx.user.id);
    return pending.map((action) => ({
      id: action.id,
      userId: action.userId,
      actionType: action.actionType,
      actionData: action.actionData,
      createdAt: action.createdAt,
    }));
  }),

  actionsApprove: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Not signed in" });
      }
      await approveAction(input.id, ctx.user.id);
      return { success: true } as const;
    }),

  actionsReject: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Not signed in" });
      }
      await rejectAction(input.id, ctx.user.id);
      return { success: true } as const;
    }),

  dashboard: router({
    /** Academic records for the current user — DB when available, else demo data. */
    academics: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user) return DEMO_ACADEMIC_RECORDS;
      try {
        const database = await db.getDb();
        if (!database) return DEMO_ACADEMIC_RECORDS;
        const rows = await database
          .select()
          .from(academicRecords)
          .where(eq(academicRecords.studentId, ctx.user.id));
        return rows.length > 0 ? rows : DEMO_ACADEMIC_RECORDS;
      } catch (error) {
        console.warn("[Dashboard] academics fallback:", error);
        return DEMO_ACADEMIC_RECORDS;
      }
    }),

    /** Career opportunities — DB when available, else demo data. */
    opportunities: protectedProcedure.query(async () => {
      try {
        const database = await db.getDb();
        if (!database) return DEMO_CAREER_OPPORTUNITIES;
        const rows = await database.select().from(careerOpportunities);
        return rows.length > 0 ? rows : DEMO_CAREER_OPPORTUNITIES;
      } catch (error) {
        console.warn("[Dashboard] opportunities fallback:", error);
        return DEMO_CAREER_OPPORTUNITIES;
      }
    }),
  }),

  ingest: publicProcedure
    .input(
      z.object({
        title: z.string(),
        docType: z.string(),
        content: z.string(),
        effectiveDate: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const result = await ingestDocument(
          input.title,
          input.docType,
          input.content,
          new Date(input.effectiveDate || new Date())
        );

        return {
          success: true,
          docId: result.docId,
          chunkCount: result.chunkCount,
        };
      } catch (error) {
        console.error("[Ingest] Failed:", error);
        return {
          success: false,
          error: "Failed to ingest document",
        };
      }
    }),
});

export type AppRouter = typeof appRouter;
