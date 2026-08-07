import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json, decimal, float, boolean, index } from "drizzle-orm/mysql-core";

/**
 * Core user table with persona support for Campus Intelligence OS.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  fullName: text("fullName"),
  email: varchar("email", { length: 320 }),
  persona: mysqlEnum("persona", ["student", "faculty", "principal"]).notNull(),
  department: varchar("department", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Academic records for students.
 */
export const academicRecords = mysqlTable("academic_records", {
  id: int("id").autoincrement().primaryKey(),
  studentId: int("student_id").notNull(),
  course: varchar("course", { length: 255 }).notNull(),
  attendancePercent: decimal("attendance_percent", { precision: 5, scale: 2 }).notNull(),
  standing: mysqlEnum("standing", ["good", "probation", "warning"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AcademicRecord = typeof academicRecords.$inferSelect;
export type InsertAcademicRecord = typeof academicRecords.$inferInsert;

/**
 * Career opportunities available to students.
 */
export const careerOpportunities = mysqlTable("career_opportunities", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  eligibilityCriteria: json("eligibility_criteria").notNull(),
  deadline: timestamp("deadline").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CareerOpportunity = typeof careerOpportunities.$inferSelect;
export type InsertCareerOpportunity = typeof careerOpportunities.$inferInsert;

/**
 * Policy documents for RAG.
 */
export const documents = mysqlTable("documents", {
  id: int("id").autoincrement().primaryKey(),
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
export const documentChunks = mysqlTable("document_chunks", {
  id: int("id").autoincrement().primaryKey(),
  docId: int("doc_id").notNull(),
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
export const conversationMemory = mysqlTable("conversation_memory", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  sessionId: varchar("session_id", { length: 255 }).notNull(),
  messages: json("messages").notNull(), // Array of {role, content}
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ConversationMemory = typeof conversationMemory.$inferSelect;
export type InsertConversationMemory = typeof conversationMemory.$inferInsert;

/**
 * Long-term facts about users.
 */
export const longTermMemory = mysqlTable("long_term_memory", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  fact: text("fact").notNull(),
  context: text("context"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type LongTermMemory = typeof longTermMemory.$inferSelect;
export type InsertLongTermMemory = typeof longTermMemory.$inferInsert;

/**
 * Execution state for pending high-impact actions.
 */
export const executionState = mysqlTable("execution_state", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  actionType: varchar("action_type", { length: 100 }).notNull(),
  status: mysqlEnum("status", ["pending", "approved", "rejected", "executed"]).notNull(),
  approverId: int("approver_id"),
  actionData: json("action_data").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ExecutionState = typeof executionState.$inferSelect;
export type InsertExecutionState = typeof executionState.$inferInsert;

/**
 * Simulated actions table for demo purposes.
 */
export const simulatedActions = mysqlTable("simulated_actions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  actionType: varchar("action_type", { length: 100 }).notNull(),
  actionData: json("action_data").notNull(),
  result: json("result").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SimulatedAction = typeof simulatedActions.$inferSelect;
export type InsertSimulatedAction = typeof simulatedActions.$inferInsert;