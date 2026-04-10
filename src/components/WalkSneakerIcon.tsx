import { cn } from "@/lib/utils";

/**
 * 누끼(배경 없음) 운동화 라인 아이콘 — PNG 없이 벡터만, 버튼의 text-primary-foreground 색 사용
 */
export function WalkSneakerIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 44"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-[26px] w-[26px] shrink-0", className)}
      aria-hidden
    >
      <g
        className="stroke-current"
        fill="none"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* 속도선: 뒤꿈치 위쪽 짧은 2줄 */}
        <path d="M4 13h4M4 16h4" />
        {/* 속도선: 밑창 뒤쪽 아래 긴 2줄 */}
        <path d="M5 35h12M5 38h14" />
        {/* 운동화 외곽(옆면, 앞으로 기울어진 실루엣) */}
        <path d="M10 33 L25 26 C29 24 31.5 21 31.5 17.5 C31.5 14.5 29.5 12.5 26.5 12.5 L17 14.5 C12 15.5 8.5 19.5 8.5 25 C8.5 28 9 31 10 33" />
        {/* 뒤꿈치·상부 구분 곡선 */}
        <path d="M12 24c1.5-3 4-5 8.5-5.5" />
        {/* 혀·끈 느낌 — 알약형(둥근 캡슐) 2개 */}
        <rect x="17.2" y="15.8" width="6" height="2.8" rx="1.4" transform="rotate(-14 20.2 17.2)" />
        <rect x="18.5" y="18.6" width="6" height="2.8" rx="1.4" transform="rotate(-14 21.5 20)" />
      </g>
    </svg>
  );
}
