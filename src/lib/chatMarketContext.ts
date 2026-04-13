import type { MapQuizStockSnapshot } from "@/contexts/MapQuizContext";
import { MOCK_STOCKS } from "@/data/mockStocks";
import { fetchYahooQuotes, normalizeKrxTickerKey, type LiveQuote } from "@/lib/quoteApi";
import { fetchStockLookupByQuery } from "@/lib/stockLookupApi";

const MAX_TICKERS = 8;

function stripCorpPrefix(name: string): string {
  return name
    .replace(/^\(주\)\s*/u, "")
    .replace(/^㈜\s*/u, "")
    .replace(/^주식회사\s*/u, "")
    .trim();
}

function padSix(raw: string): string | null {
  const d = String(raw).replace(/\D/g, "");
  if (d.length < 4) return null;
  const six = d.length <= 6 ? d.padStart(6, "0") : d.slice(-6);
  return /^\d{6}$/.test(six) ? six : null;
}

/**
 * 사용자 문장·지도 반경 종목·데모 목록에서 KRX 6자리 티커 후보를 모읍니다.
 * (글로벌 챗에서 시세 블록 주입용)
 */
export function collectTickersFromChatMessage(
  userText: string,
  mapStocks: MapQuizStockSnapshot[] | undefined | null,
): string[] {
  const out = new Set<string>();
  const raw = userText.trim();
  if (!raw) return [];
  const compact = raw.replace(/\s+/g, "");

  for (const m of raw.matchAll(/\b(\d{4,6})\b/g)) {
    const p = padSix(m[1]);
    if (p) out.add(p);
  }
  for (const m of compact.matchAll(/(\d{4,6})/g)) {
    const p = padSix(m[1]);
    if (p) out.add(p);
  }

  const tryName = (name: string, ticker: string) => {
    const full = stripCorpPrefix(name).trim();
    if (!full) return;
    if (raw.includes(full) || compact.includes(full.replace(/\s/g, ""))) {
      const k = normalizeKrxTickerKey(ticker);
      if (k) out.add(k);
      return;
    }
    for (const seg of full.split(/[\s·,/]+/).filter((p) => p.length >= 2)) {
      if (raw.includes(seg) || compact.includes(seg)) {
        const k = normalizeKrxTickerKey(ticker);
        if (k) out.add(k);
        break;
      }
    }
  };

  for (const row of mapStocks ?? []) {
    tryName(row.name, row.ticker);
  }
  for (const s of MOCK_STOCKS) {
    tryName(s.name, s.ticker);
  }

  return Array.from(out).slice(0, MAX_TICKERS);
}

/** 주가·시세·지표 키워드 */
export function looksLikeStockPriceQuestion(text: string): boolean {
  const t = text.trim();
  if (/퀴즈|quiz|문제\s*\d|오늘의\s*주식\s*퀴즈/i.test(t)) return false;
  return /주가|시세|현재가|호가|체결|거래량|거래대금|\bPER\b|\bPBR\b|ROE|시가총액|얼마|전일대비|등락률|52주/i.test(t);
}

/** 종목·투자·기업 일반 질문 (주가라는 말이 없어도 검색 시도) */
export function looksLikeStockOrCompanyTopic(text: string): boolean {
  const t = text.trim();
  if (shouldAvoidStockLookup(t)) return false;
  return /주식|종목|기업|회사|코스피|코스닥|상장|실적|배당|PER|PBR|EPS|ROE|ROI|매수|매도|투자|차트|전망|호가|거래량|시가총액|등락|전일|공시|어닝|재무|밸류|시세|주가|청약|공모|배당금|액면분할|무상증자|분석|해설|의견/i.test(
    t,
  );
}

