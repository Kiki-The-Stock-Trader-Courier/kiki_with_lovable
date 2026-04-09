import { MapContainer, TileLayer, Circle, CircleMarker, useMap } from "react-leaflet";
import { useEffect, useRef } from "react";
import StockPinMarker from "./StockPin";
import type { StockPin } from "@/types/stock";

/** 부모에서 넘기는 위치 상태(대기/성공/거부 등) — 첫 고정 시 1회만 뷰 맞춤 */
export type UserMapLocationStatus = "pending" | "ok" | "denied" | "unsupported";

interface MapViewProps {
  center: { lat: number; lng: number };
  radius: number;
  stocks: StockPin[];
  onSelectStock: (stock: StockPin) => void;
  /** GPS 성공 시 사용자 위치 마커·정확도 원 표시 */
  showUserMarker?: boolean;
  /** 미터 단위, 있으면 반투명 정확도 원 */
  userAccuracyM?: number | null;
  /** 위치 권한·고정 상태 — 첫 `ok`일 때 지도를 한 번 사용자 좌표로 맞춤 */
  userLocationStatus?: UserMapLocationStatus;
  /**
   * 값이 바뀔 때마다(예: 「내 위치」 버튼) 현재 center 로 flyTo.
   * GPS 좌표가 이전과 같아도 지도를 사용자 위치로 다시 가져올 때 사용.
   */
  userRecenterSignal?: number;
}

const DEFAULT_MAP_ZOOM = 16;

/**
 * 첫 GPS 고정 시 1회 setView — 이후에는 사용자가 지도를 드래그해도 watch 좌표만 마커/원에 반영하고 뷰는 강제 이동하지 않음.
 */
function InitialUserFit({
  lat,
  lng,
  status,
}: {
  lat: number;
  lng: number;
  status: UserMapLocationStatus;
}) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || status !== "ok") return;
    done.current = true;
    map.setView([lat, lng], DEFAULT_MAP_ZOOM);
  }, [lat, lng, status, map]);
  return null;
}

/** 「내 위치 새로고침」 등 — 트리거가 바뀔 때마다 현재 좌표로 부드럽게 이동 */
function FlyToUserOnSignal({
  lat,
  lng,
  signal,
}: {
  lat: number;
  lng: number;
  signal: number;
}) {
  const map = useMap();
  const prev = useRef(0);
  useEffect(() => {
    if (signal <= 0 || signal === prev.current) return;
    prev.current = signal;
    map.flyTo([lat, lng], Math.max(map.getZoom(), 15), { duration: 0.75 });
  }, [signal, lat, lng, map]);
  return null;
}

/**
 * 첫 페인트·리사이즈 후 타일이 비는 문제 완화 (컨테이너 크기 재계산)
 */
function MapInvalidateSize() {
  const map = useMap();
  useEffect(() => {
    const run = () => map.invalidateSize({ animate: false });
    const raf = requestAnimationFrame(run);
    const delayed = window.setTimeout(run, 250);
    window.addEventListener("resize", run);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(delayed);
      window.removeEventListener("resize", run);
    };
  }, [map]);
  return null;
}

/** 마커 데이터가 늦게 들어올 때 타일/마커 레이어 재계산 */
function InvalidateWhenStocksChange({ count }: { count: number }) {
  const map = useMap();
  useEffect(() => {
    const t = window.setTimeout(() => map.invalidateSize({ animate: false }), 50);
    return () => window.clearTimeout(t);
  }, [count, map]);
  return null;
}

const MapView = ({
  center,
  radius,
  stocks,
  onSelectStock,
  showUserMarker = false,
  userAccuracyM = null,
  userLocationStatus = "pending",
  userRecenterSignal = 0,
}: MapViewProps) => {
  return (
    <div className="absolute inset-0 z-0 min-h-0 w-full" data-testid="map-wrapper">
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={DEFAULT_MAP_ZOOM}
        className="z-0 h-full w-full min-h-[100dvh]"
        style={{ minHeight: "100%" }}
        zoomControl={false}
        attributionControl
        scrollWheelZoom
        data-testid="map-container"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          subdomains={["a", "b", "c", "d"]}
          maxZoom={20}
        />
        <MapInvalidateSize />
        <InvalidateWhenStocksChange count={stocks.length} />
        <InitialUserFit lat={center.lat} lng={center.lng} status={userLocationStatus} />
        <FlyToUserOnSignal lat={center.lat} lng={center.lng} signal={userRecenterSignal} />

        {/* 반경 표시 — interactive 끄면 path가 클릭·드래그를 가로채지 않음 */}
        <Circle
          center={[center.lat, center.lng]}
          radius={radius}
          pathOptions={{
            color: "hsl(210, 60%, 55%)",
            fillColor: "hsl(210, 60%, 55%)",
            fillOpacity: 0.08,
            weight: 2,
            dashArray: "6 4",
            interactive: false,
          }}
        />

        {/* GPS 정확도(미터) — Leaflet Circle 사용 */}
        {showUserMarker && userAccuracyM != null && userAccuracyM > 0 && (
          <Circle
            center={[center.lat, center.lng]}
            radius={Math.min(userAccuracyM, 400)}
            pathOptions={{
              color: "hsl(217, 91%, 60%)",
              fillColor: "hsl(217, 91%, 60%)",
              fillOpacity: 0.12,
              weight: 1,
              interactive: false,
            }}
          />
        )}

        {/* 내 위치 점(픽셀 반경) */}
        {showUserMarker && (
          <CircleMarker
            center={[center.lat, center.lng]}
            radius={8}
            pathOptions={{
              color: "#ffffff",
              fillColor: "hsl(217, 91%, 55%)",
              fillOpacity: 1,
              weight: 3,
              interactive: false,
            }}
          />
        )}

        {/* 주식 핀 */}
        {stocks.map((stock) => (
          <StockPinMarker
            key={stock.id}
            stock={stock}
            onSelect={onSelectStock}
          />
        ))}
      </MapContainer>
    </div>
  );
};

export default MapView;
