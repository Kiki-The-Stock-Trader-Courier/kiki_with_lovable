/**
 * DuckDuckGo 기반 웹 검색 스니펫 (API 키 불필요).
 * - Instant Answer JSON + HTML 검색 결과 파싱
 * - 서버(Vercel)·Vite dev 미들웨어에서 공통 사용
 */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

type DdgRelatedTopic = string | { Text?: string; Topics?: DdgRelatedTopic[]; FirstURL?: string };

type DdgInstantJson = {
  Abstract?: string;
  AbstractURL?: string;
  Answer?: string;
  RelatedTopics?: DdgRelatedTopic[];
};

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function decodeBasicEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function flattenRelated(topics: DdgRelatedTopic[] | undefined, out: string[], depth: number) {
  if (!topics || depth > 3) return;
  for (const t of topics.slice(0, 8)) {
    if (typeof t === "string") {
      if (t.trim()) out.push(`• ${t.trim()}`);
    } else if (t && typeof t === "object") {
      if (t.Text?.trim()) out.push(`• ${t.Text.trim()}`);
      if (Array.isArray(t.Topics)) flattenRelated(t.Topics, out, depth + 1);
    }
  }
}

/** HTML 검색 결과에서 제목·스니펫·URL 추출 */
export function extractDdgHtmlResults(html: string, maxResults: number): string[] {
  const parts = html.split('class="links_main links_deep result__body"');
  const out: string[] = [];
  for (let i = 1; i < parts.length && out.length < maxResults; i++) {
    const block = parts[i] ?? "";
    const titleM = block.match(/class="result__a"[^>]*href="([^"]*)"[^>]*>([^<]*)</);
    const snipM = block.match(/class="result__snippet"[^>]*href="[^"]*"[^>]*>([\s\S]*?)<\/a>/);
    const url = titleM?.[1]?.trim() ?? "";
    const title = titleM?.[2] ? decodeBasicEntities(stripTags(titleM[2])) : "";
    const snippet = snipM?.[1] ? decodeBasicEntities(stripTags(snipM[1])) : "";
    if (!title && !snippet) continue;
    const line = `• ${[title, snippet].filter(Boolean).join(" — ")}${url ? ` (${url})` : ""}`;
    out.push(line);
  }
  return out;
}

async function fetchInstantAnswer(query: string): Promise<string[]> {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) return [];
  const j = (await res.json()) as DdgInstantJson;
  const lines: string[] = [];
  if (j.Abstract?.trim()) {
    lines.push(`[요약] ${j.Abstract.trim()}${j.AbstractURL ? ` (${j.AbstractURL})` : ""}`);
  }
  if (j.Answer?.trim()) lines.push(`[즉답] ${j.Answer.trim()}`);
  const rel: string[] = [];
  flattenRelated(j.RelatedTopics, rel, 0);
  lines.push(...rel.slice(0, 6));
  return lines;
}

async function fetchHtmlSnippets(query: string, max: number): Promise<string[]> {
  const body = new URLSearchParams();
  body.set("q", query);
  const res = await fetch("https://html.duckduckgo.com/html/", {
    method: "POST",
    headers: {
      "User-Agent": UA,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "text/html",
    },
    body: body.toString(),
  });
  if (!res.ok) return [];
  const html = await res.text();
  return extractDdgHtmlResults(html, max);
}

export type StockAssistPayload = {
  name: string;
  ticker: string;
  sector?: string;
};

/**
 * 종목 + 사용자 질문으로 DuckDuckGo 검색어 구성 (한국어 종목·뉴스 의도 반영)
 */
export function buildStockDdgQuery(stock: StockAssistPayload, lastUserMessage: string): string {
  const user = lastUserMessage.replace(/\s+/g, " ").trim().slice(0, 200);
  const wantsNews = /뉴스|news|최신|오늘|최근|헤드라인|속보|기사/i.test(user);
  const base = `${stock.name} ${stock.ticker} 주식`;
  if (wantsNews) {
    return `${base} ${user || "최신 뉴스"}`.trim();
  }
  if (user.length > 0) {
    return `${base} ${user}`.trim();
  }
  return `${base} 최신`.trim();
}

/**
 * DuckDuckGo에서 가져온 참고 텍스트 (모델 system 보강용)
 */
export async function duckDuckGoWebContext(searchQuery: string, maxLen = 4000): Promise<string> {
  const q = searchQuery.trim().slice(0, 500);
  if (!q) return "";

  const chunks: string[] = [];

  try {
    const ia = await fetchInstantAnswer(q);
    if (ia.length) chunks.push(...ia);
  } catch {
    /* 무시 */
  }

  try {
    const htmlLines = await fetchHtmlSnippets(q, 10);
    if (htmlLines.length) {
      chunks.push("[검색 결과 스니펫 — 출처·시점은 원문 확인 필요]");
      chunks.push(...htmlLines);
    }
  } catch {
    /* 무시 */
  }

  let out = chunks.join("\n").trim();
  if (out.length > maxLen) out = `${out.slice(0, maxLen)}\n…(이하 생략)`;
  return out;
}
