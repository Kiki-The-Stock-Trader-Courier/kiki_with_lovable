/**
 * 네이버 뉴스 검색 Open API — 서버 환경에서 안정적으로 동작 (DDG 대비).
 * https://developers.naver.com/docs/service/search/news.md
 *
 * NAVER_CLIENT_ID / NAVER_CLIENT_SECRET (sync와 동일 키 사용)
 */

import type { StockAssistPayload } from "./ddgSearchCore.js";

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

type NaverNewsItem = {
  title?: string;
  originallink?: string;
  link?: string;
  description?: string;
  pubDate?: string;
};

type NaverNewsJson = {
  items?: NaverNewsItem[];
  total?: number;
  errorMessage?: string;
  errorCode?: string;
};

/**
 * 종목명·티커로 최신 뉴스 스니펫 (제목·요약·날짜·링크) — LLM system 보강용
 */
export async function fetchNaverNewsContext(
  stock: StockAssistPayload,
  _lastUserMessage: string,
  maxLen = 3800,
): Promise<string> {
  const id = process.env.NAVER_CLIENT_ID?.trim();
  const secret = process.env.NAVER_CLIENT_SECRET?.trim();
  if (!id || !secret) return "";

  /** 회사명+티커가 네이버 뉴스 검색에 가장 안정적으로 매칭됩니다. */
  const searchQ = `${stock.name} ${stock.ticker}`.trim().slice(0, 100);

  const url = new URL("https://openapi.naver.com/v1/search/news.json");
  url.searchParams.set("query", searchQ);
  url.searchParams.set("display", "10");
  url.searchParams.set("sort", "date");

  try {
    const res = await fetch(url.toString(), {
      headers: {
        "X-Naver-Client-Id": id,
        "X-Naver-Client-Secret": secret,
      },
    });
    const text = await res.text();
    if (!res.ok) {
      console.warn("[naver news]", res.status, text.slice(0, 300));
      return "";
    }
    const data = JSON.parse(text) as NaverNewsJson;
    if (data.errorMessage) {
      console.warn("[naver news] api error:", data.errorCode, data.errorMessage);
      return "";
    }
    const items = data.items ?? [];
    if (items.length === 0) return "";

    const lines: string[] = [
      "[네이버 뉴스 검색 — 아래 제목·요약·날짜를 근거로 최근 이슈를 요약하고, 출처(링크)를 답변에 한 번 이상 언급하세요. 스니펫만으로 부족하면 ‘원문 확인’을 안내하세요.]",
    ];
    for (let i = 0; i < items.length; i++) {
      const it = items[i]!;
      const title = stripHtml(String(it.title ?? ""));
      const desc = stripHtml(String(it.description ?? ""));
      const pub = String(it.pubDate ?? "").trim();
      const link = String(it.link ?? it.originallink ?? "").trim();
      const descShort = desc.length > 220 ? `${desc.slice(0, 220)}…` : desc;
      lines.push(`${i + 1}. ${title}`);
      if (descShort) lines.push(`   요약: ${descShort}`);
      if (pub) lines.push(`   날짜: ${pub}`);
      if (link) lines.push(`   링크: ${link}`);
      lines.push("");
    }

    let out = lines.join("\n").trim();
    if (out.length > maxLen) out = `${out.slice(0, maxLen)}\n…(이하 생략)`;
    return out;
  } catch (e) {
    console.warn("[naver news] fetch failed:", e);
    return "";
  }
}
