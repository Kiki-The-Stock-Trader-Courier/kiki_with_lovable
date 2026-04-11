import type { ChatIntent, ChatComplexity } from "./types.js";

/**
 * 마지막 사용자 메시지 텍스트 추출
 */
export function lastUserContent(messages: { role: string; content: string }[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === "user" && typeof messages[i]?.content === "string") {
      return messages[i].content;
    }
  }
  return "";
}

/**
 * 메시지 길이·패턴으로 난이도 추정 (모델 토큰·온도 보조)
 */
export function inferComplexity(text: string): ChatComplexity {
  const t = text.trim();
  if (t.length >= 200) return "high";
  if ((t.match(/\?/g) ?? []).length >= 2) return "high";
  if (/왜|어떻게|근거|리스크|전망|분석|비교|장단점/.test(t) && t.length > 80) return "high";
  if (t.length < 15) return "low";
  return "medium";
}

/**
 * 규칙 기반 의도 분류 (소형 LLM 호출 없음 — Vercel 지연·비용 절약)
 */
export function routeChatIntent(lastUserText: string, hasStockAssist: boolean): ChatIntent {
  const n = lastUserText.trim().toLowerCase();
  if (!n) return "general";

  if (/자살|자해|불법\s*다운|해킹\s*방법|마약\s*구매|테러\s*방법/.test(n)) {
    return "unsafe";
  }

  if (hasStockAssist) {
    if (/시세|주가|현재가|호가|등락|전일|퍼센트|%|몇\s*원|원\s*이야|얼마|장중/.test(n)) {
      return "price_fact";
    }
    if (/뉴스|이슈|공시|최근\s*소식|화제|기사/.test(n)) {
      return "news_issue";
    }
    if (/투자|매수|매도|전망|목표가|리스크|분석|살\s*까|팔\s*까|추천|매력|과열/.test(n)) {
      return "deep_analysis";
    }
    if (/뭐\s*해|무슨\s*일|사업|업종|소개|회사\s*뭐|주력|하는\s*일|한줄/.test(n)) {
      return "company_profile";
    }
  }

  if (/앱\s*어떻게|사용법|기능|탭|걸음|캐시워크|설정\s*어디|지도\s*어떻게/.test(n)) {
    return "how_to_use_app";
  }
  if (/^안녕|^반가워|고마워|감사합니다|ㅎㅎ|ㅋㅋ/.test(n) && n.length < 45) {
    return "smalltalk";
  }

  if (/뉴스|이슈|공시/.test(n)) return "news_issue";
  if (/투자|전망|리스크|분석|매수|매도/.test(n)) return "deep_analysis";
  if (/뭐\s*해|사업|업종|소개|회사/.test(n)) return "company_profile";

  return "general";
}
