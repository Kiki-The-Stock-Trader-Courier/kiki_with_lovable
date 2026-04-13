import { defineConfig, loadEnv } from "vite";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { getKrxQuotesFromYahoo, parseTickersQuery } from "./lib-server/yahooKrxQuotesCore";
import { searchKrxTickerByKeyword } from "./lib-server/stockLookupNaver";
import { awaitLangSmithPendingTraces } from "./lib-server/openaiClient";
import { runChatPipeline } from "./lib-server/chat/pipeline";

/** 로컬 `npm run dev`에서만 — OpenAI 호출을 프록시 (키는 서버 쪽 env에만) */
function openaiChatProxy(openaiKey: string | undefined): Plugin {
  return {
    name: "openai-chat-proxy",
    configureServer(server) {
      server.middlewares.use("/api/chat", (req, res, next) => {
        if (req.method === "OPTIONS") {
          res.setHeader(
            "Access-Control-Expose-Headers",
            "X-Chat-Intent, X-Chat-Model, X-Chat-Router, X-Chat-Intent-Source",
          );
          res.statusCode = 204;
          res.end();
          return;
        }
        if (req.method !== "POST") return next();

        let body = "";
        req.on("data", (c) => {
          body += c;
        });
        req.on("end", async () => {
          try {
            if (!openaiKey) {
              res.statusCode = 503;
              res.setHeader("Content-Type", "application/json");
              res.end(
                JSON.stringify({
                  error: {
                    message:
                      "OPENAI_API_KEY가 없습니다. 프로젝트 루트에 .env 파일을 만들고 OPENAI_API_KEY=sk-... 를 넣어 주세요.",
                  },
                })
              );
              return;
            }
            const json = JSON.parse(body || "{}") as Parameters<typeof runChatPipeline>[0];
            const prevKey = process.env.OPENAI_API_KEY;
            process.env.OPENAI_API_KEY = openaiKey;
            try {
              const result = await runChatPipeline(json);
              res.setHeader(
                "Access-Control-Expose-Headers",
                "X-Chat-Intent, X-Chat-Model, X-Chat-Router, X-Chat-Intent-Source",
              );
              res.setHeader("X-Chat-Intent", result.meta.intent);
              res.setHeader("X-Chat-Model", result.meta.model);
              res.setHeader("X-Chat-Router", result.meta.routerEnabled ? "on" : "off");
              if (result.meta.intentSource) {
                res.setHeader("X-Chat-Intent-Source", result.meta.intentSource);
              }
              if (result.kind === "fixed") {
                res.statusCode = 200;
                res.setHeader("Content-Type", "application/json");
                res.end(
                  JSON.stringify({
                    id: "chatcmpl-fixed",
                    object: "chat.completion",
                    choices: [
                      {
                        index: 0,
                        message: { role: "assistant" as const, content: result.content },
                        finish_reason: "stop",
                      },
                    ],
                  }),
                );
              } else {
                res.statusCode = 200;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify(result.completion));
              }
            } finally {
              await awaitLangSmithPendingTraces();
              if (prevKey !== undefined) process.env.OPENAI_API_KEY = prevKey;
              else delete process.env.OPENAI_API_KEY;
            }
          } catch (e) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: { message: String(e) } }));
          }
        });
      });
    },
  };
}

/** VITE_DEV_API_PROXY 없을 때 로컬에서 /api/quotes 가 동작하도록 (Yahoo 직접 조회) */
function quotesApiLocalPlugin(enabled: boolean): Plugin {
  if (!enabled) {
    return { name: "quotes-api-local-skip", configureServer() {} };
  }
  return {
    name: "quotes-api-local",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.method !== "GET") return next();
        const url = req.url ?? "";
        if (!url.startsWith("/api/quotes")) return next();
        try {
          const q = url.includes("?") ? url.split("?")[1] ?? "" : "";
          const raw = new URLSearchParams(q).get("tickers") ?? "";
          const tickers = parseTickersQuery(raw);
          if (tickers.length === 0) {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "tickers query required" }));
            return;
          }
          const quotes = await getKrxQuotesFromYahoo(tickers);
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ quotes }));
        } catch (e) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }));
        }
      });
    },
  };
}

/** 로컬에서 /api/stock/lookup (네이버 종목명 → 티커) */
function stockLookupApiLocalPlugin(enabled: boolean): Plugin {
  if (!enabled) {
    return { name: "stock-lookup-api-local-skip", configureServer() {} };
  }
  return {
    name: "stock-lookup-api-local",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.method !== "GET") return next();
        const url = req.url ?? "";
        if (!url.startsWith("/api/stock/lookup")) return next();
        try {
          const u = new URL(url, "http://localhost");
          const q = u.searchParams.get("q")?.replace(/\s+/g, " ").trim() ?? "";
          if (q.length < 2) {
            res.statusCode = 400;
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: false, error: "q min length 2" }));
            return;
          }
          const hit = await searchKrxTickerByKeyword(q);
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader("Content-Type", "application/json");
          if (!hit) {
            res.end(JSON.stringify({ ok: false, query: q }));
            return;
          }
          res.end(
            JSON.stringify({
              ok: true,
              query: q,
              ticker: hit.ticker,
              name: hit.name,
              market: hit.market ?? null,
            }),
          );
        } catch (e) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }));
        }
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  /** LangSmith 등: lib-server/openaiClient 가 process.env 를 읽음 */
  for (const key of [
    "OPENAI_API_KEY",
    "CHAT_INTENT_ROUTER",
    "CHAT_INTENT_HYBRID",
    "CHAT_INTENT_CLASSIFIER_MODEL",
    "CHAT_MODEL_DEEP",
    "LANGSMITH_TRACING",
    "LANGSMITH_API_KEY",
    "LANGSMITH_PROJECT",
    "LANGCHAIN_TRACING_V2",
    "LANGCHAIN_API_KEY",
    "LANGCHAIN_PROJECT",
  ] as const) {
    const v = env[key];
    if (v !== undefined && v !== "") process.env[key] = v;
  }
  const openaiKey = env.OPENAI_API_KEY;
  /** 로컬 `npm run dev`에서 배포된 Vercel API로 /api 프록시 (예: https://xxx.vercel.app) */
  const devApiProxy = env.VITE_DEV_API_PROXY?.replace(/\/$/, "");

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
      ...(devApiProxy
        ? {
            proxy: {
              "/api": {
                target: devApiProxy,
                changeOrigin: true,
                secure: true,
              },
            },
          }
        : {}),
    },
    plugins: [
      react(),
      mode === "development" && componentTagger(),
      openaiChatProxy(openaiKey),
      quotesApiLocalPlugin(mode === "development" && !devApiProxy),
      stockLookupApiLocalPlugin(mode === "development" && !devApiProxy),
    ].filter(Boolean) as Plugin[],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
  };
});
