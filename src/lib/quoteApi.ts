import { parseTickersQuery } from "../../api/yahooKrxQuotesCore";

export interface LiveQuote {
  ticker: string;
  price: number;
  changePercent: number;
}

export async function fetchYahooQuotes(tickers: string[]): Promise<LiveQuote[]> {
  const normalized = parseTickersQuery(tickers.filter(Boolean).join(","));
  if (normalized.length === 0) return [];

  const params = new URLSearchParams({ tickers: normalized.join(",") });
  const qs = `?${params.toString()}`;

  const parseJson = async (r: Response): Promise<LiveQuote[]> => {
    const json = (await r.json()) as { quotes?: LiveQuote[] };
    return Array.isArray(json.quotes) ? json.quotes : [];
  };

  let r = await fetch(`/api/quotes${qs}`, { cache: "no-store" });
  if (r.ok) return parseJson(r);

  /** 로컬에서 상대 경로 실패 시 배포 API로 한 번 더 (VITE_DEV_API_PROXY) */
  const origin = import.meta.env.VITE_DEV_API_PROXY?.replace(/\/$/, "");
  if (origin) {
    r = await fetch(`${origin}/api/quotes${qs}`, { cache: "no-store" });
    if (r.ok) return parseJson(r);
  }

  throw new Error(`Failed to fetch quotes (${r.status})`);
}
