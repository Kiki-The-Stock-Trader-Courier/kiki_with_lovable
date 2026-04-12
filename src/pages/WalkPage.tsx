import { useRef } from "react";
import { Footprints, Target, Coins, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import BottomNav from "@/components/BottomNav";
import { useUserData } from "@/hooks/useUserData";
import { useNavigate } from "react-router-dom";

/** 걷기 탭 제목 — 보유 종목 `BriefcaseBusiness`와 동일 `h-5 w-5`·primary 색 */
function WalkTitleSneakerIcon() {
  return (
    <span
      aria-hidden
      className="inline-block h-5 w-5 shrink-0 bg-primary"
      style={{
        WebkitMaskImage: "url(/walk-header-shoe.png)",
        maskImage: "url(/walk-header-shoe.png)",
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
      }}
    />
  );
}

const WalkPage = () => {
  const navigate = useNavigate();
  /** 주간 걸음 차트 섹션 앵커 */
  const weeklySectionRef = useRef<HTMLDivElement>(null);
  const { walk, weeklySteps } = useUserData();
  const progress = Math.min((walk.todaySteps / walk.goalSteps) * 100, 100);
  const appShareUrl = "https://universal-layout-main.vercel.app/";
  const shareText = "캐시워크 주식 앱에서 같이 걸으며 투자해요!";

  const shareToFriend = async () => {
    try {
      // 모바일 브라우저/앱 Web Share 지원 시 기본 공유 시트를 우선 사용
      if (navigator.share) {
        await navigator.share({
          title: "캐시워크 주식",
          text: shareText,
          url: appShareUrl,
        });
        return;
      }
    } catch {
      // 사용자가 공유 시트를 닫은 경우는 추가 동작 없이 종료
      return;
    }
    // Web Share 미지원 환경: 링크 복사 fallback
    try {
      await navigator.clipboard.writeText(appShareUrl);
      window.alert("공유 링크가 복사되었습니다. 카카오톡 채팅창에 붙여넣어 공유해 주세요.");
    } catch {
      window.prompt("아래 링크를 복사해 카카오톡으로 공유해 주세요.", appShareUrl);
    }
  };

  return (
    <div
      className="app-page-shell mx-auto min-h-[100dvh] w-full max-w-lg pb-24"
      data-testid="walk-screen"
    >
      {/* Header */}
      <div className="tab-hero-panel px-5 pb-6 pt-[calc(env(safe-area-inset-top,0px)+20px)] sm:rounded-b-2xl">
        <h1 className="mb-6 flex items-center gap-2 font-display text-xl font-bold tracking-tight text-foreground">
          <WalkTitleSneakerIcon />
          오늘의 걷기
        </h1>

        {/* Circular progress */}
        <div className="flex flex-col items-center">
          {/* 하단 코인이 링 밖으로 살짝 나와도 통계와 겹치지 않도록 여유 */}
          <div className="relative mb-5 flex h-40 w-40 items-center justify-center">
            <svg className="absolute h-full w-full -rotate-90" viewBox="0 0 160 160" aria-hidden>
              <circle cx="80" cy="80" r="70" fill="none" stroke="hsl(var(--secondary))" strokeWidth="10" />
              <circle
                cx="80" cy="80" r="70"
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 70}`}
                strokeDashoffset={`${2 * Math.PI * 70 * (1 - progress / 100)}`}
                className="transition-all duration-700"
              />
            </svg>
            <div className="relative z-0 text-center">
              <Footprints className="mx-auto mb-1 h-6 w-6 text-primary" />
              <p className="text-3xl font-bold text-foreground">{walk.todaySteps.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">/ {walk.goalSteps.toLocaleString()} 걸음</p>
            </div>
            {/* 참고 UI: 링 하단 중앙 · 메인/서브 톤 코인 */}
            <button
              type="button"
              onClick={() => navigate("/holdings")}
              className="absolute left-[64px] top-[113px] z-10 flex size-9 translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-gradient-to-b from-primary via-[#593d63] to-[#3d2845] text-[15px] font-bold leading-none text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.38),inset_0_-3px_6px_rgba(0,0,0,0.22),0_4px_10px_rgba(105,10,207,0.3)] ring-1 ring-[#593d63]/25 transition-transform active:scale-95"
              aria-label="보유 종목에서 캐시 확인"
            >
              <i
                className="pointer-events-none absolute -right-0.5 -top-0.5 z-20 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-[#FF3B30] px-0.5 text-[9px] font-bold leading-none text-white not-italic shadow-[0_1px_2px_rgba(0,0,0,0.22)] ring-1 ring-white"
                aria-hidden
              >
                72
              </i>
              <span className="drop-shadow-[0_1px_0_rgba(0,0,0,0.35)]">₩</span>
            </button>
          </div>
        </div>

        {/* 통계: 달성률 · 포인트 — 두 열 가운데 정렬 */}
        <div className="mt-6 flex max-w-sm mx-auto justify-center gap-16 sm:gap-24">
          <div className="flex min-w-[100px] flex-col items-center text-center">
            <div className="mx-auto mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Target className="h-5 w-5 text-primary" />
            </div>
            <p className="text-lg font-bold tabular-nums text-foreground">{Math.round(progress)}%</p>
            <p className="text-xs text-muted-foreground">달성률</p>
          </div>
          <div className="flex min-w-[100px] flex-col items-center text-center">
            <div className="mx-auto mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-cash/10">
              <Coins className="h-5 w-5 text-cash" />
            </div>
            <p className="text-lg font-bold tabular-nums text-foreground">{walk.cashBalance.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">포인트</p>
          </div>
        </div>
      </div>

      {/* Weekly steps chart */}
      <div ref={weeklySectionRef} id="walk-weekly-chart" className="scroll-mt-4 px-4 pb-2 pt-2">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-display text-base font-bold text-foreground">
            <BarChart3 className="h-4 w-4 text-primary" />
            최근 1주 걸음수
          </h2>
          <button
            type="button"
            onClick={shareToFriend}
            className="rounded-full border border-border/70 bg-accent px-2.5 py-1 text-[11px] font-semibold text-accent-foreground transition-opacity hover:opacity-90"
            aria-label="카카오톡으로 친구에게 공유"
          >
            친구에게 공유
          </button>
        </div>
        <div className="tab-card-surface rounded-xl p-4">
          <div className="flex h-40 items-end justify-between gap-2">
            {weeklySteps.map((item) => {
              const max = Math.max(1, ...weeklySteps.map((v) => v.steps));
              const heightPercent = Math.max(12, Math.round((item.steps / max) * 100));
              return (
                <div key={item.day} className="flex flex-1 flex-col items-center gap-1">
                  <div className="text-[10px] font-medium text-muted-foreground">{item.steps.toLocaleString()}</div>
                  <div className="flex h-28 w-full items-end rounded-md bg-muted/40 px-1">
                    <div
                      className="w-full rounded-sm bg-[#690ACF] transition-all"
                      style={{ height: `${heightPercent}%` }}
                      aria-label={`${item.day} ${item.steps.toLocaleString()}보`}
                    />
                  </div>
                  <div className="text-xs font-medium text-foreground">{item.day}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Goal setting */}
        <Button
          className="mt-6 w-full h-12 rounded-xl font-bold"
          aria-label="걸음 수 목표 변경"
          onClick={() => navigate("/chat?from=walk-goal")}
        >
          <Target className="mr-2 h-5 w-5" />
          걸음 목표 변경하기
        </Button>
      </div>

      <BottomNav />
    </div>
  );
};

export default WalkPage;
