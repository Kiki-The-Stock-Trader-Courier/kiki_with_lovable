import type { VercelRequest, VercelResponse } from "@vercel/node";

interface YahooQuote {
  symbol: string;
  regularMarketPrice?: number;
  regularMarketPreviousClose?: number;
  regularMarketChangePercent?: number;
}

function toYahooSymbol(ticker: string): string | null {
  // KRX 6자리 종목코드만 지원 (예: 005930 -> 005930.KS)
  if (!/^\d{6}$/.test(ticker)) return null;
  return `${ticker}.KS`;
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

  const symbolToTicker = new Map<string, string>();
  const symbols = tickers
    .map((ticker) => {
      const symbol = toYahooSymbol(ticker);
      if (!symbol) return null;
      symbolToTicker.set(symbol, ticker);
      return symbol;
    })
    .filter((v): v is string => v != null);

  if (symbols.length === 0) {
    res.status(200).json({ quotes: [] });
    return;
  }

  try {
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols.join(","))}`;
    const r = await fetch(url);
    if (!r.ok) {
      res.status(502).json({ error: `Yahoo quote request failed (${r.status})` });
      return;
    }
    const json = (await r.json()) as { quoteResponse?: { result?: YahooQuote[] } };
    const rows = Array.isArray(json.quoteResponse?.result) ? json.quoteResponse!.result! : [];

    const quotes = rows
      .map((row) => {
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
      })
      .filter((v): v is { ticker: string; price: number; changePercent: number } => v != null);

    res.status(200).json({ quotes });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    res.status(500).json({ error: message });
  }
}
