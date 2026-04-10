import type { ChatMessage, ChatSession } from "@/types/stock";

const STORAGE_KEY = "kiki_chat_sessions_v1";

type SerializedMessage = Omit<ChatMessage, "timestamp"> & { timestamp: string };
type SerializedSession = Omit<ChatSession, "messages"> & { messages: SerializedMessage[] };

function serialize(sessions: ChatSession[]): string {
  const payload: SerializedSession[] = sessions.map((s) => ({
    ...s,
    messages: s.messages.map((m) => ({
      ...m,
      timestamp: m.timestamp.toISOString(),
    })),
  }));
  return JSON.stringify(payload);
}

function deserialize(json: string): ChatSession[] {
  const raw = JSON.parse(json) as SerializedSession[];
  if (!Array.isArray(raw)) return [];
  return raw.map((s) => ({
    ...s,
    messages: (s.messages ?? []).map((m) => ({
      ...m,
      timestamp: new Date(m.timestamp),
    })),
  }));
}

export function loadChatSessions(): ChatSession[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return deserialize(raw);
  } catch {
    return null;
  }
}

export function saveChatSessions(sessions: ChatSession[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, serialize(sessions));
  } catch {
    // 용량/비공개 모드 등 — 무시
  }
}
