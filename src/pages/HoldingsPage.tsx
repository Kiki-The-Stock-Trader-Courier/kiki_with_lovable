import { BriefcaseBusiness, Bookmark } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { useUserData } from "@/hooks/useUserData";

const HoldingsPage = () => {
  const { holdings, scraps } = useUserData();
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
        {holdings.length === 0 ? (
          <div className="rounded-xl border border-border/60 bg-card p-6 text-center text-sm text-muted-foreground shadow-sm">
            보유 종목이 없습니다. 내 계좌 데이터가 연동되면 여기에 개인 종목이 표시됩니다.
          </div>
        ) : (
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
        )}

        {/* 요청사항: 보유 종목 탭에서 보유 종목 아래 스크랩 목록 표시 */}
        <div className="mt-6 rounded-xl border border-border/60 bg-card p-4 shadow-sm">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Bookmark className="h-4 w-4 text-primary" />
            스크랩한 종목
          </p>
          {scraps.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              아직 스크랩한 종목이 없습니다. 지도에서 종목 시트를 열고 북마크 버튼을 눌러 추가하세요.
            </p>
          ) : (
            <div className="space-y-2">
              {scraps.map((s) => (
                <div
                  key={s.ticker}
                  className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/20 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{s.ticker} · {s.sector}</p>
                  </div>
                  <p className="shrink-0 text-[10px] text-muted-foreground">
                    {new Date(s.savedAt).toLocaleDateString("ko-KR")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default HoldingsPage;
