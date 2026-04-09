import { Capacitor } from "@capacitor/core";
import { parseTickersQuery } from "../../api/yahooKrxQuotesCore";

export interface LiveQuote {
  ticker: string;
  price: number;
  changePercent: number;
}

/** 응답 본문이 HTML·깨진 JSON이어도 throw 하지 않음 */
async function parseQuotesResponse(r: Response): Promise<LiveQuote[]> {
  try {
    const text = await r.text();
    if (!text?.trim()) return [];
    const json = JSON.parse(text) as { quotes?: LiveQuote[] };
    return Array.isArray(json.quotes) ? json.quotes : [];
  } catch {
    return [];
  }
}

/** Capacitor·정적 번들 등에서 `/api` 가 없을 때 배포 도메인으로 시세 요청 (VITE_CHAT_API_ORIGIN) */
function collectQuotesUrls(qs: string): string[] {
  const path = `/api/quotes${qs}`;
  const chat = import.meta.env.VITE_CHAT_API_ORIGIN?.replace(/\/$/, "");
  const dev = import.meta.env.VITE_DEV_API_PROXY?.replace(/\/$/, "");

  const urls: string[] = [];

  if (Capacitor.isNativePlatform() && chat) {
    urls.push(`${chat}${path}`);
  }

  urls.push(path);
  if (chat) urls.push(`${chat}${path}`);
  if (dev && dev !== chat) urls.push(`${dev}${path}`);

  return Array.from(new Set(urls));
}

/**
 * 배포 API에서 시세 조회. 여러 URL을 순회하며, **비어 있지 않은 quotes** 가 나올 때까지 시도.
 * 모두 비어 있거나 네트워크 실패 시 빈 배열 (throw 없음 → 시트에서 지도 캐시 가격으로 폴밄 가능).
 */
export async function fetchYahooQuotes(tickers: string[]): Promise<LiveQuote[]> {
  const normalized = parseTickersQuery(tickers.filter(Boolean).join(","));
  if (normalized.length === 0) return [];

  const params = new URLSearchParams({ tickers: normalized.join(",") });
  const qs = `?${params.toString()}`;

  const urls = collectQuotesUrls(qs);

  for (const url of urls) {
    try {
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) continue;
      const list = await parseQuotesResponse(r);
      if (list.length > 0) return list;
    } catch {
      /* 다음 URL */
    }
  }

  return [];
}
