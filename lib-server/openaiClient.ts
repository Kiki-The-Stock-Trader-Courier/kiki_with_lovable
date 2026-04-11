/**
 * OpenAI 공식 SDK + LangSmith 래퍼(선택).
 * LangSmith UI: https://smith.langchain.com — 프로젝트별 호출·토큰·비용(대시보드) 확인.
 *
 * - API 키가 있으면 기본적으로 wrapOpenAI 적용(Vercel에서 TRACING 변수 누락 대응).
 *   끄려면 LANGSMITH_TRACING=false (또는 LANGCHAIN_TRACING=false).
 * - langsmith 패키지의 traceable 은 process.env.LANGSMITH_TRACING / _V2 가 "true" 일 때만
 *   실제로 전송하므로, 감싸기 직전에 applyLangSmithTracingEnvForSdk() 로 맞춤.
 *
 * Vercel 서버리스는 응답 직후 런타임이 종료되어 배치 전송이 끊길 수 있음.
 * 각 API 핸들러 끝에서 awaitLangSmithPendingTraces() 로 전송 완료를 기다립니다.
 */
import OpenAI from "openai";
import { RunTree } from "langsmith";
import { wrapOpenAI } from "langsmith/wrappers/openai";

let singleton: OpenAI | null = null;

function hasLangSmithApiKey(): boolean {
  return !!(process.env.LANGSMITH_API_KEY?.trim() || process.env.LANGCHAIN_API_KEY?.trim());
}

function isLangSmithTracingExplicitlyOff(): boolean {
  const off = (v?: string) => {
    const t = v?.trim().toLowerCase();
    return t === "false" || t === "0" || t === "no" || t === "off";
  };
  return off(process.env.LANGSMITH_TRACING) || off(process.env.LANGCHAIN_TRACING);
}

function shouldUseLangSmith(): boolean {
  if (!hasLangSmithApiKey()) return false;
  if (isLangSmithTracingExplicitlyOff()) return false;
  const raw = process.env.LANGSMITH_TRACING?.trim() ?? process.env.LANGCHAIN_TRACING?.trim();
  if (!raw) return true;
  const lower = raw.toLowerCase();
  return lower === "true" || raw === "1" || lower === "yes" || lower === "on";
}

/** langsmith/dist/env.js isTracingEnabled() 가 true 가 되도록 고정 */
function applyLangSmithTracingEnvForSdk(): void {
  process.env.LANGSMITH_TRACING = "true";
  process.env.LANGSMITH_TRACING_V2 = "true";
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
  if (shouldUseLangSmith()) {
    applyLangSmithTracingEnvForSdk();
    singleton = wrapOpenAI(base, {
      metadata: { app: "kiki-with-lovable" },
    });
  } else {
    singleton = base;
  }
  return singleton;
}

/** 테스트 등에서 싱글톤 초기화가 필요할 때 */
export function resetOpenAIClientForTests(): void {
  singleton = null;
}
