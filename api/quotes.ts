import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getKrxQuotesFromYahoo, parseTickersQuery } from "./yahooKrxQuotesCore";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const raw = String(req.query.tickers ?? "");
  const uniqTickers = parseTickersQuery(raw);
  if (uniqTickers.length === 0) {
    res.status(400).json({ error: "tickers query required" });
    return;
  }

  try {
    const quotes = await getKrxQuotesFromYahoo(uniqTickers);
    res.status(200).json({ quotes });
  } catch (e) {
    console.error("[api/quotes]", e);
    /** 500 대신 빈 배열 — 앱은 시세만 비고 지도·목록은 유지 */
    res.status(200).json({ quotes: [] });
  }
}
