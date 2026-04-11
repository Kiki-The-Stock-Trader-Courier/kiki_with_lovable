/**
 * 단일 Vercel 서버리스 엔드포인트 — Hobby 플랜 함수 개수 제한(12) 회피.
 * `vercel.json` 이 `/api/chat`, `/api/quotes` 등을 여기로 리라이트합니다.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleChat } from "../lib-server/routes/chat.js";
import { handleQuotes } from "../lib-server/routes/quotes.js";
import { handleQuizHybrid } from "../lib-server/routes/quizHybrid.js";
import { handleCompaniesNearby } from "../lib-server/companies/nearby.js";
import { handleCompaniesSync } from "../lib-server/companies/sync.js";
import { handleCompaniesBackfillTickers } from "../lib-server/companies/backfill-tickers.js";

function routeKey(req: VercelRequest): string {
  const q = req.query?.__r;
  if (Array.isArray(q)) return String(q[0] ?? "").trim();
  return String(q ?? "").trim();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const key = routeKey(req);
  try {
    switch (key) {
      case "chat":
        return handleChat(req, res);
      case "quotes":
        return handleQuotes(req, res);
      case "quizHybrid":
        return handleQuizHybrid(req, res);
      case "companiesNearby":
        return handleCompaniesNearby(req, res);
      case "companiesSync":
        return handleCompaniesSync(req, res);
      case "companiesBackfillTickers":
        return handleCompaniesBackfillTickers(req, res);
      default:
        res.statusCode = 404;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify({ error: "Unknown API route", hint: "Use vercel rewrites to /api/gw?__r=..." }));
    }
  } catch (e) {
    console.error("[api/gw]", key, e);
    if (!res.writableEnded) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ error: e instanceof Error ? e.message : "gateway error" }));
    }
  }
}
