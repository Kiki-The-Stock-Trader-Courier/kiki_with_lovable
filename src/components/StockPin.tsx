import { Marker, Popup } from "react-leaflet";
import L from "leaflet";
import type { StockPin as StockPinType } from "@/types/stock";

interface StockPinProps {
  stock: StockPinType;
  /** 사용자 보유 종목이면 핀 색상을 다르게 표시 */
  isOwned?: boolean;
  /** 지도 중심 반경 밖이면 회색으로 표시 */
  isOutOfRadius?: boolean;
  onSelect: (stock: StockPinType) => void;
}

/** SVG 속성값 이스케이프 */
function escapeXmlAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/**
 * 업종 → 핀 중앙에 넣을 작은 아이콘 (24×24 좌표계, (12,12) 기준으로 스케일)
 * — 실제 기업 로고 URL이 있으면 그걸 우선 표시
 */
function sectorIconInner(sector: string, color: string): string {
  const g = (body: string) =>
    `<g transform="translate(16 15) scale(0.52) translate(-12 -12)" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</g>`;

  switch (sector) {
    case "반도체":
      // 칩 / CPU 느낌
      return g(
        `<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6" rx="1" fill="${color}" stroke="none"/><path d="M9 2v2M15 2v2M9 20v2M15 20v2M22 9h2M22 15h2M0 9h2M0 15h2"/>`
      );
    case "IT":
      return g(`<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/>`);
    case "바이오":
      return g(`<path d="M10 2v5.5"/><path d="M14 2v5.5"/><path d="M8 10h8a4 4 0 0 1 0 8H8a4 4 0 0 1 0-8z"/>`);
    case "화학":
      return g(`<path d="M9 3h6l-1 7a4 4 0 1 1-4 0L9 3z"/><path d="M12 14v7"/>`);
    case "2차전지":
      return g(
        `<rect x="7" y="6" width="10" height="14" rx="2"/><path d="M10 6V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2"/><path d="M12 10v4"/>`
      );
    case "금융":
      return g(
        `<path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 21v-4h6v4"/><path d="M10 11h4"/>`
      );
    case "유통":
      // 쇼핑백 + 손잡이 (편의점/리테일 느낌)
      return g(
        `<rect x="5" y="8" width="14" height="12" rx="2"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/><path d="M10 13h4"/><path d="M12 11v4"/>`
      );
    case "건설":
      return g(`<path d="m3 21 9-9 9 9"/><path d="M9 21v-6a3 3 0 0 1 6 0v6"/><path d="M12 3v4"/>`);
    case "지주":
      return g(
        `<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><path d="M12 12v4"/><circle cx="12" cy="12" r="1" fill="${color}" stroke="none"/>`
      );
    default:
      return g(`<circle cx="12" cy="12" r="8"/><path d="M12 8v8M8 12h8"/>`);
  }
}

function logoOrSectorInner(stock: StockPinType, color: string): string {
  if (stock.logoUrl) {
    /** 로고 로드 실패 시 바로 앞의 업종 아이콘 그룹을 표시 */
    return `
      <g class="stock-pin-sector-fallback" style="display:none">${sectorIconInner(stock.sector, color)}</g>
      <foreignObject x="6" y="5" width="20" height="20">
        <div xmlns="http://www.w3.org/1999/xhtml" style="margin:0;padding:0;width:20px;height:20px;">
          <img
            src="${escapeXmlAttr(stock.logoUrl)}"
            width="20"
            height="20"
            alt=""
            decoding="async"
            loading="lazy"
            referrerpolicy="no-referrer"
            style="display:block;width:20px;height:20px;border-radius:50%;object-fit:cover;"
            onerror="var fo=this.closest('foreignObject');var g=fo&amp;&amp;fo.previousElementSibling;if(g)g.style.display='block';if(fo)fo.remove();"
          />
        </div>
      </foreignObject>`;
  }
  return sectorIconInner(stock.sector, color);
}

const createPinIcon = (stock: StockPinType, isOwned: boolean, isOutOfRadius: boolean) => {
  /** 기본은 노란색, 보유는 파란색, 반경 밖은 비활성 회색 */
  const color = isOutOfRadius
    ? "#9CA3AF"
    : isOwned
      ? "#2563EB"
      : "#FACC15";
  const inner = logoOrSectorInner(stock, color);

  return L.divIcon({
    className: "stock-pin-icon",
    html: `
      <svg width="34" height="42" viewBox="0 0 34 42" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect x="5" y="2" width="24" height="24" rx="8" fill="${color}"/>
        <path d="M17 40L10.8 26h12.4L17 40z" fill="${color}"/>
        <circle cx="17" cy="14" r="8.5" fill="white" opacity="0.98"/>
        ${inner}
      </svg>
    `,
    iconSize: [34, 42],
    iconAnchor: [17, 40],
    popupAnchor: [0, -42],
  });
};

const StockPinMarker = ({ stock, isOwned = false, isOutOfRadius = false, onSelect }: StockPinProps) => {
  return (
    <Marker
      position={[stock.lat, stock.lng]}
      icon={createPinIcon(stock, isOwned, isOutOfRadius)}
      eventHandlers={{
        click: () => onSelect(stock),
      }}
    >
      <Popup>
        <div className="text-center p-1">
          <p className="font-bold text-sm">{stock.name}</p>
          <p className="text-xs text-muted-foreground">{stock.ticker}</p>
        </div>
      </Popup>
    </Marker>
  );
};

export default StockPinMarker;
