import { useEffect, useRef, useState } from "react";
import MapView from "@/components/MapView";
import StepCounter from "@/components/StepCounter";
import StockInfoSheet from "@/components/StockInfoSheet";
import TrendingSection from "@/components/TrendingSection";
import BottomNav from "@/components/BottomNav";
import { MOCK_STOCKS, MOCK_USER_WALK, MOCK_TRENDING, DEFAULT_CENTER, DEFAULT_RADIUS_M } from "@/data/mockStocks";
import type { StockPin } from "@/types/stock";
import { Compass, MapPin } from "lucide-react";
import { useUserLocation } from "@/hooks/useUserLocation";
import { Capacitor } from "@capacitor/core";
import { StepTracker } from "@/plugins/stepTracker";
import { fetchNearbyCompanies } from "@/lib/companyApi";

const Index = () => {
  const [selectedStock, setSelectedStock] = useState<StockPin | null>(null);
  const [showTrending, setShowTrending] = useState(false);
  const { center, accuracyM, status, refreshLocation } = useUserLocation(DEFAULT_CENTER);
  const [stocks, setStocks] = useState<StockPin[]>(MOCK_STOCKS);
  const [walk, setWalk] = useState(MOCK_USER_WALK);
  const prevCenterRef = useRef<{ lat: number; lng: number } | null>(null);
  const gravityRef = useRef(9.8);
  const lastStepAtRef = useRef(0);
  const scaledStepBufferRef = useRef(0);

  const addSteps = (rawSteps: number) => {
    if (rawSteps <= 0) return;

    // 요청사항: 기존 대비 걸음 증가량을 1/5로 축소
    // 소수점은 버퍼에 누적해 일정량이 모이면 1보씩 반영
    scaledStepBufferRef.current += rawSteps * 0.2;
    const addedSteps = Math.floor(scaledStepBufferRef.current);
    if (addedSteps <= 0) return;
    scaledStepBufferRef.current -= addedSteps;

    setWalk((prevWalk) => ({
      ...prevWalk,
      todaySteps: prevWalk.todaySteps + addedSteps,
      cashBalance: Math.round((prevWalk.cashBalance + addedSteps * prevWalk.cashPerStep) * 10) / 10,
    }));
  };

  useEffect(() => {
    let aborted = false;
    const loadNearby = async () => {
      try {
        const data = await fetchNearbyCompanies(center, DEFAULT_RADIUS_M);
        if (aborted) return;
        // DB 조회 결과가 있을 때만 교체, 비어 있으면 기존 mock 유지
        if (data.length > 0) setStocks(data);
      } catch {
        // API 장애 시 기존 mock 유지
      }
    };
    void loadNearby();
    return () => {
      aborted = true;
    };
  }, [center.lat, center.lng]);

  useEffect(() => {
    // Android(Capacitor)에서는 네이티브 포그라운드 서비스로 걸음을 측정하고,
    // 웹 상태는 해당 값을 주기적으로 동기화합니다.
    if (!Capacitor.isNativePlatform()) return;
    if (Capacitor.getPlatform() !== "android") return;

    let isMounted = true;
    let timer: ReturnType<typeof setInterval> | undefined;

    const syncFromNative = async () => {
      try {
        const stats = await StepTracker.getStats();
        if (!isMounted) return;
        setWalk((prev) => ({
          ...prev,
          todaySteps: stats.steps,
          goalSteps: stats.goal,
          cashPerStep: stats.cashPerStep,
          cashBalance: Math.round(stats.cash * 10) / 10,
        }));
      } catch {
        // 네이티브 플러그인 실패 시 기존 fallback 로직 사용
      }
    };

    const startNativeTracking = async () => {
      try {
        await StepTracker.requestAllPermissions();
        await StepTracker.start({
          goal: walk.goalSteps,
          cashPerStep: walk.cashPerStep,
          steps: walk.todaySteps,
        });
        await syncFromNative();
        timer = setInterval(syncFromNative, 1500);
      } catch {
        // 권한 거부 등으로 시작 실패 시 기존 fallback 로직 사용
      }
    };

    void startNativeTracking();

    return () => {
      isMounted = false;
      if (timer) clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android") return;

    // 걸음 감지 1순위: 가속도 센서 기반 (실제 걷기 반응성이 좋음)
    const onMotion = (event: DeviceMotionEvent) => {
      const acc = event.accelerationIncludingGravity;
      if (!acc) return;
      if (acc.x == null || acc.y == null || acc.z == null) return;

      const magnitude = Math.sqrt(acc.x ** 2 + acc.y ** 2 + acc.z ** 2);
      gravityRef.current = gravityRef.current * 0.9 + magnitude * 0.1;
      const dynamic = Math.abs(magnitude - gravityRef.current);

      // 걷기 리듬 피크를 감지하고 너무 촘촘한 중복 카운트는 차단
      const now = Date.now();
      const cooldownMs = 350;
      const threshold = 1.2;
      if (dynamic > threshold && now - lastStepAtRef.current > cooldownMs) {
        lastStepAtRef.current = now;
        addSteps(1);
      }
    };

    window.addEventListener("devicemotion", onMotion);
    return () => window.removeEventListener("devicemotion", onMotion);
  }, []);

  useEffect(() => {
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android") return;

    // 걸음 감지 2순위: GPS 이동거리 기반 보조 누적
    if (status !== "ok") return;
    if (accuracyM != null && accuracyM > 120) return;

    const prev = prevCenterRef.current;
    prevCenterRef.current = center;
    if (!prev) return;

    // 두 좌표 사이 직선거리(미터) 계산 - Haversine
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const R = 6371000;
    const dLat = toRad(center.lat - prev.lat);
    const dLng = toRad(center.lng - prev.lng);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(prev.lat)) * Math.cos(toRad(center.lat)) * Math.sin(dLng / 2) ** 2;
    const movedM = 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    // GPS 흔들림/비정상 점프 방지:
    // - 1m 이하는 노이즈로 간주
    // - 60m 초과는 순간 점프로 간주해 무시
    if (movedM < 1 || movedM > 60) return;

    // 보폭 평균 0.75m 기준으로 환산
    const addedSteps = Math.max(1, Math.round(movedM / 0.75));

    addSteps(addedSteps);
  }, [center, status, accuracyM]);

  return (
    <div className="relative h-[100dvh] min-h-0 w-full overflow-hidden" data-testid="map-screen">
      {/* Map — 중심은 GPS(실패 시 mock 기본 좌표) */}
      <MapView
        center={center}
        radius={DEFAULT_RADIUS_M}
        stocks={stocks}
        onSelectStock={setSelectedStock}
        showUserMarker={status === "ok"}
        userAccuracyM={accuracyM}
      />

      {/* Top overlay: Step counter — Leaflet 판 z-index(≤1000) 위로 */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1200] p-4 pt-[calc(env(safe-area-inset-top,0px)+12px)]">
        <div className="pointer-events-auto mx-auto w-full max-w-lg">
          <StepCounter walk={walk} />
        </div>
      </div>

      {/* Trending toggle (플로팅 FAB) — 지도/마커보다 위 + 터치 우선 */}
      <div
        className="pointer-events-auto absolute bottom-[88px] right-[max(1rem,env(safe-area-inset-right))] z-[1200] flex flex-col gap-2"
        style={{ touchAction: "manipulation" }}
      >
        <button
          type="button"
          onClick={refreshLocation}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md ring-2 ring-background/80 transition-transform active:scale-95"
          aria-label="내 위치 새로고침"
        >
          <Compass className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => setShowTrending(!showTrending)}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-md ring-2 ring-background/80 transition-transform active:scale-95"
          aria-label="근처 인기 종목 보기"
          aria-pressed={showTrending}
        >
          <MapPin className="h-5 w-5" />
        </button>
      </div>

      {/* Trending section */}
      {showTrending && (
        <div className="animate-slide-up absolute bottom-[88px] left-[max(1rem,env(safe-area-inset-left))] right-[calc(4.5rem+max(0px,env(safe-area-inset-right)))] z-[1200] max-w-[min(100%,20rem)] sm:max-w-none">
          <TrendingSection stocks={MOCK_TRENDING} />
        </div>
      )}

      {/* Stock detail sheet */}
      <StockInfoSheet
        stock={selectedStock}
        onClose={() => setSelectedStock(null)}
        cashBalance={walk.cashBalance}
      />

      {/* Bottom nav */}
      <BottomNav />
    </div>
  );
};

export default Index;
