import type { VercelRequest, VercelResponse } from "@vercel/node";
import type OpenAI from "openai";
import { getOpenAIClient } from "../openaiClient.js";
import { getKrxQuotesFromYahoo } from "../yahooKrxQuotesCore.js";

/**
 * 하이브리드 퀴즈 API (6번 구조)
 * 1) 클라이언트가 넘긴 지도 원 안 종목 = 근거(allowed)
 * 2) 서버가 Yahoo로 시세 보강(팩트)
 * 3) LLM 1회로 문항 JSON 생성 → 서버가 티커·키 검증
 */

type StockIn = {
  ticker: string;
  name: string;
  sector: string;
  lat?: number;
  lng?: number;
  price?: number;
  changePercent?: number;
};

type QuizChoice = { key: string; text: string; ticker?: string };
type QuizQuestion = {
  id: string;
  prompt: string;
  choices: QuizChoice[];
  correctKey: string;
  feedbackWrong?: string;
  difficulty?: number;
};

function normalizeDifficulty(raw: unknown): number {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return 5;
  return Math.min(10, Math.max(1, n));
}

function normalizeTicker(raw: string): string | null {
  const d = String(raw).replace(/\D/g, "");
  if (d.length < 4) return null;
  return d.length <= 6 ? d.padStart(6, "0") : d.slice(-6);
}

