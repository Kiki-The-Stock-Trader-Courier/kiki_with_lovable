import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, X, ShoppingCart, Building2, Tag, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import StockSheetChat from "@/components/StockSheetChat";
import type { StockPin } from "@/types/stock";
import { fetchYahooQuotes } from "@/lib/quoteApi";
import { parseTickersQuery } from "../../api/yahooKrxQuotesCore";

interface StockInfoSheetProps {
  stock: StockPin | null;
  onClose: () => void;
  cashBalance: number;
}

/** 시트가 열리면 부모 state를 기다리지 않고 즉시 /api/quotes 호출 → 체감 지연 감소 */
const StockInfoSheet = ({ stock, onClose, cashBalance }: StockInfoSheetProps) => {
  const [sheetQuote, setSheetQuote] = useState<{ price: number; changePercent: number } | null>(null);
  const [quoteError, setQuoteError] = useState(false);
  /** 시세 재요청 (다시 시도 버튼) */
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    if (!stock) {
      setSheetQuote(null);
      setQuoteError(false);
      return;
    }

    const codes = parseTickersQuery(String(stock.ticker));
    if (codes.length === 0) {
      setSheetQuote(null);
      setQuoteError(true);
      return;
    }
    const t = codes[0];

    let cancelled = false;
    setSheetQuote(null);
    setQuoteError(false);

    void (async () => {
      try {
        const qs = await fetchYahooQuotes([t]);
        if (cancelled) return;
        if (qs[0]) {
          setSheetQuote({
            price: Math.round(qs[0].price),
            changePercent: qs[0].changePercent,
          });
          setQuoteError(false);
        } else if (stock.price > 0) {
          /** API·Yahoo 빈 응답: 지도에서 이미 받은 시세로 표시 (완전 실패 UX 방지) */
          setSheetQuote({
            price: Math.round(stock.price),
            changePercent: stock.changePercent,
          });
          setQuoteError(false);
        } else {
          setQuoteError(true);
        }
      } catch {
        if (!cancelled) {
          if (stock.price > 0) {
            setSheetQuote({
              price: Math.round(stock.price),
              changePercent: stock.changePercent,
            });
            setQuoteError(false);
          } else {
            setSheetQuote(null);
            setQuoteError(true);
          }
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [stock, retryToken]);

  if (!stock) return null;

  const price = sheetQuote && sheetQuote.price > 0 ? sheetQuote.price : stock.price;
  const changePct = sheetQuote ? sheetQuote.changePercent : stock.changePercent;
  const isUp = changePct >= 0;
  const hasPrice = price > 0;
  const canBuy = hasPrice && cashBalance >= price;
  const affordableShares = hasPrice ? cashBalance / price : 0;

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
              disabled={!hasPrice || !canBuy}
              data-testid="buy-stock-button"
              aria-label={
                !hasPrice
                  ? "시세 확인 후 매수 가능"
                  : canBuy
                    ? `${stock.name} 캐시로 매수 (${price.toLocaleString()}원)`
                    : `보유 ${cashBalance.toLocaleString()}원, 구매 가능 ${affordableShares.toFixed(4)}주`
              }
            >
              <ShoppingCart className="mr-1 h-4 w-4 shrink-0 sm:mr-1.5 sm:h-4 sm:w-4" />
              <span className="flex min-w-0 flex-col items-start gap-0.5 text-left leading-tight">
                {!hasPrice ? (
                  <>
                    <span>매수하기</span>
                    <span className="text-[10px] font-normal opacity-90 sm:text-xs">시세 확인 중</span>
                  </>
                ) : canBuy ? (
                  <>
                    <span>매수하기</span>
                    <span className="text-[10px] font-normal opacity-90 sm:text-xs">
                      {price.toLocaleString()}원
                    </span>
                  </>
                ) : (
                  <>
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
          <div className="flex flex-wrap items-baseline gap-2">
            {hasPrice ? (
              <>
                <span className="text-2xl font-bold text-foreground">{price.toLocaleString()}원</span>
                <span
                  className={`flex items-center gap-1 text-sm font-semibold ${
                    isUp ? "text-destructive" : "text-accent"
                  }`}
                >
                  {isUp ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  {isUp ? "+" : ""}
                  {Number.isFinite(changePct) ? changePct.toFixed(2) : "0.00"}%
                </span>
              </>
            ) : quoteError ? (
              <div className="flex w-full flex-col gap-2">
                <span className="text-sm text-muted-foreground">
                  시세를 불러오지 못했습니다. 네트워크 또는 API 제한일 수 있습니다.
                </span>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="w-fit gap-1.5"
                  onClick={() => setRetryToken((k) => k + 1)}
                >
                  <RefreshCw className="h-4 w-4" />
                  다시 시도
                </Button>
              </div>
            ) : (
              <span className="text-lg font-medium text-muted-foreground">시세 불러오는 중…</span>
            )}
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

        <StockSheetChat stock={{ ...stock, price, changePercent: changePct }} />
        </div>
      </div>
    </div>
  );
};

export default StockInfoSheet;
