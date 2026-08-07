import {
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * Persona enum shared by the users table.
 */
export const personaEnum = pgEnum("persona", ["student", "faculty", "principal"]);

export type Persona = (typeof personaEnum)['enumValues'][number];

export const standingEnum = pgEnum("standing", ["good", "probation", "warning"]);

export const actionStatusEnum = pgEnum("status", [
  "pending",
  "approved",
  "rejected",
  "executed",
]);

/**
 * Core user table backing auth flow (Supabase Auth + demo personas).
 * `openId` stores the Supabase auth user UUID (or a `demo-<persona>` key).
 */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  fullName: text("fullName"),
  email: varchar("email", { length: 320 }),
  persona: personaEnum("persona").notNull(),
  department: varchar("department", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Academic records for students.
 */
export const academicRecords = pgTable("academic_records", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull(),
  course: varchar("course", { length: 255 }).notNull(),
  attendancePercent: numeric("attendance_percent", { precision: 5, scale: 2 }).notNull(),
  standing: standingEnum("standing").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AcademicRecord = typeof academicRecords.$inferSelect;
export type InsertAcademicRecord = typeof academicRecords.$inferInsert;

/**
 * Career opportunities available to students.
 */
export const careerOpportunities = pgTable("career_opportunities", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  eligibilityCriteria: jsonb("eligibility_criteria").notNull(),
  deadline: timestamp("deadline").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CareerOpportunity = typeof careerOpportunities.$inferSelect;
export type InsertCareerOpportunity = typeof careerOpportunities.$inferInsert;

/**
 * Policy documents for RAG.
 */
export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  docType: varchar("doc_type", { length: 100 }).notNull(),
  effectiveDate: timestamp("effective_date").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Document = typeof documents.$inferSelect;
export type InsertDocument = typeof documents.$inferInsert;

/**
 * Document chunks for RAG retrieval.
 */
export const documentChunks = pgTable("document_chunks", {
  id: serial("id").primaryKey(),
  docId: integer("doc_id").notNull(),
  section: varchar("section", { length: 255 }).notNull(),
  content: text("content").notNull(),
  embedding: text("embedding").notNull(), // JSON stringified vector
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DocumentChunk = typeof documentChunks.$inferSelect;
export type InsertDocumentChunk = typeof documentChunks.$inferInsert;

/**
 * Conversation memory for each user.
 */
export const conversationMemory = pgTable("conversation_memory", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  sessionId: varchar("session_id", { length: 255 }).notNull(),
  messages: jsonb("messages").notNull(), // Array of {role, content}
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export type ConversationMemory = typeof conversationMemory.$inferSelect;
export type InsertConversationMemory = typeof conversationMemory.$inferInsert;

/**
 * Long-term facts about users.
 */
export const longTermMemory = pgTable("long_term_memory", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  fact: text("fact").notNull(),
  context: text("context"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export type LongTermMemory = typeof longTermMemory.$inferSelect;
export type InsertLongTermMemory = typeof longTermMemory.$inferInsert;

/**
 * Execution state for pending high-impact actions.
 */
export const executionState = pgTable("execution_state", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  actionType: varchar("action_type", { length: 100 }).notNull(),
  status: actionStatusEnum("status").notNull(),
  approverId: integer("approver_id"),
  actionData: jsonb("action_data").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export type ExecutionState = typeof executionState.$inferSelect;
export type InsertExecutionState = typeof executionState.$inferInsert;

/**
 * Simulated actions table for demo purposes.
 */
export const simulatedActions = pgTable("simulated_actions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  actionType: varchar("action_type", { length: 100 }).notNull(),
  actionData: jsonb("action_data").notNull(),
  result: jsonb("result").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SimulatedAction = typeof simulatedActions.$inferSelect;
export type InsertSimulatedAction = typeof simulatedActions.$inferInsert;
