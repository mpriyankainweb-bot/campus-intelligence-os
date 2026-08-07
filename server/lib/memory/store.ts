import { getDb } from "../../db";
import {
  conversationMemory,
  longTermMemory,
  executionState,
  InsertConversationMemory,
  InsertLongTermMemory,
  InsertExecutionState,
} from "../../../drizzle/schema";
import { eq } from "drizzle-orm";

/**
 * Conversation memory: per-session chat history.
 */
export async function getConversationMemory(
  userId: number,
  sessionId: string
): Promise<Array<{ role: "user" | "assistant"; content: string }>> {
  const db = await getDb();
  if (!db) return [];

  const record = await db
    .select()
    .from(conversationMemory)
    .where(eq(conversationMemory.userId, userId) && eq(conversationMemory.sessionId, sessionId))
    .limit(1);

  if (record.length === 0) return [];

  try {
    return (record[0].messages as unknown as Array<{
      role: "user" | "assistant";
      content: string;
    }>) ?? [];
  } catch {
    return [];
  }
}

export async function saveConversationMemory(
  userId: number,
  sessionId: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const existing = await db
    .select()
    .from(conversationMemory)
    .where(eq(conversationMemory.userId, userId) && eq(conversationMemory.sessionId, sessionId))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(conversationMemory)
      .set({ messages: messages as any })
      .where(eq(conversationMemory.userId, userId) && eq(conversationMemory.sessionId, sessionId));
  } else {
    await db.insert(conversationMemory).values({
      userId,
      sessionId,
      messages: messages as any,
    });
  }
}

/**
 * Long-term memory: persistent facts about users.
 */
export async function getLongTermMemory(userId: number): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];

  const records = await db
    .select()
    .from(longTermMemory)
    .where(eq(longTermMemory.userId, userId));

  return records.map((r) => r.fact);
}

export async function addLongTermMemory(
  userId: number,
  fact: string,
  context?: string
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.insert(longTermMemory).values({
    userId,
    fact,
    context,
  });
}

/**
 * Execution state: pending high-impact actions.
 */
export async function getPendingActions(
  userId?: number,
  approverId?: number
): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];

  const records = await db
    .select()
    .from(executionState)
    .where(eq(executionState.status, "pending"));

  return records.filter((r) => {
    if (userId && r.userId !== userId) return false;
    if (approverId && r.approverId !== approverId) return false;
    return true;
  });
}

export async function createAction(
  userId: number,
  actionType: string,
  actionData: any,
  approverId?: number
): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .insert(executionState)
    .values({
      userId,
      actionType,
      actionData,
      approverId,
      status: "pending",
    })
    .returning({ id: executionState.id });

  return result[0].id;
}

export async function approveAction(actionId: number, approverId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db
    .update(executionState)
    .set({ status: "approved", approverId })
    .where(eq(executionState.id, actionId));
}

export async function rejectAction(actionId: number, approverId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db
    .update(executionState)
    .set({ status: "rejected", approverId })
    .where(eq(executionState.id, actionId));
}

/**
 * Shared context: in-process only, not persisted.
 * Used to pass data between orchestrator stages within a single request.
 */
export interface SharedContext {
  userId: number;
  sessionId: string;
  userPersona: "student" | "faculty" | "principal";
  intent: string;
  plan: any;
  componentResults: Record<string, any>;
  [key: string]: any;
}

export function createSharedContext(
  userId: number,
  sessionId: string,
  userPersona: "student" | "faculty" | "principal"
): SharedContext {
  return {
    userId,
    sessionId,
    userPersona,
    intent: "",
    plan: null,
    componentResults: {},
  };
}
