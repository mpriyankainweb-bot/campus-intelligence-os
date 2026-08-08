import dotenv from "dotenv";
// Load local dev env (Keys-tab vars still take precedence via process.env).
// `.env.local` holds the Gemini key and model for the sandbox dev server.
dotenv.config({ path: [".env.local", ".env"] });
import express, { type Express } from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic } from "./vite";

/**
 * Build the fully-configured Express application (middleware + routes).
 *
 * Serverless-safe: this factory never calls `listen()`. The standalone
 * launcher (server/_core/index.ts) is responsible for binding a port for
 * local/self-hosted production, while Vercel's api/index.ts exports this
 * same app as its serverless handler.
 *
 * Static file serving is deliberately skipped when running on Vercel
 * (VERCEL=1): the Vercel CDN serves the built client from `dist/` directly
 * and rewrites SPA routes to /index.html, so the function only handles API
 * traffic (/api/* and /manus-storage/*).
 */
export function createApp(): Express {
  const app = express();

  // Trust the proxy so req.protocol / req.secure / cookies behave correctly
  // behind Vercel's CDN (x-forwarded-proto: https).
  app.set("trust proxy", 1);

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  registerStorageProxy(app);
  registerOAuthRoutes(app);

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // SPA static serving for standalone (non-Vercel) production runs.
  if (process.env.VERCEL !== "1" && process.env.NODE_ENV !== "development") {
    serveStatic(app);
  }

  return app;
}
