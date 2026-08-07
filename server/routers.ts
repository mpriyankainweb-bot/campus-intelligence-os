import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { orchestrate } from "./lib/orchestrator/index";
import { ingestDocument } from "./lib/rag/pipeline";
import { getPendingActions } from "./lib/memory/store";
import { z } from "zod";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
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
