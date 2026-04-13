import { Capacitor } from "@capacitor/core";

/** 클라이언트 시세 폴링 주기(밀리초) — 지도·종목 시트·보유 화면 공통 */
export const QUOTE_POLL_INTERVAL_MS = 60_000;

export interface LiveQuote {
  ticker: string;
  price: number;
  changePercent: number;
  regularMarketVolume?: number;
  averageVolume3Month?: number;
  regularMarketPreviousClose?: number;
  regularMarketOpen?: number;
  marketCap?: number;
  trailingPE?: number;
  forwardPE?: number;
  priceToBook?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  dividendYield?: number;
  returnOnEquity?: number;
  fiftyTwoWeekChangePercent?: number;
}

/** 지도 핀·시트와 동일 규칙으로 6자리 종목코드 (앞자리 0·접미사 .KS 등 처리) */
export function normalizeKrxTickerKey(raw: string): string | null {
  const d = String(raw).replace(/\D/g, "");
  if (d.length < 4) return null;
  const six = d.length <= 6 ? d.padStart(6, "0") : d.slice(-6);
  return /^\d{6}$/.test(six) ? six : null;
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

/**
 * `/api/*` 호출 시 사용할 공개 origin.
 * - **프로덕션 웹**: 항상 `window.location.origin` — 빌드 시점 `VERCEL_URL`(프리뷰 URL)이 박히면 교차 출처·401·CORS가 남.
 * - **Capacitor / 로컬**: origin이 localhost·capacitor 등이면 `VITE_CHAT_API_ORIGIN`(배포 URL) 필수.
 */
export function getPublicApiOrigin(): string | undefined {
  if (typeof window !== "undefined") {
    const o = window.location.origin;
    const isDeviceOrLocal =
      o.includes("localhost") ||
      o.includes("127.0.0.1") ||
      o.startsWith("capacitor://") ||
      o.startsWith("ionic://");
    if (!isDeviceOrLocal) {
      return o;
    }
  }
  return import.meta.env.VITE_CHAT_API_ORIGIN?.replace(/\/$/, "");
}

/** 시세 요청 URL — 배포 웹은 현재 탭과 동일 origin만 사용 */
function collectQuotesUrls(qs: string): string[] {
  const path = `/api/quotes${qs}`;
  const base = getPublicApiOrigin();
  const dev = import.meta.env.VITE_DEV_API_PROXY?.replace(/\/$/, "");

  const urls: string[] = [];

  if (Capacitor.isNativePlatform() && base) {
    urls.push(`${base}${path}`);
  }

  if (base) urls.push(`${base}${path}`);
  urls.push(path);
  if (dev && dev !== base) urls.push(`${dev}${path}`);

  return Array.from(new Set(urls));
}

/**
 * 서버 `/api/quotes`만 사용. 네이버 등은 서버(api/yahooKrxQuotesCore)에서만 호출 — 브라우저 직접 호출은 CORS로 실패함.
 */
export async function fetchYahooQuotes(tickers: string[]): Promise<LiveQuote[]> {
  const normalized = Array.from(
    new Set(
      tickers
        .map((t) => normalizeKrxTickerKey(String(t)))
        .filter((t): t is string => t != null),
    ),
  );
  if (normalized.length === 0) return [];

  const params = new URLSearchParams({ tickers: normalized.join(",") });
  const qs = `?${params.toString()}`;

  const urls = collectQuotesUrls(qs);

  for (const url of urls) {
    try {
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) continue;
      const list = await parseQuotesResponse(r);
      const matched = takeMatchingQuotes(list, normalized);
      if (matched.length > 0) return matched;
    } catch {
      /* 다음 URL */
    }
  }

  return [];
}

function filterQuotesForTickers(list: LiveQuote[], wanted: string[]): LiveQuote[] {
  const need = new Set(wanted);
  return list.filter((q) => {
    const k = normalizeKrxTickerKey(q.ticker);
    return k != null && need.has(k);
  });
}

function takeMatchingQuotes(list: LiveQuote[], wanted: string[]): LiveQuote[] {
  const m = filterQuotesForTickers(list, wanted);
  if (m.length === 0) return [];
  if (wanted.length <= 1) return m;
  if (m.length === wanted.length) return m;
  return m;
}
