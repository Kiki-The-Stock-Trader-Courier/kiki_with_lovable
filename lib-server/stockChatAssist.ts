import type { StockAssistPayload } from "./ddgSearchCore.js";
import { buildStockDdgQuery, duckDuckGoWebContext } from "./ddgSearchCore.js";
import { fetchNaverNewsContext } from "./naverNewsSearch.js";

type ChatMsg = { role: string; content: string };

function lastUserContent(messages: ChatMsg[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === "user" && typeof messages[i]?.content === "string") {
      return messages[i].content;
    }
  }
  return "";
}

/**
 * 종목 챗: 네이버 뉴스 API(우선) + DuckDuckGo 스니펫을 시스템 프롬프트에 합칩니다.
 */
export async function mergeStockAssistWithDdg(
  messages: ChatMsg[],
  stockAssist: StockAssistPayload | undefined,
): Promise<ChatMsg[]> {
  const msgs = Array.isArray(messages) ? [...messages] : [];
  if (!stockAssist?.name || !stockAssist?.ticker) return msgs;

  const lastUser = lastUserContent(msgs);
  const query = buildStockDdgQuery(stockAssist, lastUser);

  const [naver, ddg] = await Promise.all([
    fetchNaverNewsContext(stockAssist, lastUser, 3800),
    duckDuckGoWebContext(query, 3200, stockAssist.ticker),
  ]);

  const sections: string[] = [];
  if (naver) {
    sections.push(naver);
  }
  if (ddg) {
    sections.push(
      [
        "[웹 검색 참고 — DuckDuckGo. 시세·사실관계는 출처·시점과 다를 수 있음.]",
        ddg,
      ].join("\n"),
    );
  }

  let block: string;
  if (sections.length > 0) {
    block = [
      "",
      "---",
      "[외부 검색·뉴스 스니펫 — 아래 내용을 우선 근거로 답하세요. 네이버 뉴스가 있으면 최근 이슈를 요약·인용하고, 없으면 DuckDuckGo만 사용. 스니펫에 없는 사실은 추측하지 말고 ‘확인 필요’로 안내.]",
      sections.join("\n\n---\n\n"),
    ].join("\n");
  } else {
    block =
      "\n---\n[외부 뉴스/검색: NAVER_CLIENT_ID·NAVER_CLIENT_SECRET이 없거나 검색 결과가 비었고, DuckDuckGo도 실패했습니다. 앱에 표시된 시세·설명 위주로 답하고, 공시·뉴스 원문은 DART·거래소·언론 사이트 직접 확인을 권장한다고 짧게 안내하세요.]";
  }

  const sysIdx = msgs.findIndex((m) => m.role === "system");
  if (sysIdx >= 0) {
    const cur = msgs[sysIdx];
    msgs[sysIdx] = { ...cur, content: `${cur.content}${block}` };
  } else {
    msgs.unshift({
      role: "system",
      content: `종목: ${stockAssist.name} (${stockAssist.ticker})${block}`,
    });
  }

  return msgs;
}
