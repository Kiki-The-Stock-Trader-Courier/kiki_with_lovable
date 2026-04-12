/**
 * 걸음 → 포인트(원) 전환 규칙: 100걸음마다 1포인트.
 * 실제 잔고 반영은 사용자가 코인 버튼으로 수령(claim)할 때만 이루어집니다.
 */
export const STEPS_PER_POINT = 100;
/** 1포인트가 캐시 잔고에 더해지는 양(원) */
export const WON_PER_POINT = 1;

/** DB·프로필 호환용: 1보당 “이론상” 비율 (표시·네이티브 힌트용) */
export const CASH_PER_STEP_DISPLAY = 1 / STEPS_PER_POINT;

/**
 * 아직 수령하지 않은 걸음 구간에서, 다음 클릭 시 받을 수 있는 포인트 수.
 * @param totalSteps 오늘 누적 걸음
 * @param stepsAlreadyClaimed 이미 캐시로 바꾼 데 사용한 걸음 수 (같은 날)
 */
export function claimablePointsFromSteps(totalSteps: number, stepsAlreadyClaimed: number): number {
  const raw = Math.max(0, Math.round(totalSteps) - Math.max(0, Math.round(stepsAlreadyClaimed)));
  return Math.floor(raw / STEPS_PER_POINT);
}
