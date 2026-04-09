import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getKrxQuotesFromYahoo, parseTickersQuery } from "./yahooKrxQuotesCore";

/** Yahoo 폴백 연쇄 호출 시 기본 타임아웃보다 길게 */
export const config = {
  maxDuration: 60,
};

function json(res: VercelResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("X-API-Quotes", "resilient-v1");
  res.end(payload);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.end();
      return;
    }
    if (req.method !== "GET") {
      json(res, 405, { error: "Method not allowed" });
      return;
    }

    const raw = String(req.query.tickers ?? "");
    const uniqTickers = parseTickersQuery(raw);
    if (uniqTickers.length === 0) {
      json(res, 400, { error: "tickers query required" });
      return;
    }

    let quotes: Awaited<ReturnType<typeof getKrxQuotesFromYahoo>> = [];
    try {
      quotes = await getKrxQuotesFromYahoo(uniqTickers);
    } catch (e) {
      console.error("[api/quotes] getKrxQuotesFromYahoo", e);
    }

    json(res, 200, { quotes });
  } catch (e) {
    console.error("[api/quotes] fatal", e);
    try {
      if (!res.headersSent) {
        json(res, 200, { quotes: [] });
      }
    } catch (e2) {
      console.error("[api/quotes] could not send body", e2);
    }
  }
}
