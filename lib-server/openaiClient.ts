/**
 * OpenAI 공식 SDK + LangSmith 래퍼(선택).
 * LANGSMITH_TRACING=true 이고 LANGSMITH_API_KEY(또는 LANGCHAIN_API_KEY)가 있을 때만 wrapOpenAI 적용.
 * LangSmith UI: https://smith.langchain.com — 프로젝트별 호출·토큰·비용(대시보드) 확인.
 */
import OpenAI from "openai";
import { wrapOpenAI } from "langsmith/wrappers/openai";

let singleton: OpenAI | null = null;

function shouldUseLangSmith(): boolean {
  if (process.env.LANGSMITH_TRACING !== "true") return false;
  return !!(process.env.LANGSMITH_API_KEY?.trim() || process.env.LANGCHAIN_API_KEY?.trim());
}

export function getOpenAIClient(): OpenAI {
  if (singleton) return singleton;
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  const base = new OpenAI({ apiKey });
  singleton = shouldUseLangSmith()
    ? wrapOpenAI(base, {
        metadata: { app: "kiki-with-lovable" },
      })
    : base;
  return singleton;
}

/** 테스트 등에서 싱글톤 초기화가 필요할 때 */
export function resetOpenAIClientForTests(): void {
  singleton = null;
}
