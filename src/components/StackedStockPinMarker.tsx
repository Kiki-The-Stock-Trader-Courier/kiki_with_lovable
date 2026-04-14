import { Marker, Popup, useMap } from "react-leaflet";
import type { StockPin as StockPinType } from "@/types/stock";
import { createPinIcon } from "./StockPin";
import { normalizeKrxTickerKey } from "@/lib/quoteApi";

interface StackedStockPinMarkerProps {
  stocks: StockPinType[];
  ownedTickerSet?: Set<string>;
  onSelect: (stock: StockPinType) => void;
}

/**
 * 동일 좌표(반올림 기준)에 여러 종목이 겹칠 때 — 핀에 개수 배지, 클릭 시 목록에서 선택
 */
function StackedStockPinPopupContent({
  stocks,
  ownedTickerSet,
  onSelect,
}: StackedStockPinMarkerProps) {
  const map = useMap();
  const pick = (s: StockPinType) => {
    onSelect(s);
    map.closePopup();
  };
  return (
        <div className="min-w-[220px] max-w-[min(280px,85vw)] p-1">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            같은 위치 · {stocks.length}곳 — 선택해 주세요
          </p>
          <ul className="max-h-52 space-y-1 overflow-y-auto pr-0.5">
            {stocks.map((s) => {
              const k = normalizeKrxTickerKey(s.ticker);
              const owned = k ? (ownedTickerSet?.has(k) ?? false) : false;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 rounded-lg border border-border/60 bg-card px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted/80 active:scale-[0.99]"
                    onClick={() => pick(s)}
                  >
                    <span className="min-w-0 flex-1 truncate font-medium">{s.name}</span>
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-xs ${
                        owned ? "bg-primary/15 text-primary" : "text-muted-foreground"
                      }`}
                    >
                      {s.ticker}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
  );
}

export default function StackedStockPinMarker({ stocks, ownedTickerSet, onSelect }: StackedStockPinMarkerProps) {
  if (stocks.length === 0) return null;
  const primary = stocks[0]!;
  const lat = primary.lat;
  const lng = primary.lng;
  const anyOwned = stocks.some((s) => {
    const k = normalizeKrxTickerKey(s.ticker);
    return k ? (ownedTickerSet?.has(k) ?? false) : false;
  });
  const icon = createPinIcon(primary, anyOwned, stocks.length);

  return (
    <Marker position={[lat, lng]} icon={icon} zIndexOffset={500}>
      <Popup className="stacked-stock-popup" maxWidth={280} offset={[14, -6]}>
        <StackedStockPinPopupContent stocks={stocks} ownedTickerSet={ownedTickerSet} onSelect={onSelect} />
      </Popup>
    </Marker>
  );
}
