import { MapPin, TrendingUp, TrendingDown, ChevronRight } from "lucide-react";
import type { TrendingStock } from "@/types/stock";

interface TrendingSectionProps {
  stocks: TrendingStock[];
}

const TrendingSection = ({ stocks }: TrendingSectionProps) => {
  return (
    <div
      className="rounded-2xl border border-border/60 bg-card/95 p-4 shadow-md backdrop-blur-sm supports-[backdrop-filter]:bg-card/90"
      data-testid="trending-section"
    >
      <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-bold text-foreground">
        <MapPin className="h-4 w-4 text-accent" />
        근처 동네 인기 종목
      </h3>
      <div className="space-y-3">
        {stocks.map((stock) => {
          const isUp = stock.changePercent >= 0;
          return (
            <button
              key={stock.ticker}
              className="flex w-full min-h-[44px] items-center justify-between rounded-xl bg-muted/50 px-3 py-2 transition-colors hover:bg-muted"
              aria-label={`${stock.name} 상세 보기`}
            >
              <div className="text-left">
                <p className="text-sm font-semibold text-foreground">{stock.name}</p>
                <p className="text-xs text-muted-foreground">
                  {stock.district} · {(stock.distance / 1000).toFixed(1)}km
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-right">
                  <p className="text-sm font-bold text-foreground">
                    {stock.price.toLocaleString()}원
                  </p>
                  <p
                    className={`flex items-center justify-end gap-0.5 text-xs font-medium ${
                      isUp ? "text-destructive" : "text-accent"
                    }`}
                  >
                    {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {isUp ? "+" : ""}
                    {stock.changePercent}%
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default TrendingSection;
