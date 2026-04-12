import { getOpenAIClient } from "../openaiClient.js";
import type { ChatIntent } from "./types.js";

/** 분류기 출력 허용 (unsafe 제외 — 민감 차단은 규칙 전용) */
const LLM_ALLOWED: readonly ChatIntent[] = [
  "price_fact",
  "news_issue",
  "company_profile",
  "how_to_use_app",
  "smalltalk",
  "deep_analysis",
  "general",
];

export function isHybridIntentClassifierEnabled(): boolean {
  const v = process.env.CHAT_INTENT_HYBRID?.trim().toLowerCase();
  if (v === "false" || v === "0" || v === "off" || v === "no") return false;
  return true;
}

function classifierModel(): string {
  const m = process.env.CHAT_INTENT_CLASSIFIER_MODEL?.trim();
  return m && m.length > 0 ? m : "gpt-4o-mini";
}

/**
 * 규칙 라우터가 `general`로 둔 경우에만 소형 LLM으로 의도를 다시 맞춥니다.
 * 명확한 키워드 매칭(비-general)은 비용·지연을 위해 그대로 신뢰합니다.
 */
export function shouldRefineIntentWithLlm(ruleIntent: ChatIntent, lastUserText: string): boolean {
  if (!isHybridIntentClassifierEnabled()) return false;
  if (ruleIntent !== "general") return false;
  const t = lastUserText.trim();
  if (t.length < 6) return false;
  return true;
}

function buildClassifierPrompt(
  lastUser: string,
  hasStockAssist: boolean,
  stock?: { name: string; ticker: string; sector?: string },
): string {
  const stockCtx = hasStockAssist
    ? `사용자는 지금 앱에서 특정 종목 시트를 보고 있습니다: ${stock?.name ?? ""} (티커 ${stock?.ticker ?? ""}), 업종 ${stock?.sector ?? "미상"}. 질문은 이 종목에 대한 맥락일 수 있습니다.`
    : "종목 시트 없이 앱 전체(걸음·지도·일반) 맥락입니다.";

  return [
    "역할: 마지막 사용자 메시지 하나의 의도만 분류합니다. JSON 한 객체로만 답합니다.",
    "",
    stockCtx,
    "",
    `마지막 사용자 메시지:\n"""${lastUser.slice(0, 4000)}"""`,
    "",
    "intent 값 (정확히 하나 선택):",
    "- price_fact: 현재가·시세·등락·원 단위 등 숫자 시세",
    "- news_issue: 뉴스·공시·이슈·최근 기사",
    "- company_profile: 회사 소개·무슨 일·업종·사업·한줄 요약",
    "- deep_analysis: 투자 판단·리스크·전망·매수/매도 고민·밸류·경쟁, 거래량·주간 거래·재무제표·실적·PER 등 수치·분석 성격",
    "- how_to_use_app: 앱 사용법·워키포인트·걸음·지도·탭",
    "- smalltalk: 인사·감사만 짧게",
    "- general: 위에 명확히 안 맞을 때",
    "",
    '출력 형식: {"intent":"<위 목록 중 하나>"}',
  ].join("\n");
}

function normalizeParsedIntent(raw: unknown): ChatIntent | null {
  if (typeof raw !== "object" || raw === null) return null;
  const intent = (raw as { intent?: unknown }).intent;
  if (typeof intent !== "string") return null;
  const v = intent.trim() as ChatIntent;
  return LLM_ALLOWED.includes(v) ? v : null;
}

/**
 * 규칙이 general일 때만 호출. 실패 시 null → 호출부에서 규칙 intent 유지.
 */
export async function classifyIntentWithLlm(
  lastUserText: string,
  hasStockAssist: boolean,
  stockAssist?: { name: string; ticker: string; sector?: string },
): Promise<ChatIntent | null> {
  const lastUser = lastUserText.trim().slice(0, 4000);
  if (!lastUser) return null;

  const client = getOpenAIClient();
  const completion = await client.chat.completions.create(
    {
      model: classifierModel(),
      temperature: 0,
      max_tokens: 120,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You output only valid JSON with key intent. Values must be exactly one of: price_fact, news_issue, company_profile, deep_analysis, how_to_use_app, smalltalk, general.",
        },
        {
          role: "user",
          content: buildClassifierPrompt(lastUser, hasStockAssist, stockAssist),
        },
      ],
    },
    {
      langsmithExtra: {
        name: "chat-intent-classifier",
        metadata: { hasStockAssist: hasStockAssist ? "yes" : "no" },
        tags: ["intent-classifier", "hybrid"],
      },
    } as Record<string, unknown>,
  );

  const text = completion.choices?.[0]?.message?.content?.trim();
  if (!text) return null;

  try {
    const parsed = JSON.parse(text) as unknown;
    return normalizeParsedIntent(parsed);
  } catch {
    return null;
  }
}

export { LLM_ALLOWED };
