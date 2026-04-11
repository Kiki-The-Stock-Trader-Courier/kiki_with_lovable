/**
 * 서버(api/*) 전용 — 동적 import 경로가 api/ 아래에만 있어 Vercel 번들에서 안정적입니다.
 * 브라우저는 @/lib/poiTickerResolve 가 여기를 re-export 합니다.
 */
import { resolveListedKrx } from "./krxListedMatch.js";

export interface DbRowForTicker {
  source_place_id: string;
  name: string;
  map_display_name: string | null;
  description: string | null;
  sector: string | null;
}

function stripBranchHints(name: string): string {
  return name
    .replace(/\([^)]{0,40}\)/g, " ")
    .replace(/\[[^\]]{0,40}\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function resolveListedFromDbRow(row: DbRowForTicker) {
  const name = row.name?.trim() ?? "";
  if (!name) return null;
  const extra = [row.map_display_name, row.description].filter(Boolean).join(" ").trim();
  const ctx = { searchExtra: extra || undefined };

  const first = resolveListedKrx(name, ctx);
  if (first) return first;

  const simplified = stripBranchHints(name);
  if (simplified && simplified !== name) {
    return resolveListedKrx(simplified, ctx);
  }
  return null;
}
