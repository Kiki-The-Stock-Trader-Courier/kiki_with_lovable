import type { ChatMessage, StockPin } from "@/types/stock";

export const GLOBAL_CHAT_STORAGE_KEY = "global_chat_sheet_history_v1";

/** localStorage에 저장되는 대화 (timestamp는 직렬화 시 문자열일 수 있음) */
export interface StoredGlobalConversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
}

const FILLER_TAIL =
  /(알려줘|알려주세요|해줘|해주세요|부탁해|부탁드립니다|좀 알려줘|좀|요|물어봐|물어봐요|알려줄래|알려줄래요|해줄래|해줄래요)\s*$/u;
const FILLER_HEAD = /^(그리고|근데|그럼|있잖아|저|나)\s+/u;

function trivialUserReply(text: string): boolean {
  const t = text.replace(/\s+/g, "").trim();
  if (!t) return true;
  if (/^[1-4]$/.test(t)) return true;
  if (/^(그만|종료|중지|스톱|stop)$/i.test(t)) return true;
  return false;
}

/** 사용자 문장에서 제목용 핵심만 남깁니다. */
function cleanUserLineForTitle(raw: string): string {
  let s = raw.replace(/\s+/g, " ").trim();
  s = s.replace(FILLER_HEAD, "").trim();
  s = s.replace(/\s*[!?.,]+$/u, "").trim();
  s = s.replace(FILLER_TAIL, "").trim();
  s = s
    .replace(/[^\p{L}\p{N}\s?!.,:]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  return s;
}

export function makeTitleFromInput(input: string, maxLen = 34): string {
  const compact = input.replace(/\s+/g, " ").trim();
  if (!compact) return "";
  return compact.length > maxLen ? `${compact.slice(0, Math.max(1, maxLen - 1))}…` : compact;
}

/**
 * 최근 사용자 발화부터 최대 3개까지 핵심만 이어 붙여 제목으로 씁니다 (최신이 앞).
 */
export function summarizeConversationTitle(messages: ChatMessage[]): string {
  const userTexts = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content.trim())
    .filter(Boolean);
  if (userTexts.length === 0) return "New chat";

  const parts: string[] = [];
  for (let i = userTexts.length - 1; i >= 0 && parts.length < 3; i--) {
    const raw = userTexts[i];
    if (trivialUserReply(raw)) continue;
    const c = cleanUserLineForTitle(raw);
    if (!c) continue;
    if (parts.includes(c)) continue;
    parts.push(c);
  }

  if (parts.length === 0) {
    const last = cleanUserLineForTitle(userTexts[userTexts.length - 1] ?? "");
    return last.length > 0 ? makeTitleFromInput(last) : "New chat";
  }

  return makeTitleFromInput(parts.join(" · "), 36);
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
  const summaryPart = titleBase && titleBase !== "New chat" ? titleBase : "대화";
  const prefix = `${stock.name}:`;
  const combined = `${prefix} ${summaryPart}`;
  const title = makeTitleFromInput(combined, 40);

  const list = readGlobalChatConversationsFromStorage() ?? [];

  const serialized = JSON.parse(JSON.stringify(messages)) as ChatMessage[];

  const nextConv: StoredGlobalConversation = {
    id: convId,
    title: title.length > 0 ? title : `${stock.name}:`,
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
