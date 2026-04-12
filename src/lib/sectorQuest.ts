/**
 * 지도 강조 원 안에 들어온 종목을 업종별로 수집 — 동일 티커는 한 번만 카운트.
 * 업종당 서로 다른 종목 5개 달성 시 보상(캐시) 1회 지급.
 */

export const SECTOR_QUEST_TARGET = 5;
export const SECTOR_QUEST_REWARD_WON = 1000;

export type SectorQuestState = {
  /** 업종(표시 문자열) → 해당 업종에서 원 안에서 발견한 고유 티커(6자리) */
  discoveredBySector: Record<string, string[]>;
  /** 업종별 보상 수령 완료 여부(1회) */
  rewardClaimedBySector: Record<string, boolean>;
};

function normalizeSector(raw: string | null | undefined): string {
  const s = String(raw ?? "기타").trim();
  return s.length > 0 ? s : "기타";
}

export function normalizeTickerKey(raw: string): string {
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length === 0) return "";
  if (digits.length <= 6) return digits.padStart(6, "0");
  return digits.slice(-6);
}

export function emptySectorQuestState(): SectorQuestState {
  return { discoveredBySector: {}, rewardClaimedBySector: {} };
}

/**
 * 원 안에서 새로 발견한 종목 1건 반영. 이미 있던 티커면 보상 없음.
 */
export function applySectorDiscovery(
  prev: SectorQuestState,
  tickerRaw: string,
  sectorRaw: string | null | undefined,
): { next: SectorQuestState; rewardWon: number; newCountInSector: number; justCompleted: boolean } {
  const tick = normalizeTickerKey(tickerRaw);
  const sector = normalizeSector(sectorRaw);
  if (!tick) {
    return {
      next: prev,
      rewardWon: 0,
      newCountInSector: (prev.discoveredBySector[sector] ?? []).length,
      justCompleted: false,
    };
  }

  const existing = [...(prev.discoveredBySector[sector] ?? [])];
  if (existing.includes(tick)) {
    return {
      next: prev,
      rewardWon: 0,
      newCountInSector: existing.length,
      justCompleted: false,
    };
  }

  const merged = [...existing, tick];
  const rewardClaimed = { ...prev.rewardClaimedBySector };
  let rewardWon = 0;
  let justCompleted = false;

  if (merged.length >= SECTOR_QUEST_TARGET && !rewardClaimed[sector]) {
    rewardClaimed[sector] = true;
    rewardWon = SECTOR_QUEST_REWARD_WON;
    justCompleted = true;
  }

  return {
    next: {
      discoveredBySector: { ...prev.discoveredBySector, [sector]: merged },
      rewardClaimedBySector: rewardClaimed,
    },
    rewardWon,
    newCountInSector: merged.length,
    justCompleted,
  };
}

export function getSectorQuestProgress(state: SectorQuestState, sectorRaw: string | null | undefined): {
  count: number;
  target: number;
  rewardClaimed: boolean;
} {
  const sector = normalizeSector(sectorRaw);
  const count = (state.discoveredBySector[sector] ?? []).length;
  return {
    count: Math.min(count, SECTOR_QUEST_TARGET),
    target: SECTOR_QUEST_TARGET,
    rewardClaimed: !!state.rewardClaimedBySector[sector],
  };
}

export function getSectorQuestStorageKey(userId: string | undefined): string {
  return `kiki_sector_quest_v1:${userId ?? "guest"}`;
}

export function loadSectorQuestFromStorage(userId: string | undefined): SectorQuestState {
  if (typeof window === "undefined") return emptySectorQuestState();
  try {
    const raw = window.localStorage.getItem(getSectorQuestStorageKey(userId));
    if (!raw) return emptySectorQuestState();
    const parsed = JSON.parse(raw) as Partial<SectorQuestState>;
    if (!parsed || typeof parsed !== "object") return emptySectorQuestState();
    const discovered = parsed.discoveredBySector;
    const claimed = parsed.rewardClaimedBySector;
    const out: SectorQuestState = {
      discoveredBySector: {},
      rewardClaimedBySector: {},
    };
    if (discovered && typeof discovered === "object") {
      for (const [k, v] of Object.entries(discovered)) {
        if (!Array.isArray(v)) continue;
        const tickers = v
          .map((t) => normalizeTickerKey(String(t)))
          .filter((t) => t.length === 6);
        const uniq = Array.from(new Set(tickers));
        if (uniq.length > 0) out.discoveredBySector[k] = uniq;
      }
    }
    if (claimed && typeof claimed === "object") {
      for (const [k, v] of Object.entries(claimed)) {
        if (v === true) out.rewardClaimedBySector[k] = true;
      }
    }
    return out;
  } catch {
    return emptySectorQuestState();
  }
}

export function saveSectorQuestToStorage(userId: string | undefined, state: SectorQuestState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(getSectorQuestStorageKey(userId), JSON.stringify(state));
  } catch {
    /* ignore */
  }
}
