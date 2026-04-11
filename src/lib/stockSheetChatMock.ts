import type { StockPin } from "@/types/stock";

/** 시트 내 미니 챗봇 — 실제 서비스에서는 API로 교체 */
export function getStockSheetChatReply(stock: StockPin, userText: string): string {
  const t = userText.toLowerCase();
  const up = stock.changePercent >= 0;

  if (/요약|한줄|간단|알려|뭐하는|사업|무엇/.test(t)) {
    return `${stock.name}은(는) ${stock.sector} 업종으로, ${stock.description}\n\n※ 지도에 표시된 정보는 학습·데모용이며 투자 판단의 근거로 삼지 마세요.`;
  }

  if (/주가|가격|등락|오늘|변동/.test(t)) {
    return `현재가는 ${stock.price.toLocaleString()}원이고, 전일 대비 ${up ? "+" : ""}${stock.changePercent}%입니다.\n\n실시간 시세는 증권사 앱에서 확인하는 것이 정확합니다.`;
  }

  if (/업종|섹터|산업/.test(t)) {
    return `${stock.name}의 업종은 「${stock.sector}」입니다. 같은 업종 내 다른 기업과 비교할 때 참고하세요.`;
  }

  if (/리스크|위험|주의|조심|단점/.test(t)) {
    return `일반적으로 투자 시에는 다음을 함께 살펴보세요.\n• 업황·경기 민감도\n• 재무제표·부채비율\n• 분산 투자\n\n${stock.name}에 대한 구체적인 투자 판단은 전문가 상담을 권장합니다.`;
  }

  if (/광고|스폰|협찬/.test(t)) {
    return stock.isSponsored
      ? "이 종목은 앱 내에서 광고로 노출될 수 있는 핀입니다. 표시는 참고용이며, 광고 여부와 투자 적합성은 별개입니다."
      : "현재 이 핀은 일반 노출로 표시됩니다.";
  }

  if (/매수|살까|살 수|캐시/.test(t)) {
    return `캐시로 매수하려면 현재가보다 캐시 잔고가 충분해야 합니다. (현재가 ${stock.price.toLocaleString()}원)\n\n실제 매매는 연결된 증권 계좌 정책을 따릅니다.`;
  }

  return `「${userText.trim()}」에 대해 ${stock.name} 기준으로 답하자면,\n\n${stock.description}\n\n더 구체적으로 물어보시면 예: "한줄 요약", "주가 의미", "리스크" 같은 키워드로도 질문해 보세요.`;
}
