import { cn } from "@/lib/utils";

/** 걷기 버튼용 운동화 아이콘 — `public/walk-running-shoes-icon.png` (라인 아트, 투명 배경) */
export function WalkSneakerIcon({ className }: { className?: string }) {
  return (
    <img
      src="/walk-running-shoes-icon.png"
      alt=""
      width={32}
      height={32}
      decoding="async"
      className={cn("h-8 w-8 shrink-0 object-contain", className)}
      aria-hidden
    />
  );
}
