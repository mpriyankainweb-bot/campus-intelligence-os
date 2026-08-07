# Campus Intelligence OS

An enterprise-grade AI-powered institutional assistant platform with role-based access, explainable multi-agent reasoning, RAG knowledge pipeline, and rich memory architecture.

## Features

- **Three User Personas**: Student, Faculty, and Principal with role-specific dashboards and permissions
- **Multi-Agent Orchestrator**: 6-stage pipeline (Understand → Plan → Route → Verify → Replan → Synthesize)
- **Five Intelligence Components**: Academic, Career, Knowledge (RAG), Analytics, and Communication
- **Explainable AI**: Every response includes reasoning, evidence with citations, confidence scores, and rejected alternatives
- **RAG Pipeline**: Local embeddings (@xenova/all-MiniLM-L6-v2) with pgvector retrieval
- **Memory System**: Conversation memory, long-term facts, execution state, and in-process shared context
- **Approval Workflows**: High-impact actions require role-based approval
- **Supabase Auth**: Email/password sign-in & sign-up with a persona picker at signup (Student / Faculty / Principal)
- **Demo Authentication**: One-click demo personas (no account required)

## Technology Stack

- **Frontend**: React 19 + TypeScript + Tailwind CSS 4 + shadcn/ui
- **Backend**: Express 4 + tRPC 11 + Node.js
- **Database**: Supabase Postgres with Drizzle ORM (postgres-js driver)
- **Auth**: Supabase Auth (email/password) + optional Manus OAuth
- **LLM**: Google Gemini (gemini-3.5-flash) via the Gemini REST API, with automatic model fallbacks
- **Embeddings**: @xenova/transformers (all-MiniLM-L6-v2)
- **Deployment**: Vercel (frontend/backend) + Managed Database

## Setup Instructions

### Prerequisites

- Node.js 22+
- pnpm 10+
- A Gemini API key (for AI chat — demo personas work without it)
- A Supabase project (Auth + Postgres)

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Configure Environment Variables

