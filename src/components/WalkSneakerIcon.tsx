/**
 * 첨부 운동화 라인 아이콘 스타일 — 옆면·앞쪽으로 기울어진 실루엣, 뒤 속도선, 옆 가로 줄 3개
 * 배경 없음(투명), 버튼에서는 text-primary-foreground 로 표시
 */
export function WalkSneakerIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 34 42"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <g
        className="stroke-current"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* 뒤꿈치 왼쪽 속도선(짧은 가로 2줄) */}
        <path d="M4 27h5M4 30.5h5" />
        {/*
          운동화 외곽선(옆면 프로필)
          - 아래: 굵은 밑창이 왼쪽(발뒤)에서 오른쪽 앞으로 올라감
          - 앞: 둥근 앞코
          - 위: 등 라인 후 뒤꿈치로 내려와 밑창과 만남
        */}
        <path
          d="
            M 9 34.5
            L 22.5 28.5
            C 25.5 27.2 27.5 25 28 22
            C 28.4 19.8 27.6 18 25.8 17.2
            L 17.5 19.2
            C 13.2 20.3 10.2 23.5 9.5 27.5
            C 9.2 29.8 9 32 9 34.5
          "
        />
        {/* 신발 옆면 가로 디테일(끈/브랜드 마크 느낌) — 실루엣과 같은 기울기 */}
        <path d="M14.5 23.5l7.5-2.2M15.8 25.8l7-2M17 28l6.2-1.8" />
      </g>
    </svg>
  );
}
