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
  bid?: number;
  ask?: number;
  regularMarketPreviousClose?: number;
  regularMarketChangePercent?: number;
}

function pickPrice(row: YahooQuoteRow): number | null {
  const nums = [
    row.regularMarketPrice,
    row.postMarketPrice,
    row.bid,
    row.ask,
    row.regularMarketPreviousClose,
  ];
  for (const n of nums) {
    if (n != null && Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

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
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols.join(","))}`;
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error(`Yahoo ${r.status}`);
    const json = (await r.json()) as {
      quoteResponse?: { result?: YahooQuoteRow[]; error?: unknown };
    };
    if (json.quoteResponse?.error) {
      console.warn("[yahooKrxQuotesCore] quoteResponse.error:", json.quoteResponse.error);
    }
    return Array.isArray(json.quoteResponse?.result) ? json.quoteResponse!.result! : [];
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

  return uniqTickers
    .map((t) => byKs.get(t) ?? byKq.get(t))
    .filter((v): v is KrxLiveQuote => v != null);
}
