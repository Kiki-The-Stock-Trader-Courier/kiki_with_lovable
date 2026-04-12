import type { ChatMessage, StockPin } from "@/types/stock";

/** Capacitor·앱 번들에서 배포 도메인으로 호출할 때만 설정 (예: https://xxx.vercel.app) */
function chatApiUrl(): string {
  const base = import.meta.env.VITE_CHAT_API_ORIGIN?.replace(/\/$/, "") ?? "";
  return base ? `${base}/api/chat` : "/api/chat";
}

export type OpenAIChatMessage = { role: "system" | "user" | "assistant"; content: string };

/** 서버에서 DuckDuckGo 검색 보강에 사용 (종목 시트 챗 전용) */
export type StockAssistPayload = {
  name: string;
  ticker: string;
  sector?: string;
};

export async function postChatCompletion(
  messages: OpenAIChatMessage[],
  options?: { maxTokens?: number; stockAssist?: StockAssistPayload },
): Promise<string> {
  const res = await fetch(chatApiUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages,
      max_tokens: options?.maxTokens ?? 900,
      ...(options?.stockAssist ? { stockAssist: options.stockAssist } : {}),
    }),
  });

  const raw = await res.text();
  let data: { choices?: { message?: { content?: string } }[]; error?: { message?: string } };
  try {
    data = JSON.parse(raw) as typeof data;
  } catch {
    throw new Error(raw || `HTTP ${res.status}`);
  }

  if (!res.ok) {
    throw new Error(data.error?.message || raw || `HTTP ${res.status}`);
  }

  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Empty response from OpenAI");
  return text;
}

export async function askStockAssistant(stock: StockPin, history: ChatMessage[]): Promise<string> {
  const system: OpenAIChatMessage = {
    role: "system",
    content: [
      "당신은 한국 주식 앱의 도우미입니다.",
      `사용자가 선택한 종목: ${stock.name} (${stock.ticker})`,
      `업종: ${stock.sector}`,
      `앱에 표시된 한줄 설명: ${stock.description}`,
      `현재가 ${stock.price.toLocaleString()}원, 전일 대비 ${stock.changePercent}%.`,
      "투자 권유·매수 권유는 하지 말고, 정보·설명 위주로 간결하게 답하세요. 법적·세무 조언은 하지 마세요.",
      "질문이 이 종목 투자 시 주의점·리스크·매수 전 점검·전망·의미 분석이면, 반드시 아래에 붙은 [외부 검색·뉴스 스니펫]과 위 종목·업종·등락 정보를 근거로 먼저 답하세요. 누구에게나 동일한 일반 투자 체크리스트만 길게 나열하지 마세요. 스니펫이 부족하면 그 한계를 밝히고 공시·거래소·DART 등 직접 확인을 짧게 권하세요.",
    ].join("\n"),
  };

  const msgs: OpenAIChatMessage[] = [
    system,
    ...history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  return postChatCompletion(msgs, {
    maxTokens: 1100,
    stockAssist: {
      name: stock.name,
      ticker: stock.ticker,
      sector: stock.sector,
    },
  });
}

export async function askGlobalAssistant(
  history: ChatMessage[],
  options?: { extraSystemContext?: string },
): Promise<string> {
  const parts = [
    "당신은 '워키포인트' 앱의 도우미입니다.",
    "걸음·캐시·근처 상장사·지도 핀 등을 친절히 설명합니다.",
    "투자 권유는 하지 말고 정보 제공 중심으로 답하세요.",
    "걸음 수·평균을 설명할 때는 사용자 메시지와 아래 [컨텍스트]에 주어진 숫자만 사용하고, 가상의 예시 계산을 만들지 마세요.",
  ];
  if (options?.extraSystemContext?.trim()) {
    parts.push("", "[컨텍스트]", options.extraSystemContext.trim());
  }

  const system: OpenAIChatMessage = {
    role: "system",
    content: parts.join("\n"),
  };

  return postChatCompletion([
    system,
    ...history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ]);
}
