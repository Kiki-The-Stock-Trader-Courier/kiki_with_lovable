import type { VercelRequest, VercelResponse } from "@vercel/node";
import { mergeStockAssistWithDdg } from "../stockChatAssist.js";

/**
 * OpenAI Chat Completions 프록시 — API 키는 서버(Vercel 환경 변수)에만 둡니다.
 * `stockAssist`가 있으면 DuckDuckGo 웹 검색 스니펫을 시스템 메시지에 합쳐 종목 최신 맥락을 보강합니다.
 */
export async function handleChat(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: { message: "Method not allowed" } });
    return;
  }

  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    res.status(503).json({ error: { message: "OPENAI_API_KEY is not configured on the server" } });
    return;
  }

  const body = (typeof req.body === "object" && req.body !== null ? req.body : {}) as {
    messages?: { role: string; content: string }[];
    model?: string;
    max_tokens?: number;
    stockAssist?: { name: string; ticker: string; sector?: string };
  };

  const messages = body.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: { message: "messages array required" } });
    return;
  }

  let outbound = messages;
  if (body.stockAssist?.name && body.stockAssist?.ticker) {
    try {
      outbound = await mergeStockAssistWithDdg(messages, body.stockAssist);
    } catch (e) {
      console.warn("[api/chat] stockAssist DDG merge failed:", e);
    }
  }

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: body.model ?? "gpt-4o-mini",
      messages: outbound,
      max_tokens: body.max_tokens ?? 1100,
    }),
  });

  const text = await r.text();
  res.status(r.status);
  res.setHeader("Content-Type", "application/json");
  res.send(text);
}
