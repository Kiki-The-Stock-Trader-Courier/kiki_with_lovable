import type { SupabaseClient } from "@supabase/supabase-js";
import {
  resolveListedFromDbRow,
  type DbRowForTicker,
} from "../../src/lib/poiTickerResolve";

export type { DbRowForTicker };
export { resolveListedFromDbRow };

async function fetchRowsWithEmptyTicker(
  supabase: SupabaseClient,
  sel: string,
): Promise<DbRowForTicker[]> {
  const merged: DbRowForTicker[] = [];

  for (const isNull of [true, false] as const) {
    for (let from = 0; ; from += PAGE_SIZE) {
      let q = supabase.from("nearby_companies").select(sel);
      q = isNull ? q.is("ticker", null) : q.eq("ticker", "");
      const { data, error } = await q.order("source_place_id", { ascending: true }).range(from, from + PAGE_SIZE - 1);
      if (error) throw new Error(error.message);
      const batch = (data ?? []) as DbRowForTicker[];
      merged.push(...batch);
      if (batch.length < PAGE_SIZE) break;
    }
  }

  const seen = new Set<string>();
  const list: DbRowForTicker[] = [];
  for (const r of merged) {
    if (seen.has(r.source_place_id)) continue;
    seen.add(r.source_place_id);
    list.push(r);
  }
  return list;
}

/**
 * ticker 가 비어 있는 행을 규칙으로 채움. service role 클라이언트 사용.
 */
export async function repairEmptyTickers(supabase: SupabaseClient): Promise<{
  scanned: number;
  updated: number;
  skipped: number;
  updateErrors: number;
}> {
  const sel = "source_place_id,name,map_display_name,description,sector";
  const list = await fetchRowsWithEmptyTicker(supabase, sel);

  let updated = 0;
  let skipped = 0;
  let updateErrors = 0;

  /** Supabase REST 기본 행 한도(1000)를 넘기는 빈 ticker 행까지 모두 처리 */
  for (const row of list) {
    const listed = resolveListedFromDbRow(row);
    if (!listed) {
      skipped += 1;
      continue;
    }

    const { error: upErr } = await supabase
      .from("nearby_companies")
      .update({
        ticker: listed.ticker,
        stock_name: listed.stockName,
        map_display_name: listed.mapDisplayName,
        sector: listed.sector ?? row.sector,
        updated_at: new Date().toISOString(),
      })
      .eq("source_place_id", row.source_place_id);

    if (upErr) {
      console.warn("[tickerRepair] update failed:", row.source_place_id, upErr.message);
      updateErrors += 1;
      skipped += 1;
      continue;
    }
    updated += 1;
  }

  return { scanned: list.length, updated, skipped, updateErrors };
}
