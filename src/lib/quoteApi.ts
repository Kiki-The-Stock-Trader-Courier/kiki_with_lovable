import { Capacitor } from "@capacitor/core";
import { parseTickersQuery } from "../../api/yahooKrxQuotesCore";

export interface LiveQuote {
  ticker: string;
  price: number;
  changePercent: number;
}

/** Capacitor·정적 번들 등에서 `/api` 가 없을 때 배포 도메인으로 시세 요청 (VITE_CHAT_API_ORIGIN) */
function collectQuotesUrls(qs: string): string[] {
  const path = `/api/quotes${qs}`;
  const chat = import.meta.env.VITE_CHAT_API_ORIGIN?.replace(/\/$/, "");
  const dev = import.meta.env.VITE_DEV_API_PROXY?.replace(/\/$/, "");

  const urls: string[] = [];

  // 네이티브 앱은 로컬 origin에 서버리스가 없으므로, 설정돼 있으면 Vercel 등 절대 URL을 먼저 시도
  if (Capacitor.isNativePlatform() && chat) {
    urls.push(`${chat}${path}`);
  }

  urls.push(path);
  if (chat) urls.push(`${chat}${path}`);
  if (dev && dev !== chat) urls.push(`${dev}${path}`);

  return Array.from(new Set(urls));
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

  const urls = collectQuotesUrls(qs);
  let lastStatus = 0;

  for (const url of urls) {
    const r = await fetch(url, { cache: "no-store" });
    lastStatus = r.status;
    if (r.ok) return parseJson(r);
  }

  throw new Error(`Failed to fetch quotes (${lastStatus})`);
}