function shouldAvoidStockLookup(t: string): boolean {
  const s = t.trim();
  if (/오늘의\s*주식\s*퀴즈|주식\s*퀴즈\s*!|퀴즈\s*시작|문제\s*\d|quiz/i.test(s)) return true;
  /** 걸음·목표·달성 등 앱 걷기 도메인 — 종목 검색·시세 블록이 붙으면 답이 이상해짐 */
  if (
    /걸음\s*목표|목표\s*걸음|목표\s*\d{3,5}\s*보|평균으로\s*바꿔|7000보|만\s*보|걸음\s*수|하루\s*걸음|오늘\s*걸음|평균\s*걸음/i.test(
      s,
    )
  ) {
    return true;
  }
  /** '목표 걸음 … 달성 … 좋은 점' 류만 (실적 달성·주가 문장은 제외) */
  if (
    /(?:목표\s*걸음|걸음\s*목표).{0,40}(?:달성|좋은\s*점|장점|효과|이유)/i.test(s) ||
    /(?:달성|좋은\s*점|장점).{0,40}(?:목표\s*걸음|걸음\s*목표)/i.test(s)
  ) {
    return true;
  }
  if (/걸음\s*달성|목표\s*달성\s*(?:하면|시|후|때)/i.test(s) && !/주식|종목|주가|시세|\d{4,6}/.test(s)) {
    return true;
  }
  if (/^(?:안녕|반가|고마워|감사|미안해|하이|hi|hello)[\s!?.]*$/i.test(s)) return true;
  return false;
}

const LOOKUP_DENY_WORDS = new Set([
  "오늘",
  "내일",
  "어제",
  "지금",
  "여기",
  "저기",
  "그게",
  "뭐",
  "왜",
  "어떻게",
  "안녕",
  "반가워",
  "고마워",
  "감사",
  "미안",
  "하이",
  "hello",
  "키키",
  "워키",
  "퀴즈",
  "그만",
  "날씨",
  "몇시",
  /** 걷기/목표 문장 첫 토큰이 종목으로 오인되는 것 방지 */
  "목표",
  "걸음",
  "달성",
]);

function tryExtractPriceAnchoredQuery(raw: string): string | null {
  let m = raw.match(
    /([\uac00-\ud7a3A-Za-z][\uac00-\ud7a3A-Za-z0-9·\s]{1,38}?)\s*(?:의|은|는|이|가)?\s*(?:주가|시세|현재가|주식\s*가격)/,
  );
  if (m) return cleanupEntityName(m[1]);

  m = raw.match(
    /(?:주가|시세|현재가)\s*(?:은|는|가)?\s*[?:]?\s*(?:에\s*대해\s*)?([\uac00-\ud7a3A-Za-z][\uac00-\ud7a3A-Za-z0-9·\s]{1,38})/,
  );
  if (m) return cleanupEntityName(m[1]);

  const stripped = raw
    .replace(/^(?:그|저|이|해당|잘|좀)\s+/u, "")
    .replace(
      /\b(?:알려줘|알려주세요|알려줄래|말해줘|말해|궁금|해줘|주세요|나요|까요|인가요|요)\b/gi,
      " ",
    )
    .replace(/\b(?:주가|시세|현재가|얼마)\b/gi, " ")
    .replace(/[?!.,]/g, " ")
    .trim();
  const tokens = stripped.split(/\s+/).filter((t) => t.length >= 2);
  const koreanTokens = tokens.filter((t) => /[\uac00-\ud7a3]/.test(t));
  const useTokens = koreanTokens.length > 0 ? koreanTokens : tokens;
  if (useTokens.length === 0) return null;
  return cleanupEntityName(useTokens.slice(0, 4).join(" "));
}

/** 문장 앞쪽 한글 토큰(조사 제거) — "카카오가 요즘 어때" → 카카오 */
function extractLeadingHangulCompanyToken(raw: string): string | null {
  const t = raw.trim().split(/[\s,]+/)[0];
  if (!t) return null;
  const word = t.replace(/(은|는|이|가|을|를|의|와|과|도|만|에서|으로)$/u, "");
  if (word.length < 2 || word.length > 12) return null;
  if (!/^[\uac00-\ud7a3]+$/.test(word)) return null;
  if (LOOKUP_DENY_WORDS.has(word)) return null;
  return word;
}

