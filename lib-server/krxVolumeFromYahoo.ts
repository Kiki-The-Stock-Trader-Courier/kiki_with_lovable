/**
 * KRX 6자리 종목 — Yahoo Finance v8 chart 일봉에서 거래량 집계 (챗봇 컨텍스트 주입용).
 * DDG 스니펫만으로는 거래량 수치가 거의 없어, 서버에서 직접 조회합니다.
 */

const YAHOO_FETCH_HEADERS: HeadersInit = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "application/json,text/plain,*/*",
  "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
  Referer: "https://finance.yahoo.com/",
};

async function parseJsonBody<T>(r: Response): Promise<T | null> {
  try {
    const text = await r.text();
    if (!text?.trim()) return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export type KrxVolumeStats = {
  /** 가장 최근 일봉 거래량(주) */
  lastSessionVolume: number;
  /** 최근 거래일부터 N개 합(기본 5 — 국내 ‘일주일’과 유사한 영업일 수) */
  sumLast5Sessions: number;
  /** 최근 7거래일 합(‘1주일’을 넓게 해석할 때) */
  sumLast7Sessions: number | null;
};

function padTicker6(raw: string): string | null {
  const d = String(raw).replace(/\D/g, "");
  if (d.length < 4) return null;
  const six = d.length <= 6 ? d.padStart(6, "0") : d.slice(-6);
  return /^\d{6}$/.test(six) ? six : null;
}

/**
 * Yahoo 일봉 차트에서 거래량 배열을 읽어 최근 영업일 기준 합계를 계산합니다.
 * 코스피(.KS) 실패 시 코스닥(.KQ) 순으로 시도합니다.
 */
export async function getKrxVolumeStatsFromYahooChart(tickerRaw: string): Promise<KrxVolumeStats | null> {
  const ticker6 = padTicker6(tickerRaw);
  if (!ticker6) return null;

  const hosts = ["https://query1.finance.yahoo.com", "https://query2.finance.yahoo.com"] as const;
  const symbols = [`${ticker6}.KS`, `${ticker6}.KQ`];

  for (const yahooSymbol of symbols) {
    const path = encodeURIComponent(yahooSymbol);
    const qs = "interval=1d&range=3mo";

    for (const host of hosts) {
      const url = `${host}/v8/finance/chart/${path}?${qs}`;
      try {
        const r = await fetch(url, { cache: "no-store", headers: YAHOO_FETCH_HEADERS });
        if (!r.ok) continue;

        const json = await parseJsonBody<{
          chart?: {
            result?: Array<{
              indicators?: { quote?: Array<{ volume?: Array<number | null> }> };
              error?: unknown;
            }>;
            error?: unknown;
          };
        }>(r);
        if (!json?.chart?.result?.[0] || json.chart.result[0].error) continue;

        const volumes = json.chart.result[0].indicators?.quote?.[0]?.volume;
        if (!Array.isArray(volumes) || volumes.length === 0) continue;

        /** 시계열 끝에서부터 거래량이 있는 날만 수집 */
        const sessionVols: number[] = [];
        for (let i = volumes.length - 1; i >= 0 && sessionVols.length < 12; i--) {
          const v = volumes[i];
          if (v != null && Number.isFinite(v) && v > 0) sessionVols.push(v);
        }
        if (sessionVols.length === 0) continue;

        const lastSessionVolume = sessionVols[0];
        const sumLast5Sessions = sessionVols.slice(0, 5).reduce((a, b) => a + b, 0);
        const sumLast7Sessions =
          sessionVols.length >= 7 ? sessionVols.slice(0, 7).reduce((a, b) => a + b, 0) : null;

        return {
          lastSessionVolume,
          sumLast5Sessions,
          sumLast7Sessions,
        };
      } catch {
        /* 다음 host/symbol */
      }
    }
  }

  return null;
}

/** 거래량 수치를 서버에서 조회해 넣을지 (재무·PER만 묻는 질문은 제외) */
export function shouldFetchYahooVolumeForMessage(lastUser: string): boolean {
  const t = lastUser.replace(/\s+/g, " ").trim();
  if (!t) return false;

  const volumeIntent =
    /거래량|거래대금|체결|회전율|유동성|대금|주간|일주일|1주|7\s*일|5\s*일|최근\s*\d+\s*일|몇\s*주\s*거래|거래\s*몇/.test(
      t,
    );
  if (!volumeIntent) return false;

  const financeOnly =
    /재무|재무제표|PER|PBR|ROE|부채|영업이익|순이익|실적|분기|연간|EPS|BPS|배당/.test(t) &&
    !/거래량|거래대금|체결|회전|주간|일주일|1주/.test(t);
  if (financeOnly) return false;

  return true;
}
