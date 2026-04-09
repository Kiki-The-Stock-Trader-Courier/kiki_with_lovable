import type { VercelRequest, VercelResponse } from "@vercel/node";

interface YahooQuote {
  symbol: string;
  regularMarketPrice?: number;
  regularMarketPreviousClose?: number;
  regularMarketChangePercent?: number;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const raw = String(req.query.tickers ?? "");
  const tickers = raw
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean)
    .slice(0, 50);
  if (tickers.length === 0) {
    res.status(400).json({ error: "tickers query required" });
    return;
  }

  const uniqTickers = Array.from(new Set(tickers)).filter((t) => /^\d{6}$/.test(t));

  if (uniqTickers.length === 0) {
    res.status(200).json({ quotes: [] });
    return;
  }

  /** 코스피·코스닥 심볼을 한 번에 요청해 왕복 지연을 절반으로 줄임 */
  const allSymbols = uniqTickers.flatMap((t) => [`${t}.KS`, `${t}.KQ`]);

  const mapSymbolToTicker = (symbols: string[]) => {
    const m = new Map<string, string>();
    for (const sym of symbols) {
      const base = sym.replace(/\.(KS|KQ)$/i, "");
      if (/^\d{6}$/.test(base)) m.set(sym, base);
    }
    return m;
  };

  const rowToQuote = (
    row: YahooQuote,
    symbolToTicker: Map<string, string>,
  ): { ticker: string; price: number; changePercent: number } | null => {
    const ticker = row.symbol ? symbolToTicker.get(row.symbol) : undefined;
    if (!ticker) return null;
    const price = row.regularMarketPrice;
    if (price == null || Number.isNaN(price)) return null;

    let changePercent = row.regularMarketChangePercent;
    if (changePercent == null || Number.isNaN(changePercent)) {
      const prev = row.regularMarketPreviousClose;
      changePercent = prev && prev > 0 ? ((price - prev) / prev) * 100 : 0;
    }

    return { ticker, price, changePercent: Number(changePercent.toFixed(2)) };
  };

  const fetchYahooBatch = async (symbols: string[]) => {
    if (symbols.length === 0) return [] as YahooQuote[];
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols.join(","))}`;
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error(`Yahoo ${r.status}`);
    const json = (await r.json()) as { quoteResponse?: { result?: YahooQuote[] } };
    return Array.isArray(json.quoteResponse?.result) ? json.quoteResponse!.result! : [];
  };

  /** URL 길이 제한 대비 — 심볼당 2개(KS+KQ)이므로 티커 기준으로 청크 */
  const MAX_SYMBOLS = 80;

  try {
    const symMap = mapSymbolToTicker(allSymbols);
    const chunks: string[][] = [];
    for (let i = 0; i < allSymbols.length; i += MAX_SYMBOLS) {
      chunks.push(allSymbols.slice(i, i + MAX_SYMBOLS));
    }

    const rows: YahooQuote[] = [];
    for (const part of chunks) {
      const batch = await fetchYahooBatch(part);
      rows.push(...batch);
    }

    const byKs = new Map<string, { ticker: string; price: number; changePercent: number }>();
    const byKq = new Map<string, { ticker: string; price: number; changePercent: number }>();

    for (const row of rows) {
      const sym = row.symbol ?? "";
      const q = rowToQuote(row, symMap);
      if (!q) continue;
      if (sym.endsWith(".KS")) byKs.set(q.ticker, q);
      else if (sym.endsWith(".KQ")) byKq.set(q.ticker, q);
    }

    const quotes = uniqTickers
      .map((t) => byKs.get(t) ?? byKq.get(t))
      .filter((v): v is { ticker: string; price: number; changePercent: number } => v != null);

    res.status(200).json({ quotes });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    res.status(500).json({ error: message });
  }
}
