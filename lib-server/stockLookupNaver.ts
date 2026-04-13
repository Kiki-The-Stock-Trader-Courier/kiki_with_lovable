/**
 * 네이버 모바일 증권 자동완성 API로 한글 종목명 → KRX 6자리 코드 해석 (서버 전용).
 */

const NAVER_HEADERS: HeadersInit = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "application/json,*/*",
  Referer: "https://m.stock.naver.com/",
};

export type NaverStockLookupHit = {
  ticker: string;
  name: string;
  market?: string;
};

async function parseJson<T>(r: Response): Promise<T | null> {
  try {
    const t = await r.text();
    if (!t?.trim()) return null;
    return JSON.parse(t) as T;
  } catch {
    return null;
  }
}

/**
 * 키워드(회사명 일부·전체)로 상장 종목 1건 매칭 — 첫 번째 결과 사용.
 */
export async function searchKrxTickerByKeyword(keyword: string): Promise<NaverStockLookupHit | null> {
  const q = keyword.replace(/\s+/g, " ").trim();
  if (q.length < 2 || q.length > 80) return null;

  const url = `https://m.stock.naver.com/front-api/search/autoComplete?${new URLSearchParams({
    query: q,
    target: "stock",
  })}`;

  try {
    const r = await fetch(url, { cache: "no-store", headers: NAVER_HEADERS });
    if (!r.ok) return null;
    const json = await parseJson<{
      isSuccess?: boolean;
      result?: { items?: Array<{ code?: string; name?: string; typeName?: string; category?: string }> };
    }>(r);
    if (!json?.isSuccess || !json.result?.items?.length) return null;

    const first = json.result.items.find((it) => it.category === "stock" && it.code && it.name);
    if (!first?.code || !first.name) return null;

    const d = String(first.code).replace(/\D/g, "");
    const six = d.length <= 6 ? d.padStart(6, "0") : d.slice(-6);
    if (!/^\d{6}$/.test(six)) return null;

    return {
      ticker: six,
      name: String(first.name).trim(),
      market: first.typeName?.trim(),
    };
  } catch (e) {
    console.warn("[stockLookupNaver]", e);
    return null;
  }
}
