import { MapContainer, TileLayer, Circle, CircleMarker, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import { useEffect, useMemo, useRef } from "react";
import StockPinMarker from "./StockPin";
import StackedStockPinMarker from "./StackedStockPinMarker";
import type { StockPin } from "@/types/stock";
import { normalizeKrxTickerKey } from "@/lib/quoteApi";
import { distanceMeters } from "@/lib/geoDistance";
import { groupStocksByOverlappingCoords } from "@/lib/mapStockGroups";

/** 부모에서 넘기는 위치 상태(대기/성공/거부 등) — 첫 고정 시 1회만 뷰 맞춤 */
export type UserMapLocationStatus = "pending" | "ok" | "denied" | "unsupported";

interface MapViewProps {
  center: { lat: number; lng: number };
  /** 보라색 강조 원 반경(미터) — 종목 핀은 이 원 안에 들어온 것만 표시 */
  radius: number;
  stocks: StockPin[];
  /** 보유 종목 티커(6자리) 집합 — 핀 색상 구분용 */
  ownedTickerSet?: Set<string>;
  onSelectStock: (stock: StockPin) => void;
  /** GPS 성공 시 사용자 위치 마커·정확도 원 표시 */
  showUserMarker?: boolean;
  /** 미터 단위, 있으면 반투명 정확도 원 */
  userAccuracyM?: number | null;
  /** 위치 권한·고정 상태 — 첫 `ok`일 때 지도를 한 번 사용자 좌표로 맞춤 */
  userLocationStatus?: UserMapLocationStatus;
  /**
   * 「내 위치」 버튼에서 받은 좌표 + token — React state 배치와 무관하게 flyTo.
   */
  userRecenterTarget?: { lat: number; lng: number; token: number } | null;
}

const DEFAULT_MAP_ZOOM = 16;
/** 「내 위치」 버튼 — 뷰포트 중심이 사용자 마커와 일치하도록 고정 줌으로 맞춤 */
const USER_RECENTER_ZOOM = 17;

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

/**
 * 「내 위치」 버튼: 패닝 후에도 반드시 해당 좌표가 화면 중앙에 오도록 뷰를 옮깁니다.
 * - 진행 중 pan/fly 애니메이션을 `stop()`으로 끊은 뒤 `setView` (flyTo는 동일 목적지로 스킵되는 경우가 있음).
 * - 타일/레이아웃 직후 한 프레임·짧은 지연으로 한 번 더 적용.
 */
function FlyToExplicitTarget({ target }: { target: { lat: number; lng: number; token: number } | null }) {
  const map = useMap();

  useEffect(() => {
    if (!target) return;

    const latlng = L.latLng(target.lat, target.lng);
    const zoom = USER_RECENTER_ZOOM;
    let cancelled = false;

    const apply = () => {
      if (cancelled) return;
      try {
        map.stop();
      } catch {
        /* Leaflet 내부 상태에 따라 stop 실패 무시 */
      }
      map.invalidateSize(false);
      map.setView(latlng, zoom, { animate: true });
    };

    apply();
    const raf = requestAnimationFrame(() => {
      if (!cancelled) apply();
    });
    const t1 = window.setTimeout(() => {
      if (!cancelled) apply();
    }, 80);
    const t2 = window.setTimeout(() => {
      if (!cancelled) apply();
    }, 350);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
    // token이 바뀔 때마다 객체 참조가 바뀌므로 클릭마다 실행됨
  }, [target, map]);

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
  ownedTickerSet,
  onSelectStock,
  showUserMarker = false,
  userAccuracyM = null,
  userLocationStatus = "pending",
  userRecenterTarget = null,
}: MapViewProps) => {
  /** 강조 원 밖 종목은 핀 미표시 (부모는 더 넓게 fetch할 수 있음) */
  const stocksVisibleInRadius = useMemo(
    () =>
      stocks.filter((s) => distanceMeters(center.lat, center.lng, s.lat, s.lng) <= radius),
    [stocks, center.lat, center.lng, radius],
  );

  /** 동일 좌표(≈1m) 겹침 → 한 핀에 개수 배지 + 팝업 목록 */
  const stockGroups = useMemo(
    () => groupStocksByOverlappingCoords(stocksVisibleInRadius),
    [stocksVisibleInRadius],
  );

  /** 내 위치 핀 — 종목 핀과 구분되는 티얼 마커 */
  const userLocationIcon = useMemo(
    () =>
      L.divIcon({
        className: "user-location-marker-icon",
        html: `<div class="user-location-marker-pin" role="presentation" aria-hidden="true">
<svg width="36" height="44" viewBox="0 0 36 44" xmlns="http://www.w3.org/2000/svg">
  <path d="M18 42s14-14 14-26C32 8 26 2 18 2S4 8 4 16c0 12 14 26 14 26z" fill="#DC2626" stroke="#FFFFFF" stroke-width="2.5"/>
  <circle cx="18" cy="16" r="5" fill="#fff"/>
</svg>
</div>`,
        iconSize: [36, 44],
        iconAnchor: [18, 42],
      }),
    [],
  );

  return (
    <div className="absolute inset-0 z-0 min-h-0 w-full" data-testid="map-wrapper">
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={DEFAULT_MAP_ZOOM}
        className="map-canvas z-0 h-full w-full min-h-[100dvh]"
        style={{ minHeight: "100%" }}
        zoomControl={false}
        attributionControl
        scrollWheelZoom
        data-testid="map-container"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          subdomains={["a", "b", "c", "d"]}
          maxZoom={20}
        />
        <MapInvalidateSize />
        <InvalidateWhenStocksChange count={stocks.length} />
        <InitialUserFit lat={center.lat} lng={center.lng} status={userLocationStatus} />
        <FlyToExplicitTarget target={userRecenterTarget} />

        {/* 반경 표시 — interactive 끄면 path가 클릭·드래그를 가로채지 않음 */}
        <Circle
          center={[center.lat, center.lng]}
          radius={radius}
          pathOptions={{
            color: "#690ACF",
            fillColor: "#690ACF",
            fillOpacity: 0.1,
            weight: 4,
            dashArray: "0",
            lineCap: "round",
            lineJoin: "round",
            interactive: false,
          }}
        />

        {/* GPS 정확도(미터) — Leaflet Circle 사용 */}
        {showUserMarker && userAccuracyM != null && userAccuracyM > 0 && (
          <Circle
            center={[center.lat, center.lng]}
            radius={Math.min(userAccuracyM, 400)}
            pathOptions={{
              color: "#593D63",
              fillColor: "#593D63",
              fillOpacity: 0.12,
              weight: 1,
              interactive: false,
            }}
          />
        )}

        {/* 내 위치: 정확도 원 + 점 + 핀 마커(항목 구분) */}
        {showUserMarker && (
          <>
            <CircleMarker
              center={[center.lat, center.lng]}
              radius={8}
              pathOptions={{
                color: "#ffffff",
                fillColor: "#DC2626",
                fillOpacity: 1,
                weight: 3,
                interactive: false,
              }}
            />
            <Marker
              position={[center.lat, center.lng]}
              icon={userLocationIcon}
              zIndexOffset={8000}
              interactive={false}
              keyboard={false}
            />
          </>
        )}

        {/* 주식 핀 — 보라색 원(`radius`) 안만, 겹침 좌표는 배지+팝업 */}
        {stockGroups.map((group) => {
          if (group.length === 1) {
            const stock = group[0]!;
            const tickerKey = normalizeKrxTickerKey(stock.ticker);
            const isOwned = tickerKey ? ownedTickerSet?.has(tickerKey) ?? false : false;
            return (
              <StockPinMarker
                key={stock.id}
                stock={stock}
                isOwned={isOwned}
                onSelect={onSelectStock}
              />
            );
          }
          const clusterKey = group
            .map((s) => s.id)
            .sort()
            .join("|");
          return (
            <StackedStockPinMarker
              key={clusterKey}
              stocks={group}
              ownedTickerSet={ownedTickerSet}
              onSelect={onSelectStock}
            />
          );
        })}
      </MapContainer>
    </div>
  );
};

export default MapView;
