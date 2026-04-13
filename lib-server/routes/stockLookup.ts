import type { VercelRequest, VercelResponse } from "@vercel/node";
import { searchKrxTickerByKeyword } from "../stockLookupNaver.js";

function sendJson(res: VercelResponse, status: number, body: unknown) {
  if (res.writableEnded) return;
  res.statusCode = status;
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

/** GET /api/stock/lookup?q=삼성전자 */
export async function handleStockLookup(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.end();
    return;
  }

  if (req.method !== "GET") {
    sendJson(res, 405, { ok: false, error: "Method not allowed" });
    return;
  }

  const rawQ = req.query?.q;
  const q = Array.isArray(rawQ) ? String(rawQ[0] ?? "") : String(rawQ ?? "");
  const trimmed = q.replace(/\s+/g, " ").trim();

  if (trimmed.length < 2) {
    sendJson(res, 400, { ok: false, error: "q parameter required (min 2 chars)" });
    return;
  }

  try {
    const hit = await searchKrxTickerByKeyword(trimmed);
    if (!hit) {
      sendJson(res, 200, { ok: false, query: trimmed });
      return;
    }
    sendJson(res, 200, {
      ok: true,
      query: trimmed,
      ticker: hit.ticker,
      name: hit.name,
      market: hit.market ?? null,
    });
  } catch (e) {
    console.error("[api/stock/lookup]", e);
    sendJson(res, 200, { ok: false, query: trimmed, error: e instanceof Error ? e.message : "lookup failed" });
  }
}
