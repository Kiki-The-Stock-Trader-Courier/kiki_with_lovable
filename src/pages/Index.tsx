import { useEffect, useMemo, useRef, useState } from "react";
import MapView from "@/components/MapView";
import StepCounter from "@/components/StepCounter";
import StockInfoSheet from "@/components/StockInfoSheet";
import TrendingSection from "@/components/TrendingSection";
import BottomNav from "@/components/BottomNav";
import GlobalChatSheet from "@/components/GlobalChatSheet";
import { MOCK_TRENDING, DEFAULT_CENTER, DEFAULT_RADIUS_M } from "@/data/mockStocks";
import type { StockPin } from "@/types/stock";
import { LocateFixed, MapPin, MessageCircle } from "lucide-react";
import { useUserLocation } from "@/hooks/useUserLocation";
import { Capacitor } from "@capacitor/core";
import { StepTracker } from "@/plugins/stepTracker";
import { fetchNearbyCompanies } from "@/lib/companyApi";
import { fetchYahooQuotes, normalizeKrxTickerKey } from "@/lib/quoteApi";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUserData } from "@/hooks/useUserData";

/** 조회는 넓게(회색 핀 확보), 강조 원은 DEFAULT_RADIUS_M 유지 */
const MAP_QUERY_RADIUS_M = DEFAULT_RADIUS_M * 3;

