import { Capacitor } from "@capacitor/core";
import { getPublicApiOrigin } from "@/lib/quoteApi";
import type { MapQuizSnapshot } from "@/contexts/MapQuizContext";

export type HybridQuizChoice = { key: string; text: string; ticker?: string };
export type HybridQuizQuestion = {
  id: string;
  prompt: string;
  choices: HybridQuizChoice[];
  correctKey: string;
  feedbackWrong?: string;
  /** 1~10 — 정답 시 동일 원 단위 캐시 */
  difficulty: number;
};

export type HybridQuizResponse = {
  ok: true;
  intro: string;
  questions: HybridQuizQuestion[];
  meta: {
    hybrid: boolean;
    companyCount: number;
    quoteCount: number;
    centerLat?: number;
    centerLng?: number;
    radiusM?: number;
  };
};

function hybridQuizUrls(): string[] {
  const path = `/api/quiz/hybrid`;
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
 * 서버 하이브리드 퀴즈: 지도 스냅샷(원 안 종목) + 시세 + LLM 1회
 */
export async function requestHybridQuiz(snapshot: MapQuizSnapshot): Promise<HybridQuizResponse> {
  const body = JSON.stringify({
    centerLat: snapshot.centerLat,
    centerLng: snapshot.centerLng,
    radiusM: snapshot.radiusM,
    stocks: snapshot.stocks,
  });

  let lastErr = "요청 실패";
  for (const url of hybridQuizUrls()) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      const text = await res.text();
      let data: { ok?: boolean; error?: string; intro?: string; questions?: unknown; meta?: unknown };
      try {
        data = JSON.parse(text) as typeof data;
      } catch {
        lastErr = text || `HTTP ${res.status}`;
        continue;
      }
      if (!res.ok) {
        lastErr = data.error ?? `HTTP ${res.status}`;
        continue;
      }
      if (data.ok === true && Array.isArray(data.questions)) {
        return data as HybridQuizResponse;
      }
      lastErr = data.error ?? "퀴즈 응답 형식 오류";
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
  }
  throw new Error(lastErr);
}
