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

/** HTML 검색 결과에서 제목·스니펫·URL 추출 (표준 HTML 버전) */
export function extractDdgHtmlResults(html: string, maxResults: number): string[] {
  const parts = html.split('class="links_main links_deep result__body"');
  const out: string[] = [];
  for (let i = 1; i < parts.length && out.length < maxResults; i++) {
    const block = parts[i] ?? "";
    const titleM = block.match(/class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/);
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

/** 차단·레이아웃 변형 시: result__a 블록만 전역 스캔 */
function extractDdgHtmlResultsLoose(html: string, maxResults: number): string[] {
  const out: string[] = [];
  const re =
    /class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]{0,800}?class="result__snippet"[^>]*href="[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null && out.length < maxResults) {
    const url = m[1]?.trim() ?? "";
    const title = decodeBasicEntities(stripTags(m[2] ?? ""));
    const snippet = decodeBasicEntities(stripTags(m[3] ?? ""));
    if (!title && !snippet) continue;
    out.push(`• ${[title, snippet].filter(Boolean).join(" — ")}${url ? ` (${url})` : ""}`);
  }
  return out;
}

/** 캡차·차단 페이지만 배제. ‘검색 결과 0건’ HTML은 result__a가 없을 수 있어 여기서 막지 않습니다. */
function looksLikeDdgBlockedOrEmpty(html: string): boolean {
  const h = html.slice(0, 20000).toLowerCase();
  if (h.length < 400) return true;
  if (/captcha|unusual traffic|are you a robot|forbidden|access denied|rate limit|please enable javascript/i.test(h))
    return true;
  return false;
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

const HTML_HEADERS = {
  "User-Agent": UA,
  Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
  Referer: "https://duckduckgo.com/",
} as const;

async function fetchHtmlSnippetsPost(query: string, max: number): Promise<string[]> {
  const body = new URLSearchParams();
  body.set("q", query);
  const res = await fetch("https://html.duckduckgo.com/html/", {
    method: "POST",
    headers: {
      ...HTML_HEADERS,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });
  if (!res.ok) return [];
  const html = await res.text();
  if (looksLikeDdgBlockedOrEmpty(html)) return [];
  let lines = extractDdgHtmlResults(html, max);
  if (lines.length === 0) lines = extractDdgHtmlResultsLoose(html, max);
  return lines;
}

/** 일부 IP/환경에서는 POST 대신 GET이 결과를 돌려줍니다 (Vercel 등). */
async function fetchHtmlSnippetsGet(query: string, max: number): Promise<string[]> {
  const u = new URL("https://html.duckduckgo.com/html/");
  u.searchParams.set("q", query);
  const res = await fetch(u.toString(), {
    method: "GET",
    headers: { ...HTML_HEADERS },
    redirect: "follow",
  });
  if (!res.ok) return [];
  const html = await res.text();
  if (looksLikeDdgBlockedOrEmpty(html)) return [];
  let lines = extractDdgHtmlResults(html, max);
  if (lines.length === 0) lines = extractDdgHtmlResultsLoose(html, max);
  return lines;
}

async function fetchHtmlSnippets(query: string, max: number): Promise<string[]> {
  const post = await fetchHtmlSnippetsPost(query, max);
  if (post.length > 0) return post;
  return fetchHtmlSnippetsGet(query, max);
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
  /** 투자 유의·리스크 질문은 스니펫에 실릴 키워드를 보강 */
  const wantsRiskContext =
    /투자할\s*때|매수\s*전|주의|조심|유의|리스크|위험|전망|분석|변동성|하락|급등/i.test(user);
  const base = `${stock.name} ${stock.ticker} 주식`;
  if (wantsNews) {
    return `${base} ${user || "최신 뉴스"}`.trim();
  }
  if (wantsRiskContext && user.length > 0) {
    return `${base} ${user} 최근 이슈 실적 리스크`.trim();
  }
  if (user.length > 0) {
    return `${base} ${user}`.trim();
  }
  return `${base} 최신`.trim();
}

/**
 * DuckDuckGo에서 가져온 참고 텍스트 (모델 system 보강용)
 */
/** 한 검색어에 대해 Instant Answer + HTML 스니펫 수집. HTML 스니펫을 얻으면 true. */
async function collectSnippetsForQuery(q: string, chunks: string[]): Promise<boolean> {
  const trimmed = q.trim().slice(0, 500);
  if (!trimmed) return false;

  try {
    const ia = await fetchInstantAnswer(trimmed);
    if (ia.length) chunks.push(...ia);
  } catch {
    /* 무시 */
  }

  try {
    const htmlLines = await fetchHtmlSnippets(trimmed, 10);
    if (htmlLines.length) {
      chunks.push("[검색 결과 스니펫 — 출처·시점은 원문 확인 필요]");
      chunks.push(...htmlLines);
      return true;
    }
  } catch {
    /* 무시 */
  }
  return false;
}

/**
 * 한국 종목은 DDG Instant/HTML이 빈 경우가 많아, 동일 호출 안에서 짧은 대체 검색어를 순차 시도합니다.
 * @param tickerHint - 종목코드(숫자만). 검색문에 티커가 없어도 대체 쿼리에 사용합니다.
 */
export async function duckDuckGoWebContext(
  searchQuery: string,
  maxLen = 4000,
  tickerHint?: string,
): Promise<string> {
  const primary = searchQuery.trim().slice(0, 500);
  if (!primary) return "";

  const chunks: string[] = [];
  let gotHtml = await collectSnippetsForQuery(primary, chunks);

  const padKrx = (raw: string | undefined): string | null => {
    const d = String(raw ?? "").replace(/\D/g, "");
    if (d.length < 4) return null;
    return d.length <= 6 ? d.padStart(6, "0") : d.slice(-6);
  };
  const ticker6 = padKrx(tickerHint) ?? padKrx(primary.match(/(\d{4,6})/)?.[1]) ?? primary.match(/(\d{6})/)?.[1];

  if (!gotHtml) {
    const alts: string[] = [];
    if (ticker6 && /^\d{6}$/.test(ticker6)) {
      alts.push(`${ticker6} KRX stock news`);
      alts.push(`${ticker6} KR stock 뉴스`);
    }
    if (/[가-힣]/.test(primary)) {
      const stripped = primary.replace(/\s*주식\s*/g, " ").trim();
      alts.push(`${stripped} site:news.naver.com`);
      alts.push(`${stripped} news`);
    }
    for (const alt of alts) {
      if (!alt.trim() || alt === primary) continue;
      gotHtml = await collectSnippetsForQuery(alt, chunks);
      if (gotHtml) break;
    }
  }

  let out = chunks.join("\n").trim();
  if (out.length > maxLen) out = `${out.slice(0, maxLen)}\n…(이하 생략)`;
  return out;
}
