import { BriefcaseBusiness, TrendingUp } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { useUserData } from "@/hooks/useUserData";

const HoldingsPage = () => {
  const { holdings } = useUserData();
  return (
    <div className="mx-auto min-h-[100dvh] w-full max-w-lg bg-background pb-24" data-testid="holdings-screen">
      <div className="bg-card px-5 pb-5 pt-[calc(env(safe-area-inset-top,0px)+20px)] sm:rounded-b-2xl sm:shadow-sm">
        <h1 className="mb-2 flex items-center gap-2 font-display text-xl font-bold tracking-tight text-foreground">
          <BriefcaseBusiness className="h-5 w-5 text-primary" />
          보유 종목
        </h1>
        <p className="text-sm text-muted-foreground">현재 보유한 종목과 손익 현황</p>
      </div>

      <div className="px-4 pb-2 pt-3">
        <div className="space-y-3">
          {holdings.map((h) => {
            const pnl = (h.currentPrice - h.avgPrice) * h.shares;
            const pnlPercent = ((h.currentPrice - h.avgPrice) / h.avgPrice) * 100;
            const isUp = pnl >= 0;
            return (
              <div
                key={h.ticker}
                className="flex items-center justify-between rounded-xl border border-border/60 bg-card p-4 shadow-sm"
              >
                <div>
                  <p className="text-sm font-semibold text-foreground">{h.name}</p>
                  <p className="text-xs text-muted-foreground">{h.shares}주 · 평균 {h.avgPrice.toLocaleString()}원</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-foreground">{(h.currentPrice * h.shares).toLocaleString()}원</p>
                  <p className={`text-xs font-medium ${isUp ? "text-destructive" : "text-accent"}`}>
                    {isUp ? "+" : ""}{pnl.toLocaleString()}원 ({isUp ? "+" : ""}{pnlPercent.toFixed(1)}%)
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 rounded-xl border border-border/60 bg-card p-4 shadow-sm">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
            <TrendingUp className="h-4 w-4 text-primary" />
            요약
          </p>
          <p className="text-xs text-muted-foreground">향후 실데이터(체결/평가손익) 연동 시 자동 갱신됩니다.</p>
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default HoldingsPage;
