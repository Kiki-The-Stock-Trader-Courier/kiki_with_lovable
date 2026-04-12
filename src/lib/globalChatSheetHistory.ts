import type { ChatMessage, StockPin } from "@/types/stock";

export const GLOBAL_CHAT_STORAGE_KEY = "global_chat_sheet_history_v1";

/** localStorage에 저장되는 대화 (timestamp는 직렬화 시 문자열일 수 있음) */
export interface StoredGlobalConversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
}

export function makeTitleFromInput(input: string): string {
  const compact = input.replace(/\s+/g, " ").trim();
  return compact.length > 22 ? `${compact.slice(0, 22)}…` : compact;
}

export function summarizeConversationTitle(messages: ChatMessage[]): string {
  const userMessages = messages.filter((m) => m.role === "user").map((m) => m.content.trim()).filter(Boolean);
  if (userMessages.length === 0) return "New chat";

  const latest = userMessages[userMessages.length - 1]
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}\s?!.,]/gu, "")
    .trim();

  const softened = latest.replace(
    /(알려줘|알려주세요|해줘|해주세요|부탁해|부탁드립니다|좀 알려줘|좀|요)\s*$/u,
    "",
  );

  const normalized = softened.length > 0 ? softened : latest;
  if (normalized.length > 0) return makeTitleFromInput(normalized);
  return "New chat";
}

export function createConversation(): StoredGlobalConversation {
  const id = `c-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  return {
    id,
    title: "New chat",
    messages: [],
    updatedAt: Date.now(),
  };
}

export function readGlobalChatConversationsFromStorage(): StoredGlobalConversation[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(GLOBAL_CHAT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed as StoredGlobalConversation[];
  } catch {
    return null;
  }
}

const STORAGE_SYNC_EVENT = "kiki-global-chat-storage";

export function notifyGlobalChatStorageChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(STORAGE_SYNC_EVENT));
}

/**
 * 지도 종목 시트 채팅 내용을 글로벌 챗 히스토리(localStorage)에 반영합니다.
 * 사용자 메시지가 있을 때만 기록합니다.
 */
export function upsertStockSheetConversation(
  stock: Pick<StockPin, "name" | "ticker">,
  messages: ChatMessage[],
): void {
  if (typeof window === "undefined") return;
  if (!messages.some((m) => m.role === "user")) return;

  const convId = `stock-sheet-${String(stock.ticker).trim()}`;
  const titleBase = summarizeConversationTitle(messages);
  const title =
    titleBase && titleBase !== "New chat" ? titleBase : `${stock.name}(${stock.ticker})`;

  const list = readGlobalChatConversationsFromStorage() ?? [];

  const serialized = JSON.parse(JSON.stringify(messages)) as ChatMessage[];

  const nextConv: StoredGlobalConversation = {
    id: convId,
    title: title.length > 0 ? title : `${stock.name}(${stock.ticker})`,
    messages: serialized,
    updatedAt: Date.now(),
  };

  const without = list.filter((c) => c.id !== convId);
  const nextList = [nextConv, ...without];

  window.localStorage.setItem(GLOBAL_CHAT_STORAGE_KEY, JSON.stringify(nextList));
  notifyGlobalChatStorageChanged();
}

export function subscribeGlobalChatStorageSync(handler: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(STORAGE_SYNC_EVENT, handler);
  return () => window.removeEventListener(STORAGE_SYNC_EVENT, handler);
}
