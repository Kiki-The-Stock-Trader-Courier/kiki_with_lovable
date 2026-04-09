import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveListedKrx } from "./krxListedMatch";

export interface DbRowForTicker {
  source_place_id: string;
  name: string;
  map_display_name: string | null;
  description: string | null;
  sector: string | null;
}

/** name + map_display_name + description 을 searchExtra 로 넣어 매칭률 상승 */
export function resolveListedFromDbRow(row: DbRowForTicker) {
  const name = row.name?.trim() ?? "";
  if (!name) return null;
  const extra = [row.map_display_name, row.description].filter(Boolean).join(" ").trim();
  return resolveListedKrx(name, { searchExtra: extra || undefined });
}

/**
 * ticker 가 비어 있는 행을 규칙으로 채움. service role 클라이언트 사용.
 */
export async function repairEmptyTickers(supabase: SupabaseClient): Promise<{
  scanned: number;
  updated: number;
  skipped: number;
}> {
  const sel = "source_place_id,name,map_display_name,description,sector";
  const { data: nullRows, error: e1 } = await supabase.from("nearby_companies").select(sel).is("ticker", null);
  const { data: emptyRows, error: e2 } = await supabase.from("nearby_companies").select(sel).eq("ticker", "");

  if (e1 || e2) {
    throw new Error((e1 ?? e2)?.message ?? "fetch failed");
  }

  const seen = new Set<string>();
  const list: DbRowForTicker[] = [];
  for (const r of [...(nullRows ?? []), ...(emptyRows ?? [])] as DbRowForTicker[]) {
    if (seen.has(r.source_place_id)) continue;
    seen.add(r.source_place_id);
    list.push(r);
  }

  let updated = 0;
  let skipped = 0;

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
      skipped += 1;
      continue;
    }
    updated += 1;
  }

  return { scanned: list.length, updated, skipped };
}
