import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isHybridIntentClassifierEnabled, shouldRefineIntentWithLlm } from "./intentClassifier";

describe("shouldRefineIntentWithLlm", () => {
  beforeEach(() => {
    vi.stubEnv("CHAT_INTENT_HYBRID", "true");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("규칙이 general이 아니면 보정하지 않음", () => {
    expect(shouldRefineIntentWithLlm("price_fact", "주가 얼마야")).toBe(false);
    expect(shouldRefineIntentWithLlm("deep_analysis", "전망 어때")).toBe(false);
  });

  it("general이어도 메시지가 너무 짧으면 보정하지 않음", () => {
    expect(shouldRefineIntentWithLlm("general", "응")).toBe(false);
    expect(shouldRefineIntentWithLlm("general", "12345")).toBe(false);
  });

  it("general이고 충분한 길이면 보정 대상", () => {
    expect(shouldRefineIntentWithLlm("general", "이거 설명 좀 해줘")).toBe(true);
  });

  it("CHAT_INTENT_HYBRID=off 이면 보정 안 함", () => {
    vi.stubEnv("CHAT_INTENT_HYBRID", "false");
    expect(isHybridIntentClassifierEnabled()).toBe(false);
    expect(shouldRefineIntentWithLlm("general", "이거 설명 좀 해줘")).toBe(false);
  });
});