function sendJson(res: VercelResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function validateQuestions(
  questions: QuizQuestion[],
  allowed: Set<string>,
): { ok: true } | { ok: false; reason: string } {
  for (const q of questions) {
    if (!Array.isArray(q.choices) || q.choices.length !== 4) {
      return { ok: false, reason: "each question must have exactly 4 choices" };
    }
    const keys = new Set<string>();
    for (const c of q.choices) {
      if (keys.has(c.key)) return { ok: false, reason: `duplicate choice key ${c.key}` };
      keys.add(c.key);
      if (c.ticker) {
        const t = normalizeTicker(c.ticker);
        if (!t || !allowed.has(t)) return { ok: false, reason: `invalid ticker in choice: ${c.ticker}` };
      }
    }
    if (!keys.has(q.correctKey)) return { ok: false, reason: `correctKey ${q.correctKey} not in choices` };
  }
  return { ok: true };
}

export async function handleQuizHybrid(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, 405, { ok: false, error: "Method not allowed" });
    return;
  }

  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    sendJson(res, 503, { ok: false, error: "OPENAI_API_KEY is not configured on the server" });
    return;
  }

  let body: {
    centerLat?: number;
    centerLng?: number;
    radiusM?: number;
    stocks?: StockIn[];
  };
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch {
    sendJson(res, 400, { ok: false, error: "Invalid JSON body" });
    return;
  }

  const stocks = Array.isArray(body.stocks) ? body.stocks : [];
  const allowedRows = stocks
    .map((s) => ({
      ticker: normalizeTicker(s.ticker ?? ""),
      name: String(s.name ?? "").trim(),
      sector: String(s.sector ?? "기타").trim(),
      price: Number(s.price),
      changePercent: Number(s.changePercent),
    }))
    .filter((s) => s.ticker != null && s.name.length > 0) as Array<{
    ticker: string;
    name: string;
    sector: string;
    price: number;
    changePercent: number;
  }>;

  const unique = new Map<string, (typeof allowedRows)[number]>();
  for (const r of allowedRows) unique.set(r.ticker, r);
  const deduped = Array.from(unique.values());

  if (deduped.length < 2) {
    sendJson(res, 400, {
      ok: false,
      error: "지도 원 안 상장 종목이 2개 이상 필요합니다. 지도에서 종목을 불러온 뒤 다시 시도해 주세요.",
      code: "INSUFFICIENT_STOCKS",
    });
    return;
  }

  const tickersForQuote = deduped.map((r) => r.ticker).slice(0, 40);
  let quotes: Awaited<ReturnType<typeof getKrxQuotesFromYahoo>> = [];
  try {
    quotes = await getKrxQuotesFromYahoo(tickersForQuote);
  } catch (e) {
    console.warn("[api/quiz/hybrid] quotes:", e);
  }

  const quoteMap = new Map(quotes.map((q) => [q.ticker.replace(/\D/g, "").padStart(6, "0"), q]));

  const contextLines = deduped.map((r) => {
    const q = quoteMap.get(r.ticker);
    const px = q?.price != null && Number.isFinite(q.price) ? `${Math.round(q.price)}원` : "시세 미수신";
    const ch =
      q?.changePercent != null && Number.isFinite(q.changePercent)
        ? `${q.changePercent > 0 ? "+" : ""}${q.changePercent.toFixed(2)}%`
        : "";
    return `- ${r.ticker} ${r.name} (업종:${r.sector}) ${px} ${ch}`.trim();
  });

  const system = [
    "당신은 한국 상장사 퀴즈 출제자입니다.",
    "아래 목록에 있는 종목코드(6자리)와 회사명만 사용하세요. 목록에 없는 회사명·티커를 만들어내지 마세요.",
    "객관식 4지선다. 한국어로만 작성.",
    "각 문항에 difficulty 필수: 정수 1~10 (1=아주 쉬움, 10=어려움). 문항마다 난이도를 다르게 해도 됩니다.",
    "각 문항의 choices는 정확히 4개, key는 영문 대문자 A,B,C,D 고정.",
    "각 선택지에는 반드시 해당하는 ticker(6자리 문자열)를 넣으세요. 보기 텍스트는 짧게.",
    "correctKey는 A,B,C,D 중 하나.",
    "문항 수는 3개(고정).",
    "출력은 JSON 한 개뿐이어야 합니다.",
  ].join("\n");

  const userPayload = {
    task: "퀴즈 생성",
    map_hint: `중심: ${body.centerLat}, ${body.centerLng}, 반경약 ${body.radiusM ?? 1000}m`,
    allowed_companies: contextLines,
    schema: {
      intro: "한두 문장 인사 + 퀴즈 설명",
      questions: [
        {
          id: "q1",
          prompt: "문제 본문",
          choices: [{ key: "A", text: "보기", ticker: "123456" }],
          correctKey: "A",
          difficulty: 5,
          feedbackWrong: "오답 시 짧은 힌트(선택)",
        },
      ],
    },
  };

  let rawText: string;
  try {
    const client = getOpenAIClient();
    const completion = await client.chat.completions.create(
      {
        model: "gpt-4o-mini",
        temperature: 0.4,
        max_tokens: 1800,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: `다음 데이터만 사용해 퀴즈 JSON을 만드세요.\n${JSON.stringify(userPayload)}`,
          },
        ] as OpenAI.ChatCompletionMessageParam[],
      },
      {
        langsmithExtra: {
          name: "quiz-hybrid",
          metadata: { route: "api/quiz/hybrid", companyCount: String(deduped.length) },
          tags: ["quiz", "hybrid"],
        },
      },
    );
    rawText = JSON.stringify(completion);
  } catch (e) {
    console.error("[api/quiz/hybrid] OpenAI:", e);
    sendJson(res, 502, {
      ok: false,
      error: "퀴즈 생성 API 오류",
      detail: e instanceof Error ? e.message : String(e),
    });
    return;
  }

  let intro: string | undefined;
  let questions: QuizQuestion[] | undefined;
  try {
    const outer = JSON.parse(rawText) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = outer.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      sendJson(res, 502, { ok: false, error: "OpenAI 응답에 본문이 없습니다." });
      return;
    }
    const inner = JSON.parse(content) as { intro?: string; questions?: QuizQuestion[] };
    intro = inner.intro;
    questions = inner.questions;
  } catch (e) {
    console.error("[api/quiz/hybrid] parse:", e);
    sendJson(res, 502, { ok: false, error: "퀴즈 JSON 파싱 실패" });
    return;
  }

  if (!intro || !Array.isArray(questions) || questions.length === 0) {
    sendJson(res, 502, { ok: false, error: "퀴즈 형식이 올바르지 않습니다." });
    return;
  }

  const allowedSet = new Set(deduped.map((r) => r.ticker));
  const sliced = questions.slice(0, 3);
  const check = validateQuestions(sliced, allowedSet);
  if (!check.ok) {
    sendJson(res, 502, { ok: false, error: `검증 실패: ${check.reason}` });
    return;
  }

  const withDifficulty = sliced.map((q) => ({
    ...q,
    difficulty: normalizeDifficulty((q as QuizQuestion).difficulty),
  }));

  sendJson(res, 200, {
    ok: true,
    intro,
    questions: withDifficulty,
    meta: {
      hybrid: true,
      companyCount: deduped.length,
      quoteCount: quotes.length,
      centerLat: body.centerLat,
      centerLng: body.centerLng,
      radiusM: body.radiusM ?? 1000,
    },
  });
}
