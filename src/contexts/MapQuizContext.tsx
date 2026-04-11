import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { StockPin } from "@/types/stock";

/** 지도 강조 원과 동일 — 퀴즈 근거 반경 */
export const MAP_QUIZ_RADIUS_M = 1000;

export type MapQuizStockSnapshot = Pick<
  StockPin,
  "ticker" | "name" | "sector" | "lat" | "lng" | "price" | "changePercent"
>;

export type MapQuizSnapshot = {
  centerLat: number;
  centerLng: number;
  radiusM: number;
  stocks: MapQuizStockSnapshot[];
  updatedAt: number;
};

type MapQuizContextValue = {
  snapshot: MapQuizSnapshot | null;
  setSnapshot: (s: MapQuizSnapshot | null) => void;
};

const MapQuizContext = createContext<MapQuizContextValue | null>(null);

export function MapQuizProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<MapQuizSnapshot | null>(null);
  const value = useMemo(() => ({ snapshot, setSnapshot }), [snapshot]);
  return <MapQuizContext.Provider value={value}>{children}</MapQuizContext.Provider>;
}

export function useMapQuizSnapshot() {
  const ctx = useContext(MapQuizContext);
  if (!ctx) {
    throw new Error("useMapQuizSnapshot must be used within MapQuizProvider");
  }
  return ctx;
}

/** Index 전용: optional hook when provider 없을 때 no-op (테스트 등) */
export function useMapQuizSnapshotOptional() {
  return useContext(MapQuizContext);
}

function distanceMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const p =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(p), Math.sqrt(1 - p));
}

/** 원(반경) 안 종목만 스냅샷용으로 필터 */
export function buildMapQuizSnapshot(
  centerLat: number,
  centerLng: number,
  radiusM: number,
  stocks: StockPin[],
): MapQuizSnapshot {
  const inside = stocks.filter((s) => {
    const d = distanceMeters(centerLat, centerLng, s.lat, s.lng);
    return d <= radiusM;
  });
  return {
    centerLat,
    centerLng,
    radiusM,
    stocks: inside.map((s) => ({
      ticker: s.ticker,
      name: s.name,
      sector: s.sector,
      lat: s.lat,
      lng: s.lng,
      price: s.price,
      changePercent: s.changePercent,
    })),
    updatedAt: Date.now(),
  };
}
