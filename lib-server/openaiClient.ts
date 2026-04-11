/**
 * OpenAI 공식 SDK + LangSmith 래퍼(선택).
 * LANGSMITH_TRACING=true 이고 LANGSMITH_API_KEY(또는 LANGCHAIN_API_KEY)가 있을 때만 wrapOpenAI 적용.
 * LangSmith UI: https://smith.langchain.com — 프로젝트별 호출·토큰·비용(대시보드) 확인.
 *
 * Vercel 서버리스는 응답 직후 런타임이 종료되어 LangSmith 배치 전송이 끊길 수 있음.
 * 각 API 핸들러 끝에서 awaitLangSmithPendingTraces() 로 전송 완료를 기다립니다.
 */
import OpenAI from "openai";
import { RunTree } from "langsmith";
import { wrapOpenAI } from "langsmith/wrappers/openai";

let singleton: OpenAI | null = null;

function shouldUseLangSmith(): boolean {
  if (process.env.LANGSMITH_TRACING !== "true") return false;
  return !!(process.env.LANGSMITH_API_KEY?.trim() || process.env.LANGCHAIN_API_KEY?.trim());
}

/**
 * 서버리스에서 트레이스가 LangSmith까지 나가도록 대기.
 * traceable/wrapOpenAI 가 쓰는 배치 큐는 RunTree.getSharedClient() 와 동일 인스턴스여야 함
 * (new Client() 로 flush 하면 빈 큐만 기다려 추적이 UI에 안 보였음).
 */
export async function awaitLangSmithPendingTraces(): Promise<void> {
  if (!shouldUseLangSmith()) return;
  try {
    await RunTree.getSharedClient().awaitPendingTraceBatches();
  } catch (e) {
    console.warn("[langsmith] awaitPendingTraceBatches:", e);
  }
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
