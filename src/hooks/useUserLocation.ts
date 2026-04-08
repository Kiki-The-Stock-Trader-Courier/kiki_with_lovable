import { useCallback, useEffect, useState } from "react";

export type UserLocationStatus = "pending" | "ok" | "denied" | "unsupported";

export interface UserLocationState {
  /** 지도 중심·반경 원에 사용 */
  center: { lat: number; lng: number };
  /** 정확도 반경(미터), 원 표시용 */
  accuracyM: number | null;
  status: UserLocationStatus;
  /** 사용자 액션(버튼)으로 현재 위치를 즉시 다시 조회 */
  refreshLocation: () => void;
}

/**
 * 브라우저 Geolocation으로 사용자 위치를 가져와 지도 중심으로 사용합니다.
 * 권한 거부·오류 시 fallback 좌표를 유지합니다.
 */
export function useUserLocation(fallback: { lat: number; lng: number }): UserLocationState {
  const [state, setState] = useState<UserLocationState>({
    center: fallback,
    accuracyM: null,
    status: "pending",
    refreshLocation: () => undefined,
  });

  const refreshLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState((s) => ({ ...s, status: "unsupported" }));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setState((s) => ({
          ...s,
          center: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          accuracyM: pos.coords.accuracy != null ? pos.coords.accuracy : null,
          status: "ok",
        }));
      },
      () => {
        setState((s) => ({ ...s, status: "denied" }));
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 25000,
      },
    );
  }, []);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState((s) => ({ ...s, status: "unsupported" }));
      return;
    }

    let gotFix = false;

    const apply = (pos: GeolocationPosition) => {
      gotFix = true;
      setState({
        center: { lat: pos.coords.latitude, lng: pos.coords.longitude },
        accuracyM: pos.coords.accuracy != null ? pos.coords.accuracy : null,
        status: "ok",
      });
    };

    const onError = () => {
      if (!gotFix) {
        setState({
          center: fallback,
          accuracyM: null,
          status: "denied",
        });
      }
    };

    const opts: PositionOptions = {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 25000,
    };

    // 첫 고정을 빠르게 받기
    navigator.geolocation.getCurrentPosition(apply, () => {
      /* watch가 성공할 수 있으므로 여기서는 denied 처리 안 함 */
    }, opts);

    const watchId = navigator.geolocation.watchPosition(apply, onError, {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 30000,
    });

    return () => navigator.geolocation.clearWatch(watchId);
  }, [fallback.lat, fallback.lng]);

  return { ...state, refreshLocation };
}
