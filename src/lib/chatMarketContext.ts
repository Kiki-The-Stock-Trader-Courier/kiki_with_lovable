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

/** 주가·시세·지표 질문으로 보일 때만 네이버 종목 검색 시도 (퀴즈 등 오탐 방지) */
export function looksLikeStockPriceQuestion(text: string): boolean {
  const t = text.trim();
  if (/퀴즈|quiz|문제\s*\d|오늘의\s*주식\s*퀴즈/i.test(t)) return false;
  return /주가|시세|현재가|호가|체결|거래량|거래대금|\bPER\b|\bPBR\b|ROE|시가총액|얼마|전일대비|등락률|52주/i.test(t);
}

/**
 * 네이버 자동완성에 넘길 회사명 후보.
 * 예: "삼성전자 주가 알려줘" → "삼성전자"
 */
export function extractCompanySearchQueryForLookup(userText: string): string | null {
  const raw = userText.replace(/\s+/g, " ").trim();
  if (!looksLikeStockPriceQuestion(raw)) return null;

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
    const searchQ = extractCompanySearchQueryForLookup(userMessage);
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
