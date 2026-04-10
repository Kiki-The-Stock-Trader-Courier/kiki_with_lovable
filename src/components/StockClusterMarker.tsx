import { useMemo } from "react";
import { Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { TrendingUp } from "lucide-react";
import type { StockPin } from "@/types/stock";

/** 참고 UI: 주황빨강 원 + 흰 숫자 + 흰 테두리 */
function createClusterIcon(count: number, muted: boolean) {
  const bg = muted ? "#9CA3AF" : "#E85D4C";
  return L.divIcon({
    className: "stock-cluster-marker-icon",
    html: `<div style="width:36px;height:36px;border-radius:9999px;background:${bg};color:#fff;font-weight:700;font-size:14px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 10px rgba(0,0,0,.2);border:2px solid #fff;">${count}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  });
}

interface StockClusterMarkerProps {
  stocks: StockPin[];
  lat: number;
  lng: number;
  isMuted: boolean;
  onSelectStock: (stock: StockPin) => void;
}

/**
 * 동일 건물(동일 좌표) 복수 종목 — 숫자 클러스터 마커 + 목록 팝업(참고 이미지 스타일)
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
      <Popup className="stock-cluster-leaflet-popup" maxWidth={320} minWidth={260}>
        <div className="stock-cluster-popup-inner bg-white p-1">
          <ul className="divide-y divide-slate-200/90">
            {stocks.map((stock) => (
              <li key={stock.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left transition-colors hover:bg-slate-50"
                  onClick={() => onSelectStock(stock)}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                      isMuted ? "bg-slate-200 text-slate-600" : "bg-[#E53935] text-white"
                    }`}
                    aria-hidden
                  >
                    <span className="sr-only">종목</span>
                    <TrendingUp className="h-[18px] w-[18px]" strokeWidth={2.5} />
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-bold leading-snug text-slate-900">
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
