/**
 * KRX 6자리 → Yahoo Finance 시세 (코스피·코스닥 동시 조회).
 * Vercel `api/quotes` 와 Vite 로컬 미들웨어에서 공통 사용.
 */

export interface KrxLiveQuote {
  ticker: string;
  price: number;
  changePercent: number;
}

interface YahooQuoteRow {
  symbol?: string;
  regularMarketPrice?: number;
  postMarketPrice?: number;
  preMarketPrice?: number;
  bid?: number;
  ask?: number;
  regularMarketPreviousClose?: number;
  regularMarketChangePercent?: number;
}

/** Yahoo가 서버 fetch 에서 가격 필드를 비우는 경우 → 호가 중간·전일 종가 등으로 보강 */
function pickPrice(row: YahooQuoteRow): number | null {
  const { regularMarketPrice, postMarketPrice, preMarketPrice, bid, ask, regularMarketPreviousClose } =
    row;

  const tryNum = (n: number | undefined): number | null =>
    n != null && Number.isFinite(n) && n > 0 ? n : null;

  const rmp = tryNum(regularMarketPrice);
  if (rmp != null) return rmp;

  const pmp = tryNum(postMarketPrice);
  if (pmp != null) return pmp;

  const pre = tryNum(preMarketPrice);
  if (pre != null) return pre;

  const b = tryNum(bid);
  const a = tryNum(ask);
  if (b != null && a != null) return (b + a) / 2;
  if (b != null) return b;
  if (a != null) return a;

  return tryNum(regularMarketPreviousClose);
}

/** Yahoo 가 HTML 에러 페이지를 주면 r.json() 이 throw → Vercel 500. 본문을 문자열로 받고 안전 파싱 */
async function parseJsonBody<T>(r: Response): Promise<T | null> {
  try {
    const text = await r.text();
    if (!text || !text.trim()) return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/** Node/Vercel 기본 UA 는 Yahoo 가 403·빈 결과를 자주 반환 — 브라우저 UA 필수에 가깝게 */
const YAHOO_FETCH_HEADERS: HeadersInit = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "application/json,text/plain,*/*",
  "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
  Referer: "https://finance.yahoo.com/",
};

/** 쿼리 tickers= 문자열 → 6자리 종목코드 배열 */
export function parseTickersQuery(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean)
        .slice(0, 50)
        .map((t) => {
          const d = t.replace(/\D/g, "");
          if (d.length < 4) return "";
          const six = d.length <= 6 ? d.padStart(6, "0") : d.slice(-6);
          return /^\d{6}$/.test(six) ? six : "";
        })
        .filter((t) => t.length === 6),
    ),
  );
}

