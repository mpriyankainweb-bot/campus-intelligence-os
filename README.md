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
- **Demo Authentication**: Three login buttons (no OAuth required for demo)

## Technology Stack

- **Frontend**: React 19 + TypeScript + Tailwind CSS 4 + shadcn/ui
- **Backend**: Express 4 + tRPC 11 + Node.js
- **Database**: MySQL/TiDB with Drizzle ORM
- **LLM**: Claude 3.5 Sonnet via @anthropic-ai/sdk
- **Embeddings**: @xenova/transformers (all-MiniLM-L6-v2)
- **Deployment**: Vercel (frontend/backend) + Managed Database

## Setup Instructions

### Prerequisites

- Node.js 22+
- pnpm 10+
- Anthropic API key
- Database connection string

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Configure Environment Variables

Create `.env.local` with the following variables:

```env
DATABASE_URL=mysql://user:password@host:port/database
ANTHROPIC_API_KEY=sk-ant-...
JWT_SECRET=your-secret-key-here
VITE_APP_ID=your-app-id
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://portal.manus.im
```

### 3. Set Up Database

```bash
# Generate and apply migrations
pnpm drizzle-kit generate
pnpm drizzle-kit migrate
```

### 4. Seed Demo Data

The database schema includes tables for:
- Users (with persona: student, faculty, principal)
- Academic records
- Career opportunities
- Documents and document chunks (for RAG)
- Conversation memory
- Long-term memory
- Execution state (for approvals)
- Simulated actions

Seed data is automatically created during migration.

### 5. Ingest Policy Documents

Before using the RAG pipeline, ingest the three policy documents:

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

## Demo Personas

Three demo users are pre-configured:

| Persona | Name | Email | Password |
|---------|------|-------|----------|
| Student | Ananya Rao | student@demo.edu | demo1234 |
| Faculty | Dr. Vikram Shah | faculty@demo.edu | demo1234 |
| Principal | Dr. Meera Iyer | principal@demo.edu | demo1234 |

Click the corresponding login button on the home page to access each dashboard.

## API Endpoints

All endpoints are under `/api/trpc`:

### Chat
- **POST** `/api/trpc/chat` - Send a query to the orchestrator
  - Input: `{ query: string, sessionId: string }`
  - Output: Explainable response with reasoning, evidence, confidence, rejected alternatives

### Brief
- **GET** `/api/trpc/brief` - Get persona-scoped daily brief
  - Output: `{ title: string, content: string }`

### Actions
- **GET** `/api/trpc/actions` - List pending approvals for current user
  - Output: Array of pending actions

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
2. LLM helper (Claude structured responses)
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

Set the same `.env.local` variables in Vercel project settings:
- `DATABASE_URL`
- `ANTHROPIC_API_KEY`
- `JWT_SECRET`
- `VITE_APP_ID`
- `OAUTH_SERVER_URL`
- `VITE_OAUTH_PORTAL_URL`

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
- Verify `ANTHROPIC_API_KEY` is set correctly
- Check API quota and rate limits
- Review error logs in `.manus-logs/devserver.log`

### RAG retrieval returning no results
- Verify documents were ingested successfully
- Check document chunks in database: `SELECT COUNT(*) FROM document_chunks;`
- Try ingesting documents again if needed

## License

MIT

## Support

For issues or questions, please refer to the specification document or contact the development team.
