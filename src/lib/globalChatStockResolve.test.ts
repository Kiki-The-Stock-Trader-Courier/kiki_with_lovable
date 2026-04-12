import { describe, expect, it } from "vitest";
import { resolveStockPinFromMapMessage } from "./globalChatStockResolve";
import type { MapQuizStockSnapshot } from "@/contexts/MapQuizContext";

const sample: MapQuizStockSnapshot[] = [
  {
    ticker: "007070",
    name: "GS리테일",
    sector: "유통",
    lat: 37.5,
    lng: 127.0,
    price: 10000,
    changePercent: 1,
  },
  {
    ticker: "005930",
    name: "삼성전자",
    sector: "전자",
    lat: 37.51,
    lng: 127.01,
    price: 70000,
    changePercent: -0.5,
  },
];

describe("resolveStockPinFromMapMessage", () => {
  it("종목코드로 매칭", () => {
    const pin = resolveStockPinFromMapMessage("007070 주가 알려줘", sample);
    expect(pin?.ticker).toBe("007070");
    expect(pin?.name).toBe("GS리테일");
  });

  it("회사명으로 매칭", () => {
    const pin = resolveStockPinFromMapMessage("삼성전자 전망 어때?", sample);
    expect(pin?.ticker).toBe("005930");
  });

  it("목록 없으면 null", () => {
    expect(resolveStockPinFromMapMessage("삼성전자", [])).toBeNull();
    expect(resolveStockPinFromMapMessage("삼성전자", undefined)).toBeNull();
  });
});
