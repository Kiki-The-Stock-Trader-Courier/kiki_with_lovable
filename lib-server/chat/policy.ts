import type { ChatComplexity, ChatIntent } from "./types.js";

export type ChatPolicy = {
  model: string;
  maxTokens: number;
  temperature: number;
  /** 종목 시트일 때만 의미 있음: 네이버·DDG 검색 병합 */
  needsRetrieval: boolean;
};

/** 정책상 답변 불가 주제 — LLM 호출 없이 고정 문구 */
export const CHAT_UNSAFE_FIXED_REPLY =
  "그런 내용에는 답변할 수 없어요. 주식·앱 관련 질문이 있으면 말씀해 주세요.";

function defaultDeepModel(): string {
  const m = process.env.CHAT_MODEL_DEEP?.trim();
  return m && m.length > 0 ? m : "gpt-4o-mini";
}

/**
 * 의도·난이도·종목 여부 → 모델·토큰·검색 여부
 */
export function getChatPolicy(
  intent: ChatIntent,
  complexity: ChatComplexity,
  hasStockAssist: boolean,
): ChatPolicy {
  const deepModel = defaultDeepModel();

  const table: Record<ChatIntent, ChatPolicy> = {
    price_fact: {
      model: "gpt-4o-mini",
      maxTokens: 450,
      temperature: 0.2,
      needsRetrieval: false,
    },
    news_issue: {
      model: "gpt-4o-mini",
      maxTokens: 1100,
      temperature: 0.35,
      needsRetrieval: true,
    },
    company_profile: {
      model: "gpt-4o-mini",
      maxTokens: 900,
      temperature: 0.3,
      needsRetrieval: true,
    },
    how_to_use_app: {
      model: "gpt-4o-mini",
      maxTokens: 500,
      temperature: 0.2,
      needsRetrieval: false,
    },
    smalltalk: {
      model: "gpt-4o-mini",
      maxTokens: 300,
      temperature: 0.65,
      needsRetrieval: false,
    },
    deep_analysis: {
      model: deepModel,
      maxTokens: 1500,
      temperature: 0.4,
      needsRetrieval: true,
    },
    general: {
      model: "gpt-4o-mini",
      maxTokens: 900,
      temperature: 0.35,
      needsRetrieval: hasStockAssist,
    },
    unsafe: {
      model: "gpt-4o-mini",
      maxTokens: 0,
      temperature: 0,
      needsRetrieval: false,
    },
  };

  let p: ChatPolicy = { ...table[intent] };

  if (intent !== "unsafe" && intent !== "smalltalk" && complexity === "high") {
    p = { ...p, maxTokens: Math.min(p.maxTokens + 250, 2000) };
  }
  if (intent === "general" && complexity === "low") {
    p = { ...p, maxTokens: Math.min(p.maxTokens, 650) };
  }

  if (!hasStockAssist) {
    p = { ...p, needsRetrieval: false };
  }

  return p;
}
