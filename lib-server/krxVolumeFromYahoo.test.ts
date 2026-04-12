import { describe, expect, it } from "vitest";
import { shouldFetchYahooVolumeForMessage } from "./krxVolumeFromYahoo";

describe("shouldFetchYahooVolumeForMessage", () => {
  it("거래량·주간 표현이면 true", () => {
    expect(shouldFetchYahooVolumeForMessage("최근 1주일 거래량 알려줘")).toBe(true);
    expect(shouldFetchYahooVolumeForMessage("일주일 동안 거래량")).toBe(true);
  });

  it("재무만 묻고 거래량 없으면 false", () => {
    expect(shouldFetchYahooVolumeForMessage("PER이 너무 높은지 봐줘")).toBe(false);
  });

  it("재무+거래량이면 true", () => {
    expect(shouldFetchYahooVolumeForMessage("재무상태랑 거래량 둘 다")).toBe(true);
  });
});
