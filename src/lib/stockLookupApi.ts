import { Capacitor } from "@capacitor/core";
import { getPublicApiOrigin } from "@/lib/quoteApi";

export type StockLookupOk = {
  ok: true;
  query: string;
  ticker: string;
  name: string;
  market: string | null;
};

export type StockLookupFail = { ok: false; query: string };

function lookupUrls(q: string): string[] {
  const qs = new URLSearchParams({ q }).toString();
  const path = `/api/stock/lookup?${qs}`;
  const origin = getPublicApiOrigin();
  const dev = import.meta.env.VITE_DEV_API_PROXY?.replace(/\/$/, "");
  const urls: string[] = [];
  if (Capacitor.isNativePlatform() && origin) urls.push(`${origin}${path}`);
  if (origin) urls.push(`${origin}${path}`);
  urls.push(path);
  if (dev && dev !== origin) urls.push(`${dev}${path}`);
  return Array.from(new Set(urls));
}

/**
 * 네이버 모바일 증권 자동완성(서버 경유)으로 한글 종목명 → 6자리 티커.
 */
export async function fetchStockLookupByQuery(query: string): Promise<StockLookupOk | StockLookupFail | null> {
  const trimmed = query.replace(/\s+/g, " ").trim();
  if (trimmed.length < 2) return null;

  for (const url of lookupUrls(trimmed)) {
    try {
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) continue;
      const data = (await r.json()) as {
        ok?: boolean;
        ticker?: string;
        name?: string;
        market?: string | null;
        query?: string;
      };
      if (data.ok === true && data.ticker && data.name) {
        return {
          ok: true,
          query: data.query ?? trimmed,
          ticker: data.ticker,
          name: data.name,
          market: data.market ?? null,
        };
      }
      if (data.ok === false) {
        return { ok: false, query: data.query ?? trimmed };
      }
    } catch {
      /* 다음 URL */
    }
  }
  return null;
}
