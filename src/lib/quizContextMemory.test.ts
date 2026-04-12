import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
  fetchQuizContextForSystemPrompt,
  isQuizContextIntent,
  persistQuizContextExchange,
} from "./quizContextMemory";

describe("quizContextMemory", () => {
  const mem: Record<string, string> = {};

  beforeEach(() => {
    Object.keys(mem).forEach((k) => {
      delete mem[k];
    });
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => mem[k] ?? null,
      setItem: (k: string, v: string) => {
        mem[k] = v;
      },
      removeItem: (k: string) => {
        delete mem[k];
      },
      clear: () => {
        Object.keys(mem).forEach((k) => {
          delete mem[k];
        });
      },
      key: (i: number) => Object.keys(mem)[i] ?? null,
      get length() {
        return Object.keys(mem).length;
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("isQuizContextIntent — 세 가지 의도만 true", () => {
    expect(isQuizContextIntent("company_profile")).toBe(true);
    expect(isQuizContextIntent("price_fact")).toBe(false);
    expect(isQuizContextIntent(null)).toBe(false);
  });

  it("게스트: 저장 대상 의도만 로컬에 반영되어 프롬프트에 포함", async () => {
    await persistQuizContextExchange({
      userId: undefined,
      intent: "company_profile",
      userQuestion: "이 회사는 뭐 하는 곳이야?",
      assistantAnswer: "유통·식품 등을 하는 기업입니다.",
    });
    const block = await fetchQuizContextForSystemPrompt(undefined);
    expect(block).toContain("이 회사는 뭐 하는 곳이야");
    expect(block).toContain("과거 대화");
  });

  it("게스트: price_fact 등은 저장하지 않음", async () => {
    await persistQuizContextExchange({
      userId: undefined,
      intent: "price_fact",
      userQuestion: "지금 주가 얼마야?",
      assistantAnswer: "현재가는 시세 API 기준으로 확인됩니다.",
    });
    const block = await fetchQuizContextForSystemPrompt(undefined);
    expect(block).toBe("");
  });
});
