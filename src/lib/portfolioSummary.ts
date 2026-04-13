import type { HoldingStock } from "@/types/stock";

/** 보유 종목 전체: 원금 합, 평가손익 합, 평가액(시가총액) = 원금+손익 */
export function getPortfolioSummary(holdings: HoldingStock[]) {
  let totalPrincipal = 0;
  let totalPnl = 0;
  for (const h of holdings) {
    totalPrincipal += h.avgPrice * h.shares;
    totalPnl += (h.currentPrice - h.avgPrice) * h.shares;
  }
  return {
    totalPrincipal,
    totalPnl,
    totalMarket: totalPrincipal + totalPnl,
  };
}