Create `.env.local` with the following variables (or set them in the platform's Keys/API keys tab):

```env
# Supabase (Auth + Database)
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # service_role key (server-side only)
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...      # anon/public key (browser)
DATABASE_URL=postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres

# LLM + sessions
GEMINI_API_KEY=AIza...   # Google AI Studio / Gemini API key
GEMINI_MODEL=gemini-3.5-flash   # optional; defaults to gemini-3.5-flash (fallbacks: gemini-flash-latest, gemini-2.0-flash, gemini-2.5-flash)
JWT_SECRET=your-secret-key-here

# Optional: legacy Manus OAuth login
VITE_APP_ID=your-app-id
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://portal.manus.im
```

> **Note:** `DATABASE_URL` should point at your **Supabase Postgres** connection string (Project Settings → Database → Connection string). The app still boots without it (demo personas and the landing page work), but users, memory, and RAG need it.

### 3. Set Up Database

```bash
# Generate and apply migrations, then push them to Supabase
pnpm db:push
# or, step by step:
pnpm drizzle-kit generate
pnpm drizzle-kit migrate
```

The migration creates all tables plus the persona/standing/status enums. New signups and demo logins create their `users` rows lazily.

### 4. Seed Demo Data

Seed the demo personas, academic records, career opportunities, pending approval actions and the RAG policy documents (idempotent — safe to re-run):

```bash
pnpm db:seed
```

The seed creates:
- The three demo users (student / faculty / principal)
- Academic records for the demo student
- Career opportunities
- Two pending approval actions (student → faculty, faculty → principal)
- The three policy documents chunked and embedded for RAG (first run downloads the local embedding model)

### 5. Ingest Policy Documents (alternative)

If you prefer to ingest documents manually, use the ingest endpoint:

```bash
# Document 1: Internship Placement Policy
curl -X POST http://localhost:3000/api/trpc/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Internship Placement Policy",
    "docType": "placement_policy",
    "content": "Section 1: Eligibility. Students are eligible for institution-facilitated internship placement if their overall attendance is at or above 75% and their academic standing is \"good\" at the time of application. Section 2: Probation Exception. A student on academic probation may apply for internships only with written faculty sponsor approval, and such applications are automatically flagged for Principal-level review. Section 3: Multiple Applications. Students may hold no more than two active internship applications at any time.",
    "effectiveDate": "2026-01-01"
  }'

# Document 2: Attendance & Academic Standing Regulation
curl -X POST http://localhost:3000/api/trpc/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Attendance & Academic Standing Regulation",
    "docType": "regulation",
    "content": "Section 1: Standing Categories. A student is classified \"good standing\" at 75% attendance or above across all enrolled courses. A student between 60% and 74% is classified \"probation.\" Below 60% triggers mandatory faculty intervention review. Section 2: Intervention Trigger. Any student falling into \"probation\" standing must be flagged to their course faculty within one academic week for a documented intervention plan.",
    "effectiveDate": "2026-01-01"
  }'

# Document 3: Faculty Communication & Escalation Handbook
curl -X POST http://localhost:3000/api/trpc/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Faculty Communication & Escalation Handbook",
    "docType": "handbook",
    "content": "Section 1: Scope of Faculty Action. Faculty may directly message their own enrolled students without approval. Section 2: HOD Escalation. Any communication naming a Head of Department, or any communication sent to more than one class section simultaneously, requires Principal approval before sending, regardless of content.",
    "effectiveDate": "2026-01-01"
  }'
```

### 6. Run Development Server

```bash
pnpm dev
```

The application will start on http://localhost:3000 (or next available port).

## Demo fallbacks

Everything works even before Supabase or Gemini keys are configured:

- **Demo personas** sign in instantly (session cookie, no account needed).
- **Dashboards** render rich demo data (timetables, analytics, notifications) and switch to live Supabase data automatically once `DATABASE_URL` is set and `pnpm db:seed` has run.
- **AI chat** answers from in-memory academic records, opportunities and a keyword-scored policy corpus when the database is unavailable, then falls back to real RAG retrieval (pgvector) when it is.
- If `GEMINI_API_KEY` is missing, chat responds with a clear setup message instead of erroring.

## Authentication

- **Sign up**: Enter your name, email, password and pick a persona (Student / Faculty / Principal). The server creates a Supabase Auth user (auto-confirmed, so no email verification delay) with the persona stored in `user_metadata`, then signs you in and routes you to your role dashboard.
- **Sign in**: Existing Supabase users authenticate with email + password; the session token is forwarded to the API as a Bearer token and verified server-side.
- **Demo personas**: One click, no account needed. Demo users get a `demo-<persona>` profile so you can explore all three dashboards instantly.
- **Manus OAuth**: The legacy “Sign in with Manus” flow is still available on the landing page.

## Demo Personas

| Persona | Name | Route |
|---------|------|-------|
| Student | Ananya Rao | `/dashboard/student` |
| Faculty | Dr. Vikram Shah | `/dashboard/faculty` |
| Principal | Dr. Meera Iyer | `/dashboard/principal` |

Click the corresponding card on the home page to access each dashboard.

## API Endpoints

All endpoints are under `/api/trpc`:

### Chat
- **POST** `/api/trpc/chat` - Send a query to the orchestrator (Gemini-backed)
  - Input: `{ query: string, sessionId: string }`
  - Output: Explainable response with reasoning, evidence, confidence, rejected alternatives

### Brief
- **GET** `/api/trpc/brief` - Get persona-scoped daily brief
  - Output: `{ title: string, content: string }`

### Actions
- **GET** `/api/trpc/actions` - List pending approvals for current user
  - Output: Array of pending actions
- **POST** `/api/trpc/actionsApprove` - Approve a pending action
  - Input: `{ id: number }`
- **POST** `/api/trpc/actionsReject` - Reject a pending action
  - Input: `{ id: number }`

### Ingest
- **POST** `/api/trpc/ingest` - Ingest a policy document
  - Input: `{ title: string, docType: string, content: string, effectiveDate?: string }`
  - Output: `{ success: boolean, docId: number, chunkCount: number }`

## Workflow Examples

### Student Workflow
1. Login as Student (Ananya Rao)
2. View daily brief with attendance and opportunities
3. Ask questions about internship eligibility
4. Register for internships (auto-executes, no approval needed)

### Faculty Workflow
1. Login as Faculty (Dr. Vikram Shah)
2. View teaching summary with students needing intervention
3. Ask about specific students
4. Draft communications (requires Principal approval if HOD-facing)

### Principal Workflow
1. Login as Principal (Dr. Meera Iyer)
2. View executive brief with high-impact actions
3. Review pending approvals
4. Approve or reject high-impact actions

## Architecture

### Six-Layer Architecture

```
LAYER 1  Client            Web app (Student / Faculty / Principal views)
LAYER 2  API Gateway       Auth, persona resolution, rate limiting
LAYER 3  Orchestrator      6-stage pipeline (Understand → Plan → Verify → Replan → Synthesize)
LAYER 4  Intelligence      Academic | Career | Knowledge | Analytics | Communication
LAYER 5  Shared Infra      Memory | Vector Store | DB | Tool Adapters
LAYER 6  External Systems  Calendar, Email, Institutional DB
```

### Orchestrator Pipeline

1. **Understand** (LLM): Classify user intent
2. **Plan** (LLM): Generate action plan
3. **Route/Dispatch**: Deterministically route to components
4. **Verify** (deterministic): Resolve conflicts via precedence (Knowledge > Academic/Career/Analytics > Communication)
5. **Replan**: Patch affected steps if confidence is low
6. **Synthesize** (LLM): Generate final explainable response

### Memory System

- **Conversation Memory**: Per-session chat history (persisted)
- **Long-Term Memory**: Persistent facts about users (persisted)
- **Execution State**: Pending high-impact actions (persisted)
- **Shared Context**: In-process only, passed between orchestrator stages

### RAG Pipeline

1. **Chunking**: Split documents into ~2000-char chunks
2. **Embedding**: Generate embeddings using @xenova/all-MiniLM-L6-v2
3. **Storage**: Store embeddings in database
4. **Retrieval**: Cosine similarity search for top-K chunks
5. **Confidence**: Return 0 confidence if no match above threshold

## Build Order (Mandatory Items)

1. Database schema + seed data
2. LLM helper (Gemini structured responses)
3. RAG pipeline (chunking, embedding, retrieval)
4. All five Intelligence Components
5. Full Orchestrator (6-stage pipeline)
6. API routes (chat, brief, actions, ingest)
7. Authentication + Gateway middleware
8. Frontend dashboards + chat UI
9. Testing + validation
10. Documentation

## Testing

Run tests with:

```bash
pnpm test
```

Key test scenarios:
- Student workflow: login → brief → ask question → register for internship
- Faculty workflow: login → brief → ask question → draft communication
- Principal workflow: login → brief → ask question → approve/reject actions
- RAG: policy questions answered from ingested chunks
- Memory: conversation history persists across turns
- Explainability: every response renders reasoning, evidence, confidence
- Approval workflow: high-impact actions appear in execution_state as pending
- Permission failure: Student accessing Faculty route returns 403

## Deployment

### Vercel

```bash
# Push to GitHub
git push origin main

# Deploy via Vercel dashboard or CLI
vercel deploy
```

### Environment Variables (Production)

Set the same variables in Vercel project settings (Supabase values must be the production project's):
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` (server)
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (browser)
- `DATABASE_URL` (Supabase Postgres)
- `GEMINI_API_KEY`
- `JWT_SECRET`
- `VITE_APP_ID` / `OAUTH_SERVER_URL` / `VITE_OAUTH_PORTAL_URL` (optional, legacy Manus login)

## Troubleshooting

### Dev server won't start
- Check if port 3000 is in use: `lsof -i :3000`
- Kill existing process: `pkill -f "tsx watch"`
- Restart: `pnpm dev`

### Database connection fails
- Verify `DATABASE_URL` is correct
- Check database is running and accessible
- Run migrations: `pnpm drizzle-kit migrate`

### LLM calls failing
- Verify `GEMINI_API_KEY` is set correctly (Keys/API keys tab, or `.env.local`)
- Check API quota and rate limits on the Gemini API
- Review error logs in `.manus-logs/devserver.log`

### RAG retrieval returning no results
- Verify documents were ingested successfully
- Check document chunks in database: `SELECT COUNT(*) FROM document_chunks;`
- Try ingesting documents again if needed

## License

MIT

## Support

For issues or questions, please refer to the specification document or contact the development team.
