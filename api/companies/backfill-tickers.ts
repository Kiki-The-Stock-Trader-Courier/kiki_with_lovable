import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { repairEmptyTickers } from "./tickerRepair";

/**
 * DB에 ticker가 비어 있는 nearby_companies 행을 name·map_display_name·description 기준으로 채움.
 * POST /api/companies/backfill-tickers  (헤더: x-sync-token — sync와 동일)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-sync-token");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const syncToken = process.env.COMPANY_SYNC_TOKEN;
  if (syncToken) {
    const received = req.headers["x-sync-token"];
    if (received !== syncToken) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    res.status(503).json({ error: "Supabase server env is not configured" });
    return;
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const result = await repairEmptyTickers(supabase);
    res.status(200).json({
      ok: true,
      ...result,
      hint:
        result.skipped > 0
          ? "skipped 행은 상호가 krxListedMatch 규칙과 맞지 않습니다. sync로 신규 POI를 넣거나 RULES를 확장하세요."
          : undefined,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    res.status(500).json({ error: message, stage: "backfill_tickers" });
  }
}
