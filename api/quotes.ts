import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Yahoo·네이버 시세 로직은 동적 import — 모듈 로드 실패 시에도 200+빈 배열로 응답.
 * (정적 import 시 번들/초기화 오류가 나면 Vercel 이 500 을 반환할 수 있음)
 */
function sendJson(res: VercelResponse, status: number, body: unknown) {
  if (res.writableEnded) return;
  const payload = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("X-API-Quotes", "v3-dynamic-import");
  res.end(payload);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.end();
    return;
  }

  if (req.method !== "GET") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  try {
    const yahoo = await import("./yahooKrxQuotesCore.js");
    const raw = String(req.query.tickers ?? "");
    const uniqTickers = yahoo.parseTickersQuery(raw);
    if (uniqTickers.length === 0) {
      sendJson(res, 400, { error: "tickers query required" });
      return;
    }

    let quotes: Array<{ ticker: string; price: number; changePercent: number }> = [];
    try {
      quotes = await yahoo.getKrxQuotesFromYahoo(uniqTickers);
    } catch (e) {
      console.error("[api/quotes] getKrxQuotesFromYahoo", e);
    }

    sendJson(res, 200, { quotes });
  } catch (e) {
    console.error("[api/quotes] handler", e);
    sendJson(res, 200, { quotes: [] });
  }
}
