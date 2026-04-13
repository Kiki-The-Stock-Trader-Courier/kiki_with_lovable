/**
 * 걷기 탭 주간 차트(`useUserData().weeklySteps`)와 동일한 배열을 기준으로
 * 최근 n일 평균·챗봇용 컨텍스트를 만듭니다. (오래된 날 → 오늘 순)
 */

export type WeeklyStepPointLike = {
  day: string;
  steps: number;
  walkDate: string;
};

/** 마지막 n일의 걸음 수 배열 (기본 3일 = 오늘 포함 달력 최근 3일) */
export function lastNDaysStepValues(weekly: WeeklyStepPointLike[], n: number): number[] {
  const seg = weekly.slice(-Math.min(n, weekly.length));
  return seg.map((p) => Math.max(0, Math.round(Number(p.steps) || 0)));
}

/** 기존 UI와 동일: 10보 단위로 반올림한 산술 평균 */
export function averageLastNDaysStepsRounded(weekly: WeeklyStepPointLike[], n: number): number {
  const vals = lastNDaysStepValues(weekly, n);
  if (vals.length === 0) return 0;
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  return Math.round(mean / 10) * 10;
}

/** 챗봇·사용자에게 보여 줄 "최근 n일" 한 줄 요약 */
export function formatLastNDaysWalkLines(weekly: WeeklyStepPointLike[], n: number): string {
  const seg = weekly.slice(-Math.min(n, weekly.length));
  if (seg.length === 0) return "";
  return seg
    .map(
      (p) =>
        `${p.walkDate} (${p.day}): ${Math.max(0, Math.round(Number(p.steps) || 0)).toLocaleString("ko-KR")}보`,
    )
    .join("\n");
}

/**
 * OpenAI 시스템 메시지에 붙여 걸음 관련 질문에서 환각(가짜 5000·7000보 예시)을 막습니다.
 */
export function buildAssistantWalkStepsContext(weekly: WeeklyStepPointLike[]): string {
  const n = 3;
  const lines = formatLastNDaysWalkLines(weekly, n);
  const avg = averageLastNDaysStepsRounded(weekly, n);
  const weekLine = weekly
    .map((p) => `${p.day}:${Math.max(0, Math.round(Number(p.steps) || 0))}`)
    .join(", ");

  return [
    "[앱에 기록된 실제 걸음만 사용하세요. 아래에 없는 숫자·날짜·예시(예: 5,000·7,000·6,000보)를 지어내지 마세요.]",
    "최근 3일(오늘 포함) 걸음:",
    lines || "(해당 기간 데이터 없음)",
    `위 구간 산술 평균(10보 단위 반올림): ${avg.toLocaleString("ko-KR")}보`,
    `최근 7일 요약(걷기 화면 막대그래프와 동일, 요일:걸음): ${weekLine}`,
  ].join("\n");
}

/**
 * 「걸음 목표 달성하면 뭐가 좋아?」류 — 주식·시세 맥락과 섞이지 않도록 시스템 힌트만 추가
 */
export function buildWalkGoalIntentHint(userMessage: string): string {
  const t = userMessage.replace(/\s+/g, " ").trim();
  if (!t) return "";

  const walkTheme =
    /걸음\s*목표|목표\s*걸음|걷기\s*목표|일일\s*걸음|만\s*보|하루\s*걸음|오늘\s*걸음|목표\s*\d+\s*보/i.test(
      t,
    );
  const benefitOrMotivation =
    /달성|도달|채우|맞추|좋아|좋은\s*점|장점|효과|이유|왜|뭐가|어떤|어때|이득|필요|꼭|해야|도움|변화/i.test(t);

  if (!walkTheme || !benefitOrMotivation) return "";

  return [
    "[질문 의도 — 걷기·목표 걸음 달성의 이점]",
    "사용자는 주식·종목·주가를 묻는 것이 아니라, 앱에서 설정한 일일/목표 걸음을 채웠을 때의 이로움(건강·활동·습관·앱 내 워키 포인트·캐시 적립 등)을 묻습니다.",
    "종목명·시세·투자·차트를 언급하지 마세요. 걷기의 일반적 건강 이점과 이 앱의 걸음→포인트 구조를 자연스럽게 연결해 답하고, 의학적 진단은 하지 말며 필요하면 전문의 상담을 권하세요.",
  ].join("\n");
}
