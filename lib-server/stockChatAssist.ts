import type { StockAssistPayload } from "./ddgSearchCore.js";
import { buildStockDdgQuery, duckDuckGoWebContext } from "./ddgSearchCore.js";
import { getKrxVolumeStatsFromYahooChart, shouldFetchYahooVolumeForMessage } from "./krxVolumeFromYahoo.js";
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

/** 투자 유의·리스크 중심 질문 — 일반 체크리스트 대신 스니펫·종목 근거 답변 유도 */
function wantsStockSpecificInvestmentGuidance(lastUser: string): boolean {
  const t = lastUser.replace(/\s+/g, " ").trim();
  const caution =
    /투자할\s*때|매수\s*전|주의할|조심할|유의사항|투자\s*시|리스크|위험|주의|조심|변동성|하락|급등|살\s*까|팔\s*까/.test(
      t,
    );
  const meaningVsPrice = /의미/.test(t) && /주가|시세|현재가|등락/.test(t);
  return caution || meaningVsPrice;
}

/** 거래량·재무·실적 — 스니펫 수치 인용 + 거절형 답변 지양 */
function wantsMarketDataGuidance(lastUser: string): boolean {
  const t = lastUser.replace(/\s+/g, " ").trim();
  return /거래량|거래대금|회전율|재무|재무제표|재무상태|실적|분기|연간|PER|PBR|EPS|영업이익|순이익|부채|ROE|배당|주간|일주일|1주일|7일|재무\s*공시|실적\s*공시/.test(
    t,
  );
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

  const volumeP = shouldFetchYahooVolumeForMessage(lastUser)
    ? getKrxVolumeStatsFromYahooChart(stockAssist.ticker)
    : Promise.resolve(null);

  const [naver, ddg, yahooVol] = await Promise.all([
    fetchNaverNewsContext(stockAssist, lastUser, 3800),
    duckDuckGoWebContext(query, 3200, stockAssist.ticker),
    volumeP,
  ]);

  const sections: string[] = [];
  if (yahooVol) {
    const lines = [
      "[거래량 수치 — 서버가 Yahoo Finance 일봉 차트에서 조회했습니다. 장·휴일·시간외에 따라 최종 봉이 전일 종가일 수 있습니다.]",
      `- 가장 최근 일봉 거래량: 약 ${yahooVol.lastSessionVolume.toLocaleString("ko-KR")}주`,
      `- 최근 5거래일 거래량 합: 약 ${yahooVol.sumLast5Sessions.toLocaleString("ko-KR")}주 (국내 ‘일주일’에 가까운 영업일 수)`,
    ];
    if (yahooVol.sumLast7Sessions != null) {
      lines.push(`- 최근 7거래일 거래량 합: 약 ${yahooVol.sumLast7Sessions.toLocaleString("ko-KR")}주`);
    }
    lines.push(
      "답변 시 위 수치를 우선 인용하세요. ‘구체적 거래량은 제공할 수 없다’고 거절하지 마세요.",
    );
    sections.push(lines.join("\n"));
  }
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

  const cautionExtra = wantsStockSpecificInvestmentGuidance(lastUser)
    ? [
        "",
        "[이번 질문 전용 지침 — 종목 맞춤 답변]",
        "일반적인 ‘시장 조사·재무제표·분산투자’ 목록만 길게 쓰지 마세요. 스니펫·뉴스에 나온 이 종목·업종 관련 이슈, 실적·공시 맥락이 있으면 먼저 요약하고, 앱에 표시된 시세·등락과 연결해 설명하세요. 근거가 부족하면 부족하다고 말한 뒤 확인 방법만 짧게 안내하세요.",
      ].join("\n")
    : "";

  const hasYahooVolume = Boolean(yahooVol);
  const marketDataExtra = wantsMarketDataGuidance(lastUser)
    ? [
        "",
        "[이번 질문 전용 지침 — 거래량·재무·실적]",
        hasYahooVolume
          ? "거래량 질문이면 위 [거래량 수치 — Yahoo Finance] 블록의 숫자를 문장으로 인용하세요. 재무·실적은 아래 스니펫·뉴스를 인용하세요."
          : "아래 스니펫·뉴스에 거래량·재무·실적 수치나 요약이 있으면 출처·시점을 밝히고 인용해 답하세요. 스니펫에 정확한 일별·주간 거래량 숫자가 없을 수 있습니다 — 그 경우에도 ‘제공 불가’로 끊지 말고, 스니펫에서 확인되는 범위(예: 최근 이슈, 실적 톤, 업종 맥락)를 설명하고, 정확한 수치는 한국거래소(KRX) 상세·증권사 HTS·DART에서 티커로 확인하라고 짧게 안내하세요.",
      ].join("\n")
    : "";

  let block: string;
  if (sections.length > 0) {
    block = [
      "",
      "---",
      "[외부 검색·뉴스 스니펫 — 아래 내용을 우선 근거로 답하세요. 네이버 뉴스가 있으면 최근 이슈를 요약·인용하고, 없으면 DuckDuckGo만 사용. 스니펫에 없는 사실은 추측하지 말고 ‘확인 필요’로 안내.]",
      cautionExtra,
      marketDataExtra,
      sections.join("\n\n---\n\n"),
    ].join("\n");
  } else {
    block = [
      "\n---\n[외부 뉴스/검색: NAVER_CLIENT_ID·NAVER_CLIENT_SECRET이 없거나 검색 결과가 비었고, DuckDuckGo도 실패했습니다.",
      wantsMarketDataGuidance(lastUser)
        ? hasYahooVolume
          ? "거래량 수치는 위 Yahoo 블록을 사용하세요."
          : "거래량·재무 질문입니다. 검색이 비었어도 ‘답변 불가’ 한 문장으로 끝내지 말고, 앱에 있는 시세·등락·업종·한줄 설명으로 말할 수 있는 맥락은 주고, 정확한 수치는 KRX·DART·증권사에서 확인하라고 안내하세요."
        : wantsStockSpecificInvestmentGuidance(lastUser)
          ? "이 질문은 종목별 투자 유의사항이므로, 일반론 나열 대신 ‘검색 결과 없음’을 밝히고 앱 시세·업종·한줄 설명만 근거로 말할 수 있는 범위에서만 답하고, 나머지는 DART·공시·거래소 확인을 권하세요."
          : "앱에 표시된 시세·설명 위주로 답하고, 공시·뉴스 원문은 DART·거래소·언론 사이트 직접 확인을 권장한다고 짧게 안내하세요.",
      "]",
    ].join(" ");
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