const Index = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [selectedStock, setSelectedStock] = useState<StockPin | null>(null);
  const [showTrending, setShowTrending] = useState(false);
  const [showChatSheet, setShowChatSheet] = useState(false);
  /** 「내 위치」 버튼 — 지도 뷰 중심을 사용자 마커 좌표로 맞춤 (token 은 클릭마다 증가) */
  const [userRecenterTarget, setUserRecenterTarget] = useState<{
    lat: number;
    lng: number;
    token: number;
  } | null>(null);
  const userRecenterSeqRef = useRef(0);
  const { center, accuracyM, status, refreshLocation } = useUserLocation(DEFAULT_CENTER);
  /** API로 주변 상장사만 채움 — 빈 배열이면 지도에 핀 없음(춘천 목업 좌표가 남지 않도록) */
  const [stocks, setStocks] = useState<StockPin[]>([]);
  const { walk, addSteps, setGoalSteps, holdings, buyStock, isScrapped, toggleScrap } = useUserData();
  const stocksRef = useRef<StockPin[]>([]);
  const prevCenterRef = useRef<{ lat: number; lng: number } | null>(null);
  const gravityRef = useRef(9.8);
  const lastStepAtRef = useRef(0);
  const scaledStepBufferRef = useRef(0);

  const addScaledSteps = (rawSteps: number) => {
    if (rawSteps <= 0) return;

    // 요청사항: 기존 대비 걸음 증가량을 1/5로 축소
    // 소수점은 버퍼에 누적해 일정량이 모이면 1보씩 반영
    scaledStepBufferRef.current += rawSteps * 0.2;
    const addedSteps = Math.floor(scaledStepBufferRef.current);
    if (addedSteps <= 0) return;
    scaledStepBufferRef.current -= addedSteps;

    addSteps(addedSteps);
  };

  useEffect(() => {
    let aborted = false;
    const loadNearby = async () => {
      try {
        const data = await fetchNearbyCompanies(center, MAP_QUERY_RADIUS_M);
        if (aborted) return;
        setStocks(data);
      } catch {
        // API 장애 시 이전 마커 유지 (첫 로드 실패 시 빈 지도)
      }
    };
    void loadNearby();
    return () => {
      aborted = true;
    };
  }, [center.lat, center.lng]);

  useEffect(() => {
    stocksRef.current = stocks;
  }, [stocks]);

  /** 종목 목록이 바뀔 때만 재조회 (시세 갱신으로 stocks가 바뀌어 무한 루프 나지 않음) */
  const stockTickerKey = useMemo(
    () =>
      stocks
        .map((s) => normalizeKrxTickerKey(s.ticker))
        .filter((t): t is string => t != null)
        .sort()
        .join(","),
    [stocks],
  );

  /** 보유 종목 티커 집합 — 지도 핀 색상 구분용 */
  const ownedTickerSet = useMemo(
    () =>
      new Set(
        holdings
          .map((h) => normalizeKrxTickerKey(h.ticker))
          .filter((t): t is string => t != null),
      ),
    [holdings],
  );

  useEffect(() => {
    let canceled = false;

    const refreshQuotes = async () => {
      try {
        const targetTickers = stocksRef.current
          .map((s) => normalizeKrxTickerKey(s.ticker))
          .filter((ticker): ticker is string => ticker != null);
        if (targetTickers.length === 0) return;

        const quotes = await fetchYahooQuotes(targetTickers);
        if (canceled || quotes.length === 0) return;

        const quoteMap = new Map<string, (typeof quotes)[number]>();
        for (const q of quotes) {
          const k = normalizeKrxTickerKey(q.ticker);
          if (k) quoteMap.set(k, q);
        }
        setStocks((prev) =>
          prev.map((stock) => {
            const key = normalizeKrxTickerKey(stock.ticker);
            const q = key ? quoteMap.get(key) : undefined;
            if (!q) return stock;
            return {
              ...stock,
              price: Math.round(q.price),
              changePercent: q.changePercent,
            };
          }),
        );
      } catch {
        // 시세 API 일시 오류 시 이전 값 유지
      }
    };

    /** 지도 종목이 로드된 직후에도 바로 시세 요청 */
    void refreshQuotes();
    const timer = setInterval(refreshQuotes, 12_000);

    return () => {
      canceled = true;
      clearInterval(timer);
    };
  }, [stockTickerKey]);

  useEffect(() => {
    if (!selectedStock) return;
    const refreshed = stocks.find((s) => s.id === selectedStock.id);
    if (refreshed) setSelectedStock(refreshed);
  }, [stocks, selectedStock]);

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
        if (stats.goal && stats.goal !== walk.goalSteps) {
          setGoalSteps(stats.goal);
        }
        if (stats.steps > walk.todaySteps) {
          addSteps(stats.steps - walk.todaySteps);
        }
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
        addScaledSteps(1);
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

    addScaledSteps(addedSteps);
  }, [center, status, accuracyM]);

  return (
    <div className="map-screen-shell relative h-[100dvh] min-h-0 w-full overflow-hidden" data-testid="map-screen">
      {/* Map — 중심은 GPS(실패 시 mock 기본 좌표) */}
      <MapView
        center={center}
        radius={DEFAULT_RADIUS_M}
        stocks={stocks}
        ownedTickerSet={ownedTickerSet}
        onSelectStock={(stock) => {
          if (!isAuthenticated) {
            navigate("/login");
            return;
          }
          setSelectedStock(stock);
        }}
        showUserMarker={status === "ok"}
        userAccuracyM={accuracyM}
        userLocationStatus={status}
        userRecenterTarget={userRecenterTarget}
      />

      {/* Top overlay: Step counter — Leaflet 판 z-index(≤1000) 위로 */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1200] p-4 pt-[calc(env(safe-area-inset-top,0px)+12px)]">
        <div className="pointer-events-auto mx-auto w-full max-w-lg">
          {isAuthenticated ? (
            <StepCounter walk={walk} />
          ) : (
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="flex w-full items-center justify-center rounded-2xl border border-border/60 bg-card/95 px-4 py-3 text-sm font-semibold text-foreground shadow-md backdrop-blur-sm supports-[backdrop-filter]:bg-card/90"
              aria-label="로그인 페이지로 이동"
            >
              로그인 페이지로 이동
            </button>
          )}
        </div>
      </div>

      {/* Trending toggle (플로팅 FAB) — 지도/마커보다 위 + 터치 우선 */}
      <div
        className="pointer-events-auto absolute bottom-[88px] right-[max(1rem,env(safe-area-inset-right))] z-[1200] flex flex-col gap-2"
        style={{ touchAction: "manipulation" }}
      >
        <button
          type="button"
          onClick={() => {
            if (!isAuthenticated) {
              navigate("/login");
              return;
            }
            setShowTrending(!showTrending);
          }}
          className="map-icon-btn flex h-12 w-12 items-center justify-center rounded-full transition-transform active:scale-95"
          aria-label="근처 인기 종목 보기"
          aria-pressed={showTrending}
        >
          <MapPin className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => {
            void (async () => {
              const pos = await refreshLocation();
              if (pos) {
                userRecenterSeqRef.current += 1;
                setUserRecenterTarget({ ...pos, token: userRecenterSeqRef.current });
              }
            })();
          }}
          className="map-icon-btn flex h-12 w-12 items-center justify-center rounded-full transition-transform active:scale-95"
          aria-label="내 위치 새로고침"
        >
          <LocateFixed className="h-5 w-5" strokeWidth={1.5} aria-hidden />
        </button>
      </div>

      {/* Center chatbot FAB (emphasized) */}
      <button
        type="button"
        onClick={() => {
          if (!isAuthenticated) {
            navigate("/login");
            return;
          }
          setShowChatSheet(true);
        }}
        className="map-chat-fab pointer-events-auto absolute bottom-[calc(72px+env(safe-area-inset-bottom,0px)-12px)] left-1/2 z-[1350] flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full transition-transform active:scale-95"
        aria-label="챗봇 열기, 읽지 않은 알림 2건"
      >
        <MessageCircle className="h-6 w-6 text-white" aria-hidden />
        <span className="pointer-events-none absolute -right-0.5 -top-0.5 z-10 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#F44336] px-0.5 text-[10px] font-bold leading-none text-white shadow-sm ring-2 ring-white">
          2
        </span>
      </button>

      {/* Trending section */}
      {showTrending && (
        <div className="animate-slide-up absolute bottom-[88px] left-[max(1rem,env(safe-area-inset-left))] right-[calc(4.5rem+max(0px,env(safe-area-inset-right)))] z-[1200] max-w-[min(100%,20rem)] sm:max-w-none">
          <TrendingSection stocks={MOCK_TRENDING} />
        </div>
      )}

      {/* Global chat bottom sheet */}
      {showChatSheet && (
        <>
          <button
            type="button"
            className="animate-fade-in absolute inset-0 z-[1250] bg-black/35"
            onClick={() => setShowChatSheet(false)}
            aria-label="챗봇 닫기 배경"
          />
          <div className="absolute inset-x-0 bottom-[calc(72px+env(safe-area-inset-bottom,0px))] z-[1400] h-[50dvh] max-h-[50dvh]">
            <GlobalChatSheet onClose={() => setShowChatSheet(false)} />
          </div>
        </>
      )}

      {/* Stock detail sheet */}
      <StockInfoSheet
        stock={selectedStock}
        onClose={() => setSelectedStock(null)}
        cashBalance={walk.cashBalance}
        isScrapped={selectedStock ? isScrapped(selectedStock.ticker) : false}
        onToggleScrap={() => {
          if (!selectedStock) return;
          toggleScrap({
            ticker: selectedStock.ticker,
            name: selectedStock.name,
            sector: selectedStock.sector,
          });
        }}
        onBuyStock={buyStock}
      />

      {/* Bottom nav */}
      <BottomNav />
    </div>
  );
};

export default Index;
