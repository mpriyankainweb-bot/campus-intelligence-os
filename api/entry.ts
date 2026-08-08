import { createApp } from "../server/_core/app";

type Handler = (req: unknown, res: unknown) => void;

// Cache the Express app across warm lambda invocations. The app is stateless
// per request (session state lives in signed cookies / in-memory demo stores),
// so a single instance can serve every invocation safely.
let cachedApp: Handler | null = null;

/**
 * Vercel serverless handler. This file is bundled by the build script into
 * `api/index.mjs`; vercel.json rewrites /api/* and /manus-storage/* to it.
 * The CDN serves the static client and rewrites SPA routes to /index.html.
 * Never calls listen().
 */
export default function handler(req: unknown, res: unknown) {
  cachedApp ??= createApp() as unknown as Handler;
  return cachedApp(req, res);
}
