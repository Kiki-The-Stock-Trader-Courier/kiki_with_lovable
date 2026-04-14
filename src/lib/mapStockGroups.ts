import type { StockPin } from "@/types/stock";

/**
 * 위·경도 소수 5자리(약 1.1m)까지 같으면 같은 지도 픽셀에 겹친다고 보고 한 그룹으로 묶음.
 */
export function groupStocksByOverlappingCoords(stocks: StockPin[]): StockPin[][] {
  const map = new Map<string, StockPin[]>();
  for (const s of stocks) {
    const key = `${Number(s.lat).toFixed(5)}_${Number(s.lng).toFixed(5)}`;
    const list = map.get(key);
    if (list) list.push(s);
    else map.set(key, [s]);
  }
  return Array.from(map.values()).map((g) => [...g].sort((a, b) => a.name.localeCompare(b.name, "ko")));
}
