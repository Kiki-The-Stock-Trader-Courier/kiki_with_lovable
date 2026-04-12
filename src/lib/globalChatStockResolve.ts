import type { MapQuizStockSnapshot } from "@/contexts/MapQuizContext";
import type { StockPin } from "@/types/stock";

function normTicker(t: string): string {
  return String(t).replace(/\D/g, "").padStart(6, "0");
}

/** 지도 퀴즈 스냅샷 한 줄 → 종목 시트 챗과 동일한 StockPin (검색 보강용) */
export function mapSnapshotRowToStockPin(row: MapQuizStockSnapshot): StockPin {
  return {
    id: `nearby-${row.ticker}`,
    ticker: row.ticker,
    name: row.name,
    lat: row.lat ?? 0,
    lng: row.lng ?? 0,
    price: Number.isFinite(row.price) ? row.price : 0,
    changePercent: Number.isFinite(row.changePercent) ? row.changePercent : 0,
    sector: row.sector,
    description: "",
    isSponsored: false,
  };
}

function stripCorpPrefix(name: string): string {
  return name
    .replace(/^\(주\)\s*/u, "")
    .replace(/^㈜\s*/u, "")
    .replace(/^주식회사\s*/u, "")
    .trim();
}

/**
 * 지도 반경에 로드된 종목 목록에서, 사용자 문장에 언급된 기업을 하나 고릅니다.
 * (FAB 글로벌 챗에서 종목 시트와 동일하게 `askStockAssistant` + 서버 검색 보강을 쓰기 위함)
 */
export function resolveStockPinFromMapMessage(
  userText: string,
  stocks: MapQuizStockSnapshot[] | undefined | null,
): StockPin | null {
  const list = stocks ?? [];
  if (list.length === 0) return null;

  const raw = userText.trim();
  if (!raw) return null;
  const compact = raw.replace(/\s+/g, "");

  // 6자리(또는 4~6자리) 종목코드
  const codeMatch = raw.match(/\b(\d{4,6})\b/) ?? compact.match(/(\d{4,6})/);
  if (codeMatch) {
    const pad = codeMatch[1].padStart(6, "0");
    const row = list.find((s) => normTicker(s.ticker) === pad);
    if (row) return mapSnapshotRowToStockPin(row);
  }

  type Scored = { row: MapQuizStockSnapshot; score: number };
  const scored: Scored[] = [];

  for (const row of list) {
    const fullName = stripCorpPrefix(row.name).trim();
    if (!fullName) continue;

    if (raw.includes(fullName) || compact.includes(fullName.replace(/\s/g, ""))) {
      scored.push({ row, score: Math.min(100, fullName.length + 10) });
      continue;
    }

    const segments = fullName.split(/[\s·,/]+/).filter((p) => p.length >= 2);
    for (const seg of segments) {
      if (raw.includes(seg) || compact.includes(seg)) {
        scored.push({ row, score: seg.length });
        break;
      }
    }
  }

  if (scored.length === 0) return null;

  scored.sort((a, b) => b.score - a.score);
  const top = scored[0].score;
  const best = scored.filter((s) => s.score === top);
  best.sort((a, b) => b.row.name.length - a.row.name.length);
  return mapSnapshotRowToStockPin(best[0].row);
}
