# Campus Intelligence OS — Build Checklist

## Phase 1: Database & Infrastructure
- [x] Database schema (users, academic_records, career_opportunities, documents, document_chunks, memory tables, simulated_actions)
- [x] Seed data (3 personas, academic records, career opportunities)
- [x] RLS policies for persona-based access control
- [x] Database users created

## Phase 2: LLM & RAG Core
- [x] LLM helper (claude.ts) with structured JSON response format
- [x] RAG pipeline: chunking, local embeddings (@xenova/all-MiniLM-L6-v2), pgvector retrieval
- [x] /api/ingest endpoint to seed the three policy documents
- [ ] Verify RAG retrieval works with seed documents

## Phase 3: Memory & Shared Infrastructure
- [x] Conversation memory store (persisted)
- [x] Long-term memory store (persisted)
- [x] Execution state store (persisted)
- [x] Shared context (in-process only)
- [ ] Tool adapters (simulated calendar, email, institutional DB)

## Phase 4: Intelligence Components
- [x] Academic Intelligence Component (stateless, returns {result, evidence[], confidence, source_type})
- [x] Career Intelligence Component
- [x] Knowledge Intelligence Component (RAG-backed)
- [x] Analytics Intelligence Component
- [x] Communication Intelligence Component

## Phase 5: Orchestrator
- [x] Understand stage (LLM call to classify intent)
- [x] Plan stage (LLM call to generate action plan)
- [x] Route/Dispatch stage (deterministic routing to components)
- [x] Verify stage (deterministic precedence resolution, no LLM)
- [x] Replan stage (patch affected steps only)
- [x] Synthesize stage (LLM call to generate final response)

## Phase 6: API Routes
- [x] POST /api/chat (orchestrator entry point, returns explainable response)
- [x] GET /api/brief (persona-scoped daily brief)
- [x] GET /api/actions (pending approvals list)
- [ ] POST /api/actions/[id]/approve (high-impact action approval)
- [ ] POST /api/actions/[id]/reject (high-impact action rejection)
- [x] POST /api/ingest (document ingestion with chunking + embedding)

## Phase 7: Authentication & Gateway
- [x] Demo login page (3 buttons: Student, Faculty, Principal)
- [x] Session management (localStorage demo auth)
- [x] API Gateway middleware (persona resolution, 403 on unauthorized access)
- [x] Permission checks before Orchestrator invocation

## Phase 8: Frontend UI
- [x] Student dashboard (brief card, chat interface, no approvals list)
- [x] Faculty dashboard (brief card, chat interface, approvals list)
- [x] Principal dashboard (brief card, chat interface, approvals list)
- [x] Chat UI component (renders answer, reasoning, evidence, confidence, rejected_alternatives)
- [x] Evidence list with doc_id/section citations
- [x] Confidence indicator
- [x] Rejected alternatives section
- [x] Approvals list with Approve/Reject buttons (UI present)
- [x] Home page with demo login buttons

## Phase 9: Testing & Validation
- [ ] Student workflow: login → brief → ask question → register for internship (auto-execute)
- [ ] Faculty workflow: login → brief → ask question → draft communication (requires approval if HOD-facing)
- [ ] Principal workflow: login → brief → ask question → approve/reject high-impact actions
- [ ] RAG: policy questions answered from ingested chunks with correct citations
- [ ] Memory: conversation history and long-term facts persist and influence later turns
- [ ] Explainability: every response renders reasoning, evidence, confidence, rejected alternatives
- [ ] Approval workflow: high-impact actions appear in execution_state as pending
- [ ] Multi-agent orchestration: different intents produce different plans
- [ ] Precedence resolution: Knowledge > Academic/Career/Analytics > Communication
- [ ] Permission failure: Student accessing Faculty route returns 403 at Gateway

## Phase 10: Documentation & Deployment
- [x] README.md with setup, env variables, demo flow walkthrough
- [x] .env.local.example with required variables
- [ ] Vercel deployment configuration
- [ ] Supabase setup instructions (schema, seed, document ingestion)
