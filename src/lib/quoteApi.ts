export interface LiveQuote {
  ticker: string;
  price: number;
  changePercent: number;
}

export async function fetchYahooQuotes(tickers: string[]): Promise<LiveQuote[]> {
  const uniq = Array.from(new Set(tickers.filter(Boolean)));
  if (uniq.length === 0) return [];

  const params = new URLSearchParams({ tickers: uniq.join(",") });
  const r = await fetch(`/api/quotes?${params.toString()}`);
  if (!r.ok) throw new Error(`Failed to fetch quotes (${r.status})`);

  const json = (await r.json()) as { quotes?: LiveQuote[] };
  return Array.isArray(json.quotes) ? json.quotes : [];
}
