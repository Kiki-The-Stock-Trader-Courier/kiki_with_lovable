import type { VercelRequest, VercelResponse } from "@vercel/node";
import { awaitLangSmithPendingTraces } from "../openaiClient.js";
import { runChatPipeline } from "../chat/pipeline.js";

/**
 * OpenAI Chat Completions 프록시 — API 키는 서버(Vercel 환경 변수)에만 둡니다.
 * `lib-server/chat/pipeline` 에서 의도별 라우터·RAG(종목 시트)·모델 정책을 적용합니다.
 */
export async function handleChat(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader(
    "Access-Control-Expose-Headers",
    "X-Chat-Intent, X-Chat-Model, X-Chat-Router, X-Chat-Intent-Source",
  );

  if (req.method === "OPTIONS") {
    res.setHeader(
      "Access-Control-Expose-Headers",
      "X-Chat-Intent, X-Chat-Model, X-Chat-Router, X-Chat-Intent-Source",
    );
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

  try {
    const result = await runChatPipeline(body);

    res.setHeader("X-Chat-Intent", result.meta.intent);
    res.setHeader("X-Chat-Model", result.meta.model);
    res.setHeader("X-Chat-Router", result.meta.routerEnabled ? "on" : "off");
    if (result.meta.intentSource) {
      res.setHeader("X-Chat-Intent-Source", result.meta.intentSource);
    }

    if (result.kind === "fixed") {
      res.status(200);
      res.setHeader("Content-Type", "application/json");
      res.send(
        JSON.stringify({
          id: "chatcmpl-fixed",
          object: "chat.completion",
          choices: [{ index: 0, message: { role: "assistant" as const, content: result.content }, finish_reason: "stop" }],
        }),
      );
      return;
    }

    res.status(200);
    res.setHeader("Content-Type", "application/json");
    res.send(JSON.stringify(result.completion));
  } catch (e) {
    console.error("[api/chat] OpenAI:", e);
    res.status(502);
    res.setHeader("Content-Type", "application/json");
    res.send(
      JSON.stringify({
        error: { message: e instanceof Error ? e.message : "OpenAI request failed" },
      }),
    );
  } finally {
    await awaitLangSmithPendingTraces();
  }
}