function tryLooseSearchQuery(raw: string): string | null {
  const cleaned = raw
    .replace(/\b(?:알려줘|알려주세요|해줘|주세요|궁금|부탁|좀|제발|도와|말해|설명|정보|대해|대해서)\b/gi, " ")
    .replace(/[?!.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length < 2 || cleaned.length > 42) return null;

  const parts = cleaned.split(/\s+/).filter(Boolean);
  for (const p of parts) {
    const token = p.replace(/(은|는|이|가|을|를|의)$/u, "");
    if (token.length < 2 || token.length > 14) continue;
    if (!/[\uac00-\ud7a3]{2,}/.test(token)) continue;
    if (LOOKUP_DENY_WORDS.has(token)) continue;
    return token;
  }
  return null;
}

function isLikelyStandaloneCompanyName(raw: string): boolean {
  const t = raw.trim();
  if (t.length < 2 || t.length > 20) return false;
  if (shouldAvoidStockLookup(t)) return false;
  if (!/^[\uac00-\ud7a3·\s]+$/u.test(t)) return false;
  return /[\uac00-\ud7a3]{2,}/.test(t) && !/\s{2,}/.test(t);
}

/**
 * 네이버 증권 자동완성에 넘길 검색어 한 가지.
 * — 종목코드/지도/데모에 없을 때 호출. 주가 키워드 없이도 기업명·투자 맥락이면 검색합니다.
 */
export function resolveNaverSearchQuery(userText: string): string | null {
  const raw = userText.replace(/\s+/g, " ").trim();
  if (!raw || shouldAvoidStockLookup(raw)) return null;

  if (looksLikeStockPriceQuestion(raw)) {
    const q = tryExtractPriceAnchoredQuery(raw);
    if (q) return q;
  }

  if (looksLikeStockOrCompanyTopic(raw)) {
    const q = tryExtractPriceAnchoredQuery(raw);
    if (q) return q;
    const lead = extractLeadingHangulCompanyToken(raw);
    if (lead) return lead;
    const loose = tryLooseSearchQuery(raw);
    if (loose) return loose;
  }

  if (isLikelyStandaloneCompanyName(raw)) {
    return cleanupEntityName(raw.trim());
  }

  if (raw.length <= 36 && /[\uac00-\ud7a3]{2,}/.test(raw)) {
    const loose = tryLooseSearchQuery(raw);
    if (loose && !LOOKUP_DENY_WORDS.has(loose)) return loose;
    const lead = extractLeadingHangulCompanyToken(raw);
    if (lead) return lead;
  }

  return null;
}

/**
 * @deprecated 이름 유지 — 내부적으로 resolveNaverSearchQuery 와 동일
 */
export function extractCompanySearchQueryForLookup(userText: string): string | null {
  return resolveNaverSearchQuery(userText);
}

function cleanupEntityName(s: string): string | null {
  const t = s
    .replace(/\s+/g, " ")
    .replace(/\b(?:주식|종목)\b/g, "")
    .trim();
  if (t.length < 2 || t.length > 40) return null;
  return t;
}

function formatMarketCapKrw(n?: number): string | undefined {
  if (n == null || !Number.isFinite(n) || n <= 0) return undefined;
  if (n >= 1e12) return `${(n / 1e12).toFixed(2)}조원`;
  if (n >= 1e8) return `${(n / 1e8).toFixed(1)}억원`;
  return `${Math.round(n).toLocaleString("ko-KR")}원`;
}

function formatYield(y?: number): string | undefined {
  if (y == null || !Number.isFinite(y)) return undefined;
  const pct = y > 0 && y <= 1 ? y * 100 : y;
  return `${Number(pct.toFixed(2))}%`;
}

/** 52주 최저가 대비 현재가 수익률 — 사용자가 ROI·수익률 질문 시 참고용 */
function roiVs52WeekLow(q: LiveQuote): string | undefined {
  const { price, fiftyTwoWeekLow: low } = q;
  if (low == null || low <= 0 || !Number.isFinite(price)) return undefined;
  const r = ((price - low) / low) * 100;
  return `${r >= 0 ? "+" : ""}${r.toFixed(1)}%`;
}

function formatOneQuote(q: LiveQuote): string {
  const lines: string[] = [];
  lines.push(
    `- ${q.ticker}: 현재가 약 ${q.price.toLocaleString("ko-KR")}원, 전일 대비 ${q.changePercent > 0 ? "+" : ""}${q.changePercent}%`,
  );
  if (q.regularMarketPreviousClose != null) {
    lines.push(`  · 전일 종가(참고): 약 ${q.regularMarketPreviousClose.toLocaleString("ko-KR")}원`);
  }
  if (q.regularMarketOpen != null) {
    lines.push(`  · 시가(당일): 약 ${q.regularMarketOpen.toLocaleString("ko-KR")}원`);
  }
  if (q.regularMarketVolume != null) {
    lines.push(`  · 당일 거래량(또는 최종 봉 기준): 약 ${q.regularMarketVolume.toLocaleString("ko-KR")}주`);
  }
  if (q.averageVolume3Month != null) {
    lines.push(`  · 3개월 평균 거래량(참고): 약 ${q.averageVolume3Month.toLocaleString("ko-KR")}주`);
  }
  const mc = formatMarketCapKrw(q.marketCap);
  if (mc) lines.push(`  · 시가총액(참고): 약 ${mc}`);
  if (q.trailingPE != null) lines.push(`  · PER(Trailing, 참고): 약 ${q.trailingPE.toFixed(2)}배`);
  if (q.forwardPE != null) lines.push(`  · Forward PER(참고): 약 ${q.forwardPE.toFixed(2)}배`);
  if (q.priceToBook != null) lines.push(`  · PBR(참고): 약 ${q.priceToBook.toFixed(2)}배`);
  if (q.returnOnEquity != null && Number.isFinite(q.returnOnEquity)) {
    const roe = q.returnOnEquity;
    const pct = Math.abs(roe) <= 1 && Math.abs(roe) > 1e-9 ? roe * 100 : roe;
    lines.push(`  · ROE(참고): 약 ${pct.toFixed(2)}%`);
  }
  if (q.fiftyTwoWeekHigh != null && q.fiftyTwoWeekLow != null) {
    lines.push(
      `  · 52주 최고 / 최저(참고): 약 ${q.fiftyTwoWeekHigh.toLocaleString("ko-KR")}원 / ${q.fiftyTwoWeekLow.toLocaleString("ko-KR")}원`,
    );
  }
  const roi = roiVs52WeekLow(q);
  if (roi) lines.push(`  · 52주 최저가 대비 수익률(참고·단순): 약 ${roi}`);
  if (q.fiftyTwoWeekChangePercent != null) {
    lines.push(`  · 52주 등락률(Yahoo, 참고): 약 ${q.fiftyTwoWeekChangePercent}%`);
  }
  const dy = formatYield(q.dividendYield);
  if (dy) lines.push(`  · 배당수익률(참고): 약 ${dy}`);
  return lines.join("\n");
}

/**
 * 글로벌 챗 시스템 프롬프트에 붙일 [시장 데이터] 블록.
 * 종목코드·지도·데모 목록에 없어도, 주가 의도 + 회사명이면 네이버 검색으로 티커를 붙인 뒤 Yahoo 시세를 조회합니다.
 */
export async function buildGlobalChatMarketContext(
  userMessage: string,
  mapStocks: MapQuizStockSnapshot[] | undefined | null,
): Promise<string> {
  const fromText = collectTickersFromChatMessage(userMessage, mapStocks);
  let tickers = [...fromText];
  let lookupNote = "";

  if (tickers.length === 0) {
    const searchQ = resolveNaverSearchQuery(userMessage);
    if (searchQ) {
      const hit = await fetchStockLookupByQuery(searchQ);
      if (hit?.ok) {
        tickers = [hit.ticker];
        lookupNote = `[종목 매칭 — 네이버 증권 자동완성] 검색어 «${hit.query}» → ${hit.name} (${hit.ticker})${hit.market ? `, ${hit.market}` : ""}`;
      }
    }
  }

  if (tickers.length === 0) return "";

  const quotes = await fetchYahooQuotes(tickers);
  if (quotes.length === 0) {
    return [
      "[시장 데이터]",
      lookupNote,
      `요청 티커: ${tickers.join(", ")} — 시세 API 응답이 비었습니다. 장 운영 시간·심볼(코스피/코스닥)을 확인해 주세요.`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  const body = quotes.map(formatOneQuote).join("\n");
  return [
    "[시장 데이터 — Yahoo Finance 등에서 조회한 스냅샷입니다. 장마감·시간외·공휴일이면 전일 종가에 가깝게 보일 수 있습니다.]",
    lookupNote,
    body,
    "",
    "위 수치를 우선 인용해 주가·등락·거래량·PER·PBR·ROE·52주 범위·배당 등을 설명하세요. 블록에 없는 지표는 추측하지 말고, 있는 범위 안에서만 답하세요. ‘ROI’ 질문이면 위의 52주 최저 대비 수익률·등락률 등을 참고해 설명할 수 있습니다.",
  ]
    .filter(Boolean)
    .join("\n");
}
