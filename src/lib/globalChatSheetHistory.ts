import type { ChatMessage, StockPin } from "@/types/stock";

export const GLOBAL_CHAT_STORAGE_KEY = "global_chat_sheet_history_v1";

/** 지도 종목 시트 전용 — 플로팅 글로벌 챗(`GLOBAL_CHAT_STORAGE_KEY`)과 분리 */
export const STOCK_SHEET_CHAT_STORAGE_KEY = "kiki_stock_sheet_chat_v1";

/** localStorage에 저장되는 대화 (timestamp는 직렬화 시 문자열일 수 있음) */
export interface StoredGlobalConversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
}

const FILLER_TAIL =
  /(알려줘|알려주세요|해줘|해주세요|부탁해|부탁드립니다|좀 알려줘|좀|요|물어봐|물어봐요|알려줄래|알려줄래요|해줄래|해줄래요|어때|뭐야|얼마야|인가|예요|이에요)\s*$/u;
const FILLER_HEAD = /^(그리고|근데|그럼|있잖아|저|나)\s+/u;

/** 제목에서 뺄 일반 단어(토큰 전체 일치) */
const TITLE_STOP_TOKENS = new Set([
  "여기",
  "거기",
  "그게",
  "이게",
  "뭐",
  "그냥",
  "혹시",
  "그리고",
  "근데",
  "그럼",
  "제가",
  "나는",
  "너는",
  "너가",
  "당신",
  "좀",
  "정말",
  "아주",
  "매우",
  "왜",
  "어떻게",
  "대해",
  "관련한",
  "관련",
  "있는",
  "있어",
  "제발",
  "너한테",
]);

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

/** 공백 기준 토큰만 남겨 짧은 키워드 제목으로 만듭니다(구분은 공백만). */
function keywordTitleFromCleaned(cleaned: string, maxTokens = 5, maxLen = 26): string {
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  const picked: string[] = [];
  for (const rawTok of tokens) {
    const t = rawTok.replace(/^[!?.,:]+|[!?.,:]+$/gu, "").trim();
    if (!t) continue;
    if (t.length === 1 && !/\d/u.test(t)) continue;
    if (TITLE_STOP_TOKENS.has(t)) continue;
    if (picked.includes(t)) continue;
    picked.push(t);
    if (picked.length >= maxTokens) break;
  }
  const joined = picked.join(" ");
  if (joined.length > 0) return makeTitleFromInput(joined, maxLen);
  return makeTitleFromInput(cleaned.replace(/\s+/g, " ").trim(), maxLen);
}

/**
 * 가장 최근 의미 있는 사용자 질문에서 핵심 토큰만 뽑아 짧은 제목으로 씁니다.
 */
export function summarizeConversationTitle(messages: ChatMessage[]): string {
  const userTexts = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content.trim())
    .filter(Boolean);
  if (userTexts.length === 0) return "New chat";

  for (let i = userTexts.length - 1; i >= 0; i--) {
    const raw = userTexts[i];
    if (trivialUserReply(raw)) continue;
    const c = cleanUserLineForTitle(raw);
    if (!c) continue;
    const title = keywordTitleFromCleaned(c);
    if (title.length > 0) return title;
  }

  const last = cleanUserLineForTitle(userTexts[userTexts.length - 1] ?? "");
  return last.length > 0 ? makeTitleFromInput(last, 28) : "New chat";
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

function parseConversationList(raw: string | null): StoredGlobalConversation[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed as StoredGlobalConversation[];
  } catch {
    return null;
  }
}

/** 구버전에서 글로벌 키에 섞였던 종목 시트 대화(id 접두사 `stock-sheet-`) 제거용 */
export function stripStockSheetConversationsFromGlobal(
  list: StoredGlobalConversation[],
): StoredGlobalConversation[] {
  return list.filter((c) => !String(c.id).startsWith("stock-sheet-"));
}

export function readGlobalChatConversationsFromStorage(): StoredGlobalConversation[] | null {
  if (typeof window === "undefined") return null;
  return parseConversationList(window.localStorage.getItem(GLOBAL_CHAT_STORAGE_KEY));
}

function readStockSheetConversationsFromStorage(): StoredGlobalConversation[] {
  if (typeof window === "undefined") return [];
  return parseConversationList(window.localStorage.getItem(STOCK_SHEET_CHAT_STORAGE_KEY)) ?? [];
}

const STORAGE_SYNC_EVENT = "kiki-global-chat-storage";

export function notifyGlobalChatStorageChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(STORAGE_SYNC_EVENT));
}

/**
 * 지도 종목 시트 채팅만 별도 localStorage에 기록합니다.
 * 플로팅 글로벌 챗(`GLOBAL_CHAT_STORAGE_KEY`)과 섞이지 않습니다.
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

  const list = readStockSheetConversationsFromStorage();

  const serialized = JSON.parse(JSON.stringify(messages)) as ChatMessage[];

  const nextConv: StoredGlobalConversation = {
    id: convId,
    title: title.length > 0 ? title : `${stock.name}:`,
    messages: serialized,
    updatedAt: Date.now(),
  };

  const without = list.filter((c) => c.id !== convId);
  const nextList = [nextConv, ...without];

  window.localStorage.setItem(STOCK_SHEET_CHAT_STORAGE_KEY, JSON.stringify(nextList));
}

export function subscribeGlobalChatStorageSync(handler: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(STORAGE_SYNC_EVENT, handler);
  return () => window.removeEventListener(STORAGE_SYNC_EVENT, handler);
}
