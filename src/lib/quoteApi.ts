import { Capacitor } from "@capacitor/core";

export interface LiveQuote {
  ticker: string;
  price: number;
  changePercent: number;
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
 * Vercel 배포 URL에서 웹으로 접속할 때는 env 없이도 `window.location.origin` 이 API와 동일.
 * Capacitor(file/localhost WebView)는 localhost 로 잡히므로 env(VITE_CHAT_API_ORIGIN) 필수.
 */
export function getPublicApiOrigin(): string | undefined {
  const fromEnv = import.meta.env.VITE_CHAT_API_ORIGIN?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (typeof window === "undefined") return undefined;
  const o = window.location.origin;
  if (!o || o.includes("localhost") || o.includes("127.0.0.1")) return undefined;
  return o;
}

/** 시세 요청 URL 후보 — 배포 절대 URL을 상대 경로보다 먼저 (SPA가 /api 를 가로막는 경우 대비) */
function collectQuotesUrls(qs: string): string[] {
  const path = `/api/quotes${qs}`;
  const chat = getPublicApiOrigin();
  const dev = import.meta.env.VITE_DEV_API_PROXY?.replace(/\/$/, "");

  const urls: string[] = [];

  if (Capacitor.isNativePlatform() && chat) {
    urls.push(`${chat}${path}`);
  }

  if (chat) urls.push(`${chat}${path}`);
  urls.push(path);
  if (dev && dev !== chat) urls.push(`${dev}${path}`);

  return Array.from(new Set(urls));
}

/** 서버 API가 전부 빈 배열일 때 — 네이버 모바일 API (일부 환경에서 CORS 허용, 실패 시 조용히 무시) */
async function fetchNaverQuoteInBrowser(ticker6: string): Promise<LiveQuote | null> {
  const code = ticker6.padStart(6, "0");
  try {
    const r = await fetch(`https://m.stock.naver.com/api/stock/${code}/basic`, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Referer: "https://m.stock.naver.com/",
      },
    });
    if (!r.ok) return null;
    const json = (await r.json()) as {
      closePrice?: string;
      fluctuationsRatio?: string;
      overMarketPriceInfo?: { overPrice?: string; fluctuationsRatio?: string };
    };
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
    const rawPct = Number(String(pctStr).replace(/^\+/, ""));
    const changePercent = Number.isFinite(rawPct) ? rawPct : 0;
    return { ticker: code, price, changePercent: Number(changePercent.toFixed(2)) };
  } catch {
    return null;
  }
}

/**
 * 배포 API에서 시세 조회. 여러 URL을 순회한 뒤, 여전히 비면 브라우저→네이버 단건 폴백.
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
      if (list.length > 0) return list;
    } catch {
      /* 다음 URL */
    }
  }

  const fromNaver: LiveQuote[] = [];
  for (const t of normalized) {
    const q = await fetchNaverQuoteInBrowser(t);
    if (q) fromNaver.push(q);
  }
  return fromNaver;
}
