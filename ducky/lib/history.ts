/**
 * Lists a student's saved problem sets (chat transcripts) so they can reopen
 * any of them. Reads `chat_histories` (owner-only RLS) and falls back to this
 * browser's localStorage if the table is unavailable.
 */
import { createClient } from "./supabase/client";
import { CLASS_BY_ID } from "./classes";
import { PROBLEM_SETS } from "./problemSets";
import type { ChatMessage } from "./types";

export interface PastSet {
  sessionId: string;
  title: string;
  course: string | null;
  href: string;
  messageCount: number;
  studentTurns: number;
  updatedAt: string | null;
  preview: string;
}

/** Known problems from the problem-set catalog, keyed by session id. */
const KNOWN = new Map<string, { title: string; course: string }>();
for (const set of PROBLEM_SETS) {
  const record = CLASS_BY_ID[set.classId];
  set.sessionIds.forEach((sessionId, i) => {
    KNOWN.set(sessionId, {
      title: `Problem Set ${set.number} · ${set.title} · Problem ${i + 1}`,
      course: record ? `${record.course} · ${record.name}` : "",
    });
  });
}

function summarize(sessionId: string, messages: ChatMessage[], updatedAt: string | null): PastSet {
  const known = KNOWN.get(sessionId);
  const firstStudent = messages.find((m) => m.role === "student")?.text ?? "";
  return {
    sessionId,
    title: known?.title ?? `Problem set ${sessionId}`,
    course: known?.course ?? null,
    href: `/session/${sessionId}`,
    messageCount: messages.length,
    studentTurns: messages.filter((m) => m.role === "student").length,
    updatedAt,
    preview: firstStudent.slice(0, 140),
  };
}

function readLocalAll(userId: string): PastSet[] {
  const out: PastSet[] = [];
  try {
    const prefix = `ducky:chat:${userId}:`;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(prefix)) continue;
      const parsed = JSON.parse(localStorage.getItem(key) ?? "null");
      if (Array.isArray(parsed) && parsed.length) out.push(summarize(key.slice(prefix.length), parsed, null));
    }
  } catch {
    // Storage blocked.
  }
  return out;
}

export async function listPastSets(userId: string): Promise<PastSet[]> {
  const { data, error } = await createClient()
    .from("chat_histories")
    .select("session_id, messages, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error || !data) return readLocalAll(userId);
  return data
    .filter((r) => Array.isArray(r.messages) && r.messages.length > 1)
    .map((r) => summarize(r.session_id as string, r.messages as ChatMessage[], r.updated_at as string));
}
