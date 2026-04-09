/**
 * DB 행(name·description 등)만으로 KRX 매칭 — 브라우저·API 공통.
 * api/companies/krxListedMatch 의 RULES 를 사용합니다.
 */
import { resolveListedKrx } from "../../api/companies/krxListedMatch";

export interface DbRowForTicker {
  source_place_id: string;
  name: string;
  map_display_name: string | null;
  description: string | null;
  sector: string | null;
}

/** "(여의도점)", "[강남]" 등 지점 접미 — 원문 매칭 실패 시 제거 후 재시도 */
function stripBranchHints(name: string): string {
  return name
    .replace(/\([^)]{0,40}\)/g, " ")
    .replace(/\[[^\]]{0,40}\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** name + map_display_name + description 을 searchExtra 로 넣어 매칭률 상승 */
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
