import type { StockAssistPayload } from "./ddgSearchCore.js";
import { buildStockDdgQuery, duckDuckGoWebContext } from "./ddgSearchCore.js";

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
 * 종목 챗 요청 시: 시스템 프롬프트에 DuckDuckGo 웹 검색 스니펫을 덧붙입니다.
 */
export async function mergeStockAssistWithDdg(
  messages: ChatMsg[],
  stockAssist: StockAssistPayload | undefined,
): Promise<ChatMsg[]> {
  const msgs = Array.isArray(messages) ? [...messages] : [];
  if (!stockAssist?.name || !stockAssist?.ticker) return msgs;

  const lastUser = lastUserContent(msgs);
  const query = buildStockDdgQuery(stockAssist, lastUser);
  const ddg = await duckDuckGoWebContext(query, 4000, stockAssist.ticker);

  const block = ddg
    ? [
        "",
        "---",
        "[웹 검색 참고 — DuckDuckGo. 시세·뉴스·사실관계는 출처·시점과 다를 수 있으니, 답변 시 반드시 ‘검색 스니펫 기준’임을 안내하고, 불확실하면 추측하지 말 것.]",
        ddg,
      ].join("\n")
    : "\n---\n[웹 검색 참고: 서버에서 DuckDuckGo 자동 검색 결과를 가져오지 못했습니다(데이터센터 IP 차단 등 가능). 앱에 표시된 시세·설명 위주로 답하고, 최신 뉴스·공시는 금융감독원 DART·거래소 공시·신뢰할 수 있는 언론 원문 확인을 안내하세요.]";

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
