import { describe, expect, it } from "vitest";
import { inferComplexity, routeChatIntent } from "./router";

describe("routeChatIntent", () => {
  it("종목 시트에서 주가+의미(해석) 질문 → deep_analysis", () => {
    expect(routeChatIntent("지금 주가는 어떤 의미야?", true)).toBe("deep_analysis");
  });

  it("종목 시트에서 단순 시세 질문 → price_fact", () => {
    expect(routeChatIntent("지금 주가 얼마야?", true)).toBe("price_fact");
  });

  it("투자 유의 질문(퀵프롬프트) → deep_analysis", () => {
    expect(routeChatIntent("투자할 때 주의할 점은?", true)).toBe("deep_analysis");
  });

  it("종목 시트에서 주간 거래량 질문 → deep_analysis", () => {
    expect(routeChatIntent("최근 1주일간 거래량 알려줘", true)).toBe("deep_analysis");
  });

  it("종목 시트에서 재무 질문 → deep_analysis", () => {
    expect(routeChatIntent("이 회사 재무상태 어때?", true)).toBe("deep_analysis");
  });

  it("종목 시트에서 뉴스 → news_issue", () => {
    expect(routeChatIntent("최근 뉴스 있어?", true)).toBe("news_issue");
  });

  it("종목 시트에서 투자·전망 → deep_analysis", () => {
    expect(routeChatIntent("앞으로 전망이 어때?", true)).toBe("deep_analysis");
  });

  it("민감 패턴 → unsafe", () => {
    expect(routeChatIntent("불법 다운 받는 법", false)).toBe("unsafe");
  });
});

describe("inferComplexity", () => {
  it("긴 질문 → high", () => {
    expect(inferComplexity("a".repeat(210))).toBe("high");
  });

  it("짧은 질문 → low", () => {
    expect(inferComplexity("응")).toBe("low");
  });
});
