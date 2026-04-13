import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { TrendingUp, TrendingDown, X, ShoppingCart, Building2, Tag, Bookmark, BookmarkCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import StockSheetChat from "@/components/StockSheetChat";
import type { StockPin } from "@/types/stock";
import { MOCK_STOCKS } from "@/data/mockStocks";
import { fetchYahooQuotes, normalizeKrxTickerKey } from "@/lib/quoteApi";
import { SECTOR_QUEST_REWARD_WON, SECTOR_QUEST_TARGET } from "@/lib/sectorQuest";

interface StockInfoSheetProps {
  stock: StockPin | null;
  onClose: () => void;
  cashBalance: number;
  isScrapped: boolean;
  onToggleScrap: () => void;
  onBuyStock: (order: { ticker: string; name: string; price: number; shares: number }) => Promise<{
    ok: boolean;
    message: string;
  }>;
  /**
   * 지도 강조 원(반경) 안에 있을 때만 캐시 매수 허용.
   * false면 회색(원 밖) 핀과 동일하게 매수 버튼 비활성.
   */
  mapRadiusPurchaseAllowed?: boolean;
  /** 보유 종목인 경우 티커 아래에 안내 표시 */
  isOwned?: boolean;
  /** 지도 원 안 업종 수집 퀘스트 진행도 */
  sectorQuest?: { count: number; target: number; rewardClaimed: boolean } | null;
}

/** 매수 입력란 기본값: 1주 미만이면 전액(소수 주), 이상이면 1주 */
function defaultBuyQtyPrompt(maxShares: number): string {
  if (maxShares <= 1e-9) return "0";
  if (maxShares < 1) return maxShares.toFixed(6).replace(/\.?0+$/, "");
  return "1";
}

/** 시트가 열리면 부모 state를 기다리지 않고 즉시 /api/quotes 호출 → 체감 지연 감소 */
/** 최소 1,000원 이상·너무 작은 소수 주(0.00001주 등) 매수 버튼 비활성 */
const MIN_CASH_TO_BUY_WON = 1000;
const MIN_AFFORDABLE_SHARES = 1e-4;
const STOCK_SHEET_MIN_HEIGHT_VH = 45;
const STOCK_SHEET_MAX_HEIGHT_VH = 92;
const RESIZE_HANDLE_IMAGE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='96' height='20' viewBox='0 0 96 20' fill='none'>
      <rect x='20' y='7' width='56' height='6' rx='3' fill='#8E8E96' fill-opacity='0.58'/>
    </svg>`,
  );

function normalizeTickerDigits(raw: string): string {
  const digits = String(raw).replace(/\D/g, "");
  return digits.length <= 6 ? digits.padStart(6, "0") : digits.slice(-6);
}

const StockInfoSheet = ({
  stock,
  onClose,
  cashBalance,
  isScrapped,
  onToggleScrap,
  onBuyStock,
  mapRadiusPurchaseAllowed = true,
  isOwned = false,
  sectorQuest = null,
}: StockInfoSheetProps) => {
  const [liveQuote, setLiveQuote] = useState<{ price: number; changePercent: number } | null>(null);
  const [sheetHeightVh, setSheetHeightVh] = useState(76);
  const dragRef = useRef<{ startY: number; startHeightVh: number } | null>(null);

  useEffect(() => {
    if (!stock) {
      setLiveQuote(null);
      return;
    }
    const key = normalizeKrxTickerKey(stock.ticker);
    if (!key) {
      setLiveQuote(null);
      return;
    }
    let canceled = false;
    const loadQuote = async () => {
      try {
        const qs = await fetchYahooQuotes([key]);
        if (canceled) return;
        const q = qs[0];
        if (q && q.price > 0) {
          setLiveQuote({ price: Math.round(q.price), changePercent: q.changePercent });
        }
      } catch {
        // 네트워크 실패 시 마지막 표시값 유지
      }
    };
    void loadQuote();
    const timer = window.setInterval(() => {
      void loadQuote();
    }, 12000);
    return () => {
      canceled = true;
      window.clearInterval(timer);
    };
  }, [stock?.ticker]);

  useEffect(() => {
    const onPointerMove = (ev: PointerEvent) => {
      if (!dragRef.current) return;
      const deltaY = ev.clientY - dragRef.current.startY;
      const deltaVh = (deltaY / window.innerHeight) * 100;
      const nextHeight = dragRef.current.startHeightVh - deltaVh;
      setSheetHeightVh(Math.min(STOCK_SHEET_MAX_HEIGHT_VH, Math.max(STOCK_SHEET_MIN_HEIGHT_VH, nextHeight)));
    };
    const onPointerUp = () => {
      dragRef.current = null;
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, []);

  const handleResizeStart = (e: ReactPointerEvent<HTMLButtonElement>) => {
    dragRef.current = { startY: e.clientY, startHeightVh: sheetHeightVh };
  };

  if (!stock) return null;

  // 요청사항: 0원이 나오지 않도록 현재 종목 주가(없으면 목업 주가)로 보정
  const directPrice = Number.isFinite(liveQuote?.price) ? Math.round(liveQuote!.price) : Math.round(stock.price);
  const fallbackMockPrice =
    MOCK_STOCKS.find((s) => normalizeTickerDigits(s.ticker) === normalizeTickerDigits(stock.ticker))?.price ?? 0;
  const safePrice = directPrice > 0 ? directPrice : fallbackMockPrice;
  const safeChangePct = Number.isFinite(liveQuote?.changePercent) ? liveQuote!.changePercent : stock.changePercent;
  const isUp = safeChangePct >= 0;
  const hasPrice = safePrice > 0;
  /** 보유 캐시로 살 수 있는 최대 주식 수량(소수 주 포함) */
  const maxAffordableShares = hasPrice ? cashBalance / safePrice : 0;
  const withinMapRadius = mapRadiusPurchaseAllowed;
  const hasMeaningfulSize =
    cashBalance >= MIN_CASH_TO_BUY_WON && maxAffordableShares >= MIN_AFFORDABLE_SHARES;
  const canBuy = hasPrice && withinMapRadius && hasMeaningfulSize;
  /** 캐시 < 1주 가격일 때 안내용 (기존과 동일) */
  const affordableShares = maxAffordableShares;

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
      <div
        className="animate-slide-up absolute inset-x-0 bottom-0 overflow-y-auto rounded-t-2xl border border-border/50 bg-chat-sheet shadow-sheet"
        style={{ height: `${sheetHeightVh}dvh`, maxHeight: "92dvh" }}
      >
        <div className="p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
        {/* Handle: 상단 드래그로 시트 높이 조절 */}
        <button
          type="button"
          onPointerDown={handleResizeStart}
          className="mx-auto mb-3 mt-[-0.25rem] flex h-7 w-24 cursor-ns-resize items-center justify-center rounded-full touch-none"
          aria-label="종목 상세 창 높이 조절"
        >
          <img
            src={RESIZE_HANDLE_IMAGE}
            alt=""
            className="pointer-events-none h-5 w-24 select-none"
            draggable={false}
          />
        </button>

        {/* Header: 종목명 + 매수/캐시 부족 + 액션(닫기/스크랩) */}
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold text-foreground">{stock.name}</h2>
              <p className="text-sm text-muted-foreground">{stock.ticker}</p>
              {isOwned ? <p className="mt-0.5 text-xs text-muted-foreground">보유중</p> : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <Button
              size="sm"
              className="h-auto max-w-[9.5rem] shrink-0 rounded-xl px-2.5 py-2 text-xs font-bold shadow-sm sm:max-w-none sm:px-3 sm:text-sm"
              disabled={!hasPrice || !canBuy}
              onClick={() => {
                if (!hasPrice || !canBuy || maxAffordableShares < MIN_AFFORDABLE_SHARES) return;
                const raw = window.prompt(
                  `몇 주를 매수할까요?\n(최대 ${maxAffordableShares.toLocaleString("ko-KR", { maximumFractionDigits: 6 })}주, 소수 주 가능)`,
                  defaultBuyQtyPrompt(maxAffordableShares),
                );
                if (raw == null) return;
                const cleaned = String(raw).replace(/,/g, "").replace(/\s/g, "").trim();
                const qty = parseFloat(cleaned);
                if (!Number.isFinite(qty) || qty <= 0) {
                  window.alert("올바른 수량을 입력해 주세요. (예: 1, 0.5, 0.229)");
                  return;
                }
                if (qty > maxAffordableShares + 1e-8) {
                  window.alert(
                    `최대 ${maxAffordableShares.toLocaleString("ko-KR", { maximumFractionDigits: 6 })}주까지 매수할 수 있습니다.`,
                  );
                  return;
                }
                void (async () => {
                  const result = await onBuyStock({
                    ticker: stock.ticker,
                    name: stock.name,
                    price: safePrice,
                    shares: qty,
                  });
                  window.alert(result.message);
                })();
              }}
              data-testid="buy-stock-button"
              aria-label={
                !hasPrice
                  ? "시세 확인 후 매수 가능"
                  : !withinMapRadius
                    ? "지도 반경 밖 종목은 캐시 매수 불가"
                    : canBuy
                      ? `${stock.name} 캐시로 매수, 최대 ${maxAffordableShares.toLocaleString("ko-KR", { maximumFractionDigits: 6 })}주`
                      : cashBalance < MIN_CASH_TO_BUY_WON
                        ? `보유 ${cashBalance.toLocaleString()}원, 최소 매수 가능 금액은 ${MIN_CASH_TO_BUY_WON.toLocaleString()}원`
                        : `보유 ${cashBalance.toLocaleString()}원, 구매 가능 ${affordableShares.toFixed(4)}주`
              }
            >
              <ShoppingCart className="mr-1 h-4 w-4 shrink-0 sm:mr-1.5 sm:h-4 sm:w-4" />
              <span className="flex min-w-0 flex-col items-start gap-0.5 text-left leading-tight">
                {!hasPrice ? (
                  <span className="flex flex-1 flex-col items-center justify-center text-center leading-tight">
                    <span>매수하기</span>
                  </span>
                ) : !withinMapRadius ? (
                  <>
                    <span>매수 불가</span>
                    <span className="text-[10px] font-normal opacity-90 sm:text-xs">
                      원 안 종목만 매수
                    </span>
                  </>
                ) : canBuy ? (
                  <span className="flex flex-1 flex-col items-center justify-center text-center leading-tight">
                    <span>매수하기</span>
                  </span>
                ) : (
                  <>
                    <span className="text-[10px] font-normal opacity-90 sm:text-xs">
                      보유 {cashBalance.toLocaleString()}원
                    </span>
                    <span className="text-[10px] font-normal opacity-90 sm:text-xs">
                      {cashBalance < MIN_CASH_TO_BUY_WON
                        ? "최소 매수 가능 금액은 1,000원"
                        : `구매 가능 ${affordableShares.toFixed(6)}주 (0.0001주 미만)`}
                    </span>
                  </>
                )}
              </span>
            </Button>
            {/* 요청사항: 닫기 버튼을 위로 올리고, 같은 위치에 스크랩 버튼 추가 */}
            <div className="flex shrink-0 flex-col items-center gap-1">
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-muted transition-colors hover:bg-muted/80"
                aria-label="닫기"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
              <button
                type="button"
                onClick={onToggleScrap}
                className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
                  isScrapped ? "bg-primary/15 hover:bg-primary/20" : "bg-muted hover:bg-muted/80"
                }`}
                aria-label={isScrapped ? "스크랩 해제" : "스크랩"}
                aria-pressed={isScrapped}
              >
                {isScrapped ? (
                  <BookmarkCheck className="h-4 w-4 text-primary" />
                ) : (
                  <Bookmark className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Price */}
        <div className="mb-4 rounded-xl bg-muted/50 p-4">
          <p className="mb-1 text-sm text-muted-foreground">현재가</p>
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground">{safePrice.toLocaleString()}원</span>
            <span
              className={`flex items-center gap-1 text-sm font-semibold ${
                isUp ? "text-destructive" : "text-accent"
              }`}
            >
              {isUp ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              {isUp ? "+" : ""}
              {safeChangePct.toFixed(2)}%
            </span>
          </div>
        </div>

        {/* Info */}
        <div className="mb-4 space-y-3">
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
          {sectorQuest ? (
            <div className="rounded-xl border border-primary/25 bg-primary/5 px-3 py-2.5 text-xs leading-relaxed text-foreground">
              <p className="font-semibold text-primary">업종 수집 퀘스트</p>
              <p className="mt-1 text-muted-foreground">
                지도 강조 원 안에서 이 업종의 서로 다른 종목{" "}
                <strong className="text-foreground">
                  {sectorQuest.count}/{sectorQuest.target}
                </strong>
                개를 발견했어요.
                {sectorQuest.rewardClaimed
                  ? ` · 달성 보상(${SECTOR_QUEST_REWARD_WON.toLocaleString("ko-KR")}원) 수령 완료`
                  : ` · ${SECTOR_QUEST_TARGET}개 모으면 캐시 ${SECTOR_QUEST_REWARD_WON.toLocaleString("ko-KR")}원`}
              </p>
            </div>
          ) : null}
        </div>

        <StockSheetChat
          stock={{ ...stock, price: safePrice, changePercent: safeChangePct }}
          isScrapped={isScrapped}
          onToggleScrap={onToggleScrap}
        />
        </div>
      </div>
    </div>
  );
};

export default StockInfoSheet;
