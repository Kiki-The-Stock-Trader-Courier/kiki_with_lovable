/**
 * 배경 없는 라인 운동화 아이콘(누끼 효과) — PNG 흰 배경 없이 투명
 * 버튼에서 text-primary-foreground 로 아이콘 색 통일
 */
export function WalkSneakerIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden>
      <g className="stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {/* 뒤쪽 속도선 */}
        <path d="M2 15h3M2 18h3" />
        {/* 운동화 윤곽(옆면) */}
        <path d="M7 19h11l3.5-5.5a3 3 0 0 0-2.6-4.4h-6L7 11.5A2.5 2.5 0 0 0 5 14v3.5A1.5 1.5 0 0 0 7 19Z" />
        {/* 옆면 가로 디테일 */}
        <path d="M9.5 13.5h7M10.5 15.5h6M11.5 17.5h4" />
      </g>
    </svg>
  );
}
