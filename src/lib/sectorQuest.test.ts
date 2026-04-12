import { describe, expect, it } from "vitest";
import {
  SECTOR_QUEST_REWARD_WON,
  SECTOR_QUEST_TARGET,
  applySectorDiscovery,
  emptySectorQuestState,
} from "./sectorQuest";

describe("applySectorDiscovery", () => {
  it("같은 티커는 한 번만 카운트", () => {
    let s = emptySectorQuestState();
    s = applySectorDiscovery(s, "007070", "유통").next;
    const r2 = applySectorDiscovery(s, "007070", "유통");
    expect(r2.newCountInSector).toBe(1);
    expect(r2.rewardWon).toBe(0);
  });

  it("업종당 5고유 종목이면 보상", () => {
    let s = emptySectorQuestState();
    let reward = 0;
    for (let i = 0; i < SECTOR_QUEST_TARGET; i += 1) {
      const t = String(600000 + i).padStart(6, "0");
      const r = applySectorDiscovery(s, t, "유통");
      s = r.next;
      reward += r.rewardWon;
    }
    expect(reward).toBe(SECTOR_QUEST_REWARD_WON);
  });
});
