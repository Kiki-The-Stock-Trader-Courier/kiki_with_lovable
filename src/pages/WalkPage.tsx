import { useRef } from "react";
import { Footprints, Target, Coins, BarChart3, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import BottomNav from "@/components/BottomNav";
import { useUserData } from "@/hooks/useUserData";
import { useNavigate } from "react-router-dom";

const WalkPage = () => {
  const navigate = useNavigate();
  /** 원형 진행률 아래 운동화 버튼 → 주간 걸음 차트로 스크롤 */
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

  const scrollToWeeklyChart = () => {
    weeklySectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div
      className="mx-auto min-h-[100dvh] w-full max-w-lg bg-background pb-24"
      data-testid="walk-screen"
    >
      {/* Header */}
      <div className="bg-card px-5 pb-6 pt-[calc(env(safe-area-inset-top,0px)+20px)] sm:rounded-b-2xl sm:shadow-sm">
        <h1 className="mb-6 font-display text-xl font-bold tracking-tight text-foreground">오늘의 걷기</h1>

        {/* Circular progress */}
        <div className="flex flex-col items-center">
          <div className="relative flex h-40 w-40 items-center justify-center">
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
            {/*
              원(viewBox 160×160, 중심 80·반지름 70) 하단 중앙 (80, 150) — 컨테이너 높이 대비 93.75%
              버튼 중심을 그 점에 두고 -translate-y-1/2 로 둘레에 반쯝 걸치게 배치
            */}
            <button
              type="button"
              onClick={scrollToWeeklyChart}
              className="absolute left-1/2 top-[93.75%] z-10 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border/80 bg-background p-1.5 shadow-md ring-2 ring-background transition hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              aria-label="최근 1주 걸음수 보기"
            >
              <img
                src="/walk-sneaker-icon.png"
                alt=""
                width={32}
                height={32}
                className="h-8 w-8 object-contain"
                decoding="async"
              />
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="mt-6 flex justify-around">
          <div className="text-center">
            <div className="mx-auto mb-1 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Target className="h-5 w-5 text-primary" />
            </div>
            <p className="text-lg font-bold text-foreground">{Math.round(progress)}%</p>
            <p className="text-xs text-muted-foreground">달성률</p>
          </div>
          <div className="text-center">
            <div className="mx-auto mb-1 flex h-10 w-10 items-center justify-center rounded-xl bg-cash/10">
              <Coins className="h-5 w-5 text-cash" />
            </div>
            <p className="text-lg font-bold text-foreground">{walk.cashBalance.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">캐시 (원)</p>
          </div>
          <div className="text-center">
            <div className="mx-auto mb-1 flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10">
              <Award className="h-5 w-5 text-accent" />
            </div>
            <p className="text-lg font-bold text-foreground">{Math.floor(walk.todaySteps * walk.cashPerStep)}</p>
            <p className="text-xs text-muted-foreground">오늘 적립</p>
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
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={shareToFriend}
              className="rounded-full border border-border/70 bg-card px-2.5 py-1 text-[11px] font-semibold text-foreground transition-colors hover:bg-muted/70"
              aria-label="친구 초대 공유"
            >
              친구초대
            </button>
            <button
              type="button"
              onClick={shareToFriend}
              className="rounded-full border border-border/70 bg-accent px-2.5 py-1 text-[11px] font-semibold text-accent-foreground transition-opacity hover:opacity-90"
              aria-label="카카오톡으로 친구에게 공유"
            >
              친구에게 공유
            </button>
          </div>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
          <div className="flex h-40 items-end justify-between gap-2">
            {weeklySteps.map((item) => {
              const max = Math.max(1, ...weeklySteps.map((v) => v.steps));
              const heightPercent = Math.max(12, Math.round((item.steps / max) * 100));
              return (
                <div key={item.day} className="flex flex-1 flex-col items-center gap-1">
                  <div className="text-[10px] font-medium text-muted-foreground">{item.steps.toLocaleString()}</div>
                  <div className="flex h-28 w-full items-end rounded-md bg-muted/40 px-1">
                    <div
                      className="w-full rounded-sm bg-primary/85 transition-all"
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
          onClick={() => navigate("/chat")}
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
