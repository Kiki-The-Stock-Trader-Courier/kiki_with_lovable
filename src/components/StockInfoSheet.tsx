import { TrendingUp, TrendingDown, X, ShoppingCart, Building2, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import StockSheetChat from "@/components/StockSheetChat";
import type { StockPin } from "@/types/stock";

interface StockInfoSheetProps {
  stock: StockPin | null;
  onClose: () => void;
  cashBalance: number;
}

const StockInfoSheet = ({ stock, onClose, cashBalance }: StockInfoSheetProps) => {
  if (!stock) return null;

  const isUp = stock.changePercent >= 0;
  const canBuy = cashBalance >= stock.price;
  const affordableShares = stock.price > 0 ? cashBalance / stock.price : 0;

  return (
    <div className="animate-fade-in fixed inset-0 z-[1400]" data-testid="stock-info-sheet">
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-foreground/25 backdrop-blur-[2px] transition-opacity"
        onClick={onClose}
        aria-label="닫기"
      />

      {/* Sheet */}
      <div className="animate-slide-up absolute inset-x-0 bottom-0 max-h-[92dvh] overflow-y-auto rounded-t-2xl border border-border/50 bg-card shadow-sheet">
        <div className="p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
        {/* Handle */}
        <div className="mx-auto mb-4 h-1 w-10 shrink-0 rounded-full bg-muted" />

        {/* Header: 종목명 + 매수/캐시 부족 + 닫기 */}
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold text-foreground">{stock.name}</h2>
              <p className="text-sm text-muted-foreground">{stock.ticker}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <Button
              size="sm"
              className="h-auto max-w-[9.5rem] shrink-0 rounded-xl px-2.5 py-2 text-xs font-bold shadow-sm sm:max-w-none sm:px-3 sm:text-sm"
              disabled={!canBuy}
              data-testid="buy-stock-button"
              aria-label={
                canBuy
                  ? `${stock.name} 캐시로 매수 (${stock.price.toLocaleString()}원)`
                  : `캐시 부족 (보유 ${cashBalance.toLocaleString()}원, 구매 가능 ${affordableShares.toFixed(4)}주)`
              }
            >
              <ShoppingCart className="mr-1 h-4 w-4 shrink-0 sm:mr-1.5 sm:h-4 sm:w-4" />
              <span className="flex min-w-0 flex-col items-start gap-0.5 text-left leading-tight">
                {canBuy ? (
                  <>
                    <span>매수하기</span>
                    <span className="text-[10px] font-normal opacity-90 sm:text-xs">
                      {stock.price.toLocaleString()}원
                    </span>
                  </>
                ) : (
                  <>
                    <span>캐시 부족</span>
                    <span className="text-[10px] font-normal opacity-90 sm:text-xs">
                      보유 {cashBalance.toLocaleString()}원
                    </span>
                    <span className="text-[10px] font-normal opacity-90 sm:text-xs">
                      구매 가능 {affordableShares.toFixed(4)}주
                    </span>
                  </>
                )}
              </span>
            </Button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted transition-colors hover:bg-muted/80"
              aria-label="닫기"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Price */}
        <div className="mb-4 rounded-xl bg-muted/50 p-4">
          <p className="mb-1 text-sm text-muted-foreground">현재가</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground">
              {stock.price.toLocaleString()}원
            </span>
            <span
              className={`flex items-center gap-1 text-sm font-semibold ${
                isUp ? "text-destructive" : "text-accent"
              }`}
            >
              {isUp ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              {isUp ? "+" : ""}
              {stock.changePercent}%
            </span>
          </div>
        </div>

        {/* Info */}
        <div className="mb-6 space-y-3">
          <div className="flex items-center gap-2 text-sm text-foreground">
            <Tag className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">업종:</span>
            <span className="font-medium">{stock.sector}</span>
            {stock.isSponsored && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                광고
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{stock.description}</p>
        </div>

        <StockSheetChat stock={stock} />
        </div>
      </div>
    </div>
  );
};

export default StockInfoSheet;
