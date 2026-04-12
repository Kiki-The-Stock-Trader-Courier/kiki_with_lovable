/**
 * 퀴즈·후속 답변 맥락용 저장소.
 * 서버 의도 라우터 기준 company_profile / news_issue / deep_analysis 만 DB(로그인) 또는 게스트 로컬에 누적합니다.
 * FAB 사이드바 대화 목록(globalChatSheetHistory)과 별개이며, 모든 대화는 여전히 그쪽에 표시됩니다.
 */

import { supabase } from "@/lib/supabaseClient";

const GUEST_STORAGE_KEY = "kiki_quiz_ctx_v1:guest";
const MAX_ENTRIES = 40;
const MAX_Q_LEN = 280;
const MAX_A_LEN = 900;
const MAX_CONTEXT_CHARS = 3800;

export const QUIZ_CONTEXT_INTENTS = ["company_profile", "news_issue", "deep_analysis"] as const;
export type QuizContextIntent = (typeof QUIZ_CONTEXT_INTENTS)[number];

export type QuizContextEntry = {
  q: string;
  a: string;
  intent: QuizContextIntent;
  at: number;
};

export function isQuizContextIntent(intent: string | null | undefined): intent is QuizContextIntent {
  return intent != null && (QUIZ_CONTEXT_INTENTS as readonly string[]).includes(intent);
}

function trimQ(s: string): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= MAX_Q_LEN) return t;
  return `${t.slice(0, MAX_Q_LEN - 1)}…`;
}

function trimA(s: string): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= MAX_A_LEN) return t;
  return `${t.slice(0, MAX_A_LEN - 1)}…`;
}

function loadGuestEntries(): QuizContextEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(GUEST_STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr
      .filter(
        (e): e is QuizContextEntry =>
          e != null &&
          typeof e === "object" &&
          typeof (e as QuizContextEntry).q === "string" &&
          typeof (e as QuizContextEntry).a === "string" &&
          typeof (e as QuizContextEntry).at === "number" &&
          isQuizContextIntent((e as QuizContextEntry).intent),
      )
      .sort((a, b) => b.at - a.at)
      .slice(0, MAX_ENTRIES);
  } catch {
    return [];
  }
}

function saveGuestEntries(entries: QuizContextEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch {
    /* quota */
  }
}

/**
 * 채팅 응답 직후 호출: 해당 의도만 저장(로그인 시 Supabase, 비로그인 시 게스트 로컬).
 */
export async function persistQuizContextExchange(params: {
  userId: string | undefined;
  intent: string | null;
  userQuestion: string;
  assistantAnswer: string;
  stock?: { name: string; ticker: string };
}): Promise<void> {
  if (!isQuizContextIntent(params.intent)) return;

  const q = trimQ(params.userQuestion);
  const a = trimA(params.assistantAnswer);
  if (q.length < 4 || a.length < 8) return;
  if (/【문제|답은\s*1~4|퀴즈를 종료|모든 문제를 마쳤어요/i.test(a)) return;

  const intent = params.intent;
  const entry: QuizContextEntry = { q, a, intent, at: Date.now() };

  if (params.userId && supabase) {
    const { error } = await supabase.from("user_quiz_context").insert({
      user_id: params.userId,
      intent,
      question: q,
      answer: a,
      stock_name: params.stock?.name ?? null,
      stock_ticker: params.stock?.ticker ?? null,
    });
    if (error) {
      console.warn("[quizContextMemory] insert failed:", error.message);
    }
    return;
  }

  const prev = loadGuestEntries();
  const next: QuizContextEntry[] = [
    entry,
    ...prev.filter((e) => !(e.q === q && e.a === a && e.intent === intent)),
  ];
  saveGuestEntries(next);
}

async function loadEntriesForUser(userId: string | undefined): Promise<QuizContextEntry[]> {
  if (userId && supabase) {
    const { data, error } = await supabase
      .from("user_quiz_context")
      .select("question,answer,intent,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(MAX_ENTRIES);
    if (error) {
      console.warn("[quizContextMemory] select failed:", error.message);
      return [];
    }
    const rows = (data ?? []) as {
      question: string;
      answer: string;
      intent: string;
      created_at: string;
    }[];
    return rows
      .filter((r) => isQuizContextIntent(r.intent))
      .map((r) => ({
        q: trimQ(r.question),
        a: trimA(r.answer),
        intent: r.intent as QuizContextIntent,
        at: new Date(r.created_at).getTime(),
      }));
  }
  return loadGuestEntries();
}

/** 글로벌 챗 extraSystemContext — 최신 순, 길이 상한 */
export async function fetchQuizContextForSystemPrompt(userId: string | undefined): Promise<string> {
  const entries = await loadEntriesForUser(userId);
  if (entries.length === 0) return "";

  const lines: string[] = [];
  let used = 0;
  for (const e of entries) {
    const block = `- 질문: ${e.q}\n  답 요약: ${e.a}`;
    if (used + block.length > MAX_CONTEXT_CHARS) break;
    lines.push(block);
    used += block.length + 1;
  }

  return [
    "[과거 대화에서 참고할 수 있는 내용 — 아래는 이 사용자와 나눈 최근 질문·답(기업/뉴스/심층 분석 위주)입니다. 일관되게 답하고, 이미 안내한 숫자·사실과 모순되지 않게 하세요.]",
    ...lines,
  ].join("\n");
}

/** 퀴즈 API용 짧은 힌트 */
export async function buildQuizHintsFromQuizContext(
  userId: string | undefined,
  maxLines = 12,
): Promise<string[]> {
  const entries = await loadEntriesForUser(userId);
  const out: string[] = [];
  for (const e of entries) {
    if (out.length >= maxLines) break;
    const hint = `${e.q}`.replace(/\s+/g, " ").trim();
    if (hint.length >= 6 && !out.includes(hint)) out.push(hint.slice(0, 120));
  }
  return out;
}
