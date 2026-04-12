import { useEffect, useMemo, useState } from "react";
import { BriefcaseBusiness, Bookmark } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { useUserData } from "@/hooks/useUserData";
import { MOCK_STOCKS } from "@/data/mockStocks";
import { fetchYahooQuotes, normalizeKrxTickerKey } from "@/lib/quoteApi";
import type { ScrappedStock } from "@/types/stock";

const HoldingsPage = () => {
  const { holdings, scraps } = useUserData();
  const [scrapQuotes, setScrapQuotes] = useState<Record<string, number>>({});

  const mockPriceByTicker = useMemo(() => {
    const m = new Map<string, number>();
    for (const pin of MOCK_STOCKS) {
      const k = normalizeKrxTickerKey(pin.ticker);
      if (k) m.set(k, pin.price);
    }
    return m;
  }, []);

  const scrapTickerKey = useMemo(
    () =>
      scraps
        .map((s) => normalizeKrxTickerKey(s.ticker))
        .filter((t): t is string => t != null)
        .sort()
        .join(","),
    [scraps],
  );

  useEffect(() => {
    const keys = scrapTickerKey.split(",").filter(Boolean);
    if (keys.length === 0) {
      setScrapQuotes({});
      return;
    }

    let canceled = false;
    const load = async () => {
      try {
        const qs = await fetchYahooQuotes(keys);
        if (canceled) return;
        const next: Record<string, number> = {};
        for (const q of qs) {
          const k = normalizeKrxTickerKey(q.ticker);
          if (k) next[k] = Math.round(q.price);
        }
        setScrapQuotes(next);
      } catch {
        if (!canceled) setScrapQuotes({});
      }
    };

    void load();
    const timer = setInterval(load, 12_000);
    return () => {
      canceled = true;
      clearInterval(timer);
    };
  }, [scrapTickerKey]);

  const resolveScrapPrice = (s: ScrappedStock): number | null => {
    const k = normalizeKrxTickerKey(s.ticker);
    if (!k) return null;
    const live = scrapQuotes[k];
    if (live != null && live > 0) return live;
    if (typeof s.price === "number" && s.price > 0) return s.price;
    const h = holdings.find((x) => normalizeKrxTickerKey(x.ticker) === k);
    if (h && h.currentPrice > 0) return h.currentPrice;
    const mock = mockPriceByTicker.get(k);
    return mock != null && mock > 0 ? mock : null;
  };
  return (
    <div className="app-page-shell mx-auto min-h-[100dvh] w-full max-w-lg pb-24" data-testid="holdings-screen">
      <div className="tab-hero-panel px-5 pb-5 pt-[calc(env(safe-area-inset-top,0px)+20px)] sm:rounded-b-2xl">
        <h1 className="mb-2 flex items-center gap-2 font-display text-xl font-bold tracking-tight text-foreground">
          <BriefcaseBusiness className="h-5 w-5 text-primary" />
          보유 종목
        </h1>
        <p className="text-sm text-muted-foreground">현재 보유한 종목과 손익 현황</p>
      </div>

      <div className="px-4 pb-2 pt-3">
        {holdings.length === 0 ? (
          <div className="tab-card-surface rounded-xl p-6 text-center text-sm text-muted-foreground">
            보유 종목이 없습니다. 내 계좌 데이터가 연동되면 여기에 개인 종목이 표시됩니다.
          </div>
        ) : (
          <div className="space-y-3">
            {holdings.map((h) => {
              const pnl = (h.currentPrice - h.avgPrice) * h.shares;
              const pnlPercent = ((h.currentPrice - h.avgPrice) / h.avgPrice) * 100;
              const isUp = pnl >= 0;
              const principal = h.avgPrice * h.shares;
              const marketValue = principal + pnl;
              return (
                <div key={h.ticker} className="space-y-2">
                  <div className="rounded-xl border border-border/70 bg-muted/45 p-4 shadow-sm dark:bg-muted/30">
                    <p className="text-center font-display text-lg font-bold tabular-nums text-foreground">
                      {marketValue.toLocaleString("ko-KR")}원
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border/50 pt-3">
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">원금</p>
                        <p className="mt-0.5 truncate text-sm font-semibold tabular-nums text-foreground">
                          {principal.toLocaleString("ko-KR")}원
                        </p>
                      </div>
                      <div className="min-w-0 text-right">
                        <p className="text-xs text-muted-foreground">총 수익</p>
                        <p
                          className={`mt-0.5 truncate text-sm font-semibold tabular-nums ${isUp ? "text-destructive" : "text-accent"}`}
                        >
                          {isUp ? "+" : ""}
                          {pnl.toLocaleString("ko-KR")}원
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="tab-card-surface flex items-center justify-between rounded-xl p-4">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{h.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {h.shares.toLocaleString("ko-KR", { maximumFractionDigits: 6 })}주 · 평균 {h.avgPrice.toLocaleString()}원
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-foreground">{(h.currentPrice * h.shares).toLocaleString()}원</p>
                      <p className={`text-xs font-medium ${isUp ? "text-destructive" : "text-accent"}`}>
                        {isUp ? "+" : ""}{pnl.toLocaleString()}원 ({isUp ? "+" : ""}{pnlPercent.toFixed(1)}%)
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 요청사항: 보유 종목 탭에서 보유 종목 아래 스크랩 목록 표시 */}
        <div className="tab-card-surface mt-6 rounded-xl p-4">
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
              {scraps.map((s) => {
                const displayPrice = resolveScrapPrice(s);
                return (
                  <div
                    key={s.ticker}
                    className="tab-subtle-row flex items-center justify-between gap-3 rounded-lg px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{s.ticker} · {s.sector}</p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                      {displayPrice != null ? `${displayPrice.toLocaleString("ko-KR")}원` : "—"}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default HoldingsPage;