export async function getKrxQuotesFromYahoo(tickersInput: string[]): Promise<KrxLiveQuote[]> {
  const uniqTickers = Array.from(new Set(tickersInput)).filter((t) => /^\d{6}$/.test(t));
  if (uniqTickers.length === 0) return [];

  try {
  const allSymbols = uniqTickers.flatMap((t) => [`${t}.KS`, `${t}.KQ`]);

  const mapSymbolToTicker = (symbols: string[]) => {
    const m = new Map<string, string>();
    for (const sym of symbols) {
      const u = sym.toUpperCase();
      const base = u.replace(/\.(KS|KQ)$/, "");
      if (/^\d{6}$/.test(base)) m.set(u, base);
    }
    return m;
  };

  const rowToQuote = (row: YahooQuoteRow, symbolToTicker: Map<string, string>): KrxLiveQuote | null => {
    const symU = (row.symbol ?? "").toUpperCase();
    const ticker = symbolToTicker.get(symU);
    if (!ticker) return null;
    const price = pickPrice(row);
    if (price == null) return null;

    let changePercent = row.regularMarketChangePercent;
    if (changePercent == null || Number.isNaN(changePercent)) {
      const prev = row.regularMarketPreviousClose;
      changePercent = prev && prev > 0 ? ((price - prev) / prev) * 100 : 0;
    }

    return { ticker, price, changePercent: Number(changePercent.toFixed(2)) };
  };

  const fetchYahooBatch = async (symbols: string[]): Promise<YahooQuoteRow[]> => {
    if (symbols.length === 0) return [];
    const q = encodeURIComponent(symbols.join(","));
    const hosts = ["https://query1.finance.yahoo.com", "https://query2.finance.yahoo.com"] as const;

    for (const host of hosts) {
      const url = `${host}/v7/finance/quote?symbols=${q}`;
      const r = await fetch(url, { cache: "no-store", headers: YAHOO_FETCH_HEADERS });
      if (!r.ok) {
        console.warn("[yahooKrxQuotesCore] Yahoo HTTP", r.status, host);
        continue;
      }
      const json = await parseJsonBody<{
        quoteResponse?: { result?: YahooQuoteRow[]; error?: unknown };
      }>(r);
      if (!json) {
        console.warn("[yahooKrxQuotesCore] Yahoo non-JSON body", host);
        continue;
      }
      if (json.quoteResponse?.error) {
        console.warn("[yahooKrxQuotesCore] quoteResponse.error:", json.quoteResponse.error);
      }
      const result = Array.isArray(json.quoteResponse?.result) ? json.quoteResponse!.result! : [];
      if (result.length > 0) return result;
    }

    return [];
  };

  /**
   * v7 quote 가 빈 배열·차단일 때 — v8 chart 는 같은 환경에서 더 자주 성공함.
   * 심볼당 1회 호출이므로 배치 실패 후 누락 티커에만 사용.
   */
  const fetchQuoteFromYahooChart = async (
    yahooSymbol: string,
    ticker6: string,
  ): Promise<KrxLiveQuote | null> => {
    const path = encodeURIComponent(yahooSymbol);
    const qs = "interval=1d&range=5d";
    const hosts = ["https://query1.finance.yahoo.com", "https://query2.finance.yahoo.com"] as const;

    for (const host of hosts) {
      const url = `${host}/v8/finance/chart/${path}?${qs}`;
      const r = await fetch(url, { cache: "no-store", headers: YAHOO_FETCH_HEADERS });
      if (!r.ok) continue;

      const json = await parseJsonBody<{
        chart?: {
          result?: Array<{
            meta?: {
              regularMarketPrice?: number;
              chartPreviousClose?: number;
              previousClose?: number;
              regularMarketChangePercent?: number;
            };
            indicators?: { quote?: Array<{ close?: Array<number | null> }> };
            error?: unknown;
          }>;
          error?: unknown;
        };
      }>(r);
      if (!json) continue;

      if (json.chart?.error) continue;
      const first = json.chart?.result?.[0];
      if (!first || first.error) continue;

      const m = first.meta;
      let price: number | null =
        m?.regularMarketPrice != null && Number.isFinite(m.regularMarketPrice) && m.regularMarketPrice > 0
          ? m.regularMarketPrice
          : m?.chartPreviousClose != null &&
              Number.isFinite(m.chartPreviousClose) &&
              m.chartPreviousClose > 0
            ? m.chartPreviousClose
            : m?.previousClose != null && Number.isFinite(m.previousClose) && m.previousClose > 0
              ? m.previousClose
              : null;

      let changePercent: number | undefined = m?.regularMarketChangePercent;

      /** meta 가 비어 있어도 일봉 종가 배열에서 최근가·전봉 추출 (일부 환경에서 meta 만 비는 경우) */
      if (price == null) {
        const closes = first.indicators?.quote?.[0]?.close;
        if (closes?.length) {
          const recent: number[] = [];
          for (let i = closes.length - 1; i >= 0 && recent.length < 2; i--) {
            const v = closes[i];
            if (v != null && Number.isFinite(v) && v > 0) recent.push(v);
          }
          if (recent.length >= 1) {
            price = recent[0];
            const prevBar = recent[1];
            if (changePercent == null || Number.isNaN(changePercent)) {
              changePercent =
                prevBar != null && prevBar > 0 ? ((price - prevBar) / prevBar) * 100 : 0;
            }
          }
        }
      }

      if (price == null) continue;

      if (changePercent == null || Number.isNaN(changePercent)) {
        const prev = m?.chartPreviousClose ?? m?.previousClose;
        changePercent = prev != null && prev > 0 ? ((price - prev) / prev) * 100 : 0;
      }

      return { ticker: ticker6, price, changePercent: Number(changePercent.toFixed(2)) };
    }

    return null;
  };

  /**
   * Yahoo 가 Vercel 등에서 막힐 때 — 네이버 모바일 공개 basic JSON (코스피·코스닥 동일 6자리 코드).
   * 서버 fetch 전용 (브라우저 CORS 아님).
   */
  const fetchQuoteFromNaverMobile = async (ticker6: string): Promise<KrxLiveQuote | null> => {
    const code = ticker6.padStart(6, "0");
    const url = `https://m.stock.naver.com/api/stock/${code}/basic`;
    const headers: HeadersInit = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      Accept: "application/json,*/*",
      Referer: "https://m.stock.naver.com/",
    };
    try {
      const r = await fetch(url, { cache: "no-store", headers });
      if (!r.ok) return null;
      const json = await parseJsonBody<{
        closePrice?: string;
        fluctuationsRatio?: string;
        itemCode?: string;
        overMarketPriceInfo?: { overPrice?: string; fluctuationsRatio?: string };
      }>(r);
      if (!json) return null;

      const priceStr =
        json.closePrice?.replace(/,/g, "").trim() ||
        json.overMarketPriceInfo?.overPrice?.replace(/,/g, "").trim() ||
        "";
      const price = Number(priceStr);
      if (!Number.isFinite(price) || price <= 0) return null;

      const pctStr =
        json.fluctuationsRatio?.replace(/,/g, "").trim() ||
        json.overMarketPriceInfo?.fluctuationsRatio?.replace(/,/g, "").trim() ||
        "0";
      const rawPct = Number(pctStr.replace(/^\+/, ""));
      const changePercent = Number.isFinite(rawPct) ? rawPct : 0;

      return { ticker: code, price, changePercent: Number(changePercent.toFixed(2)) };
    } catch {
      return null;
    }
  };

  const MAX_SYMBOLS = 80;
  const symMap = mapSymbolToTicker(allSymbols);
  const chunks: string[][] = [];
  for (let i = 0; i < allSymbols.length; i += MAX_SYMBOLS) {
    chunks.push(allSymbols.slice(i, i + MAX_SYMBOLS));
  }

  const rows: YahooQuoteRow[] = [];
  for (const part of chunks) {
    const batch = await fetchYahooBatch(part);
    rows.push(...batch);
  }

  const byKs = new Map<string, KrxLiveQuote>();
  const byKq = new Map<string, KrxLiveQuote>();

  for (const row of rows) {
    const symU = (row.symbol ?? "").toUpperCase();
    const q = rowToQuote(row, symMap);
    if (!q) continue;
    if (symU.endsWith(".KS")) byKs.set(q.ticker, q);
    else if (symU.endsWith(".KQ")) byKq.set(q.ticker, q);
  }

  const out: KrxLiveQuote[] = [];

  for (const t of uniqTickers) {
    const primary = byKs.get(t) ?? byKq.get(t);
    if (primary) {
      out.push(primary);
      continue;
    }
    // v7 배치가 비었거나 가격 필드가 비어 매칭 실패 — 한국 종목은 네이버가 Yahoo 차트보다 Vercel에서 안정적
    const fromNaver = await fetchQuoteFromNaverMobile(t);
    if (fromNaver) {
      out.push(fromNaver);
      continue;
    }
    const fromChartKs = await fetchQuoteFromYahooChart(`${t}.KS`, t);
    if (fromChartKs) {
      out.push(fromChartKs);
      continue;
    }
    const fromChartKq = await fetchQuoteFromYahooChart(`${t}.KQ`, t);
    if (fromChartKq) out.push(fromChartKq);
  }

  return out;
  } catch (e) {
    console.error("[yahooKrxQuotesCore] unexpected", e);
    return [];
  }
}
