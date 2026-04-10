import { useMemo } from "react";
import { Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { TrendingUp } from "lucide-react";
import type { StockPin } from "@/types/stock";

function createClusterIcon(count: number, muted: boolean) {
  const bg = muted ? "#9CA3AF" : "#EF4444";
  return L.divIcon({
    className: "stock-cluster-marker-icon",
    html: `<div style="width:34px;height:34px;border-radius:9999px;background:${bg};color:#fff;font-weight:700;font-size:13px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.22);border:2px solid #fff;">${count}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -17],
  });
}

interface StockClusterMarkerProps {
  stocks: StockPin[];
  lat: number;
  lng: number;
  /** 반경 밖만 모이면 회색 마커 */
  isMuted: boolean;
  onSelectStock: (stock: StockPin) => void;
}

/**
 * 동일 건물(동일 좌표)에 여러 종목이 있을 때 — 숫자 배지 + 목록 팝업
 */
export default function StockClusterMarker({
  stocks,
  lat,
  lng,
  isMuted,
  onSelectStock,
}: StockClusterMarkerProps) {
  const icon = useMemo(
    () => createClusterIcon(stocks.length, isMuted),
    [stocks.length, isMuted],
  );

  return (
    <Marker position={[lat, lng]} icon={icon} zIndexOffset={500}>
      <Popup className="stock-cluster-popup" maxWidth={300}>
        <div className="min-w-[220px] max-w-[280px] -m-1 rounded-xl border border-slate-200/80 bg-white shadow-lg">
          <ul className="divide-y divide-slate-100 p-0">
            {stocks.map((stock) => (
              <li key={stock.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-slate-50"
                  onClick={() => onSelectStock(stock)}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                      isMuted ? "bg-slate-100 text-slate-500" : "bg-red-50 text-red-600"
                    }`}
                    aria-hidden
                  >
                    <TrendingUp className="h-4 w-4" strokeWidth={2} />
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-semibold leading-snug text-slate-900">
                    {stock.name}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </Popup>
    </Marker>
  );
}
