import { useMemo } from "react";
import { User, Wallet, Settings, ChevronRight, Shield, Camera } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { useAuth } from "@/contexts/AuthContext";
import { useUserData } from "@/hooks/useUserData";
import { getPortfolioSummary } from "@/lib/portfolioSummary";

const ProfilePage = () => {
  const { signOut } = useAuth();
  const { walk, nickname, holdings } = useUserData();
  /** 보유 종목 탭 히어로와 동일: 합산 평가액 */
  const portfolioSummary = useMemo(() => getPortfolioSummary(holdings), [holdings]);

  return (
    <div className="app-page-shell mx-auto min-h-[100dvh] w-full max-w-lg pb-24" data-testid="profile-screen">
      {/* Header */}
      <div className="tab-hero-panel px-5 pb-6 pt-[calc(env(safe-area-inset-top,0px)+20px)] sm:rounded-b-2xl">
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <div className="tab-icon-tile flex h-16 w-16 items-center justify-center rounded-2xl ring-1 ring-primary/15">
              <User className="h-8 w-8 text-primary" />
            </div>
            <span
              className="pointer-events-none absolute -bottom-0.5 -right-0.5 flex size-[22px] items-center justify-center rounded-full border border-border/70 bg-card shadow-sm"
              aria-hidden
            >
              <Camera className="size-2.5 text-primary" strokeWidth={2.25} />
            </span>
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-lg font-bold tracking-tight text-foreground">{nickname}</h1>
            <p className="text-sm text-muted-foreground">워키포인트 투자 3일차 🎉</p>
          </div>
        </div>

        {/* Summary: 상단 투자 평가금 = 보유 합산 평가액 · 하단 워키 ⟫ 키움(70%) 카드 */}
        <div className="mt-6 flex min-w-0 flex-col gap-3">
          <div className="tab-stat-tile w-full min-w-0 rounded-xl p-4">
            <div className="flex min-w-0 flex-row flex-wrap items-center justify-start gap-2 sm:gap-3">
              <p className="shrink-0 text-xs text-muted-foreground">투자 평가금</p>
              <p className="min-w-0 font-display text-lg font-bold tabular-nums text-foreground">
                {portfolioSummary.totalMarket.toLocaleString("ko-KR")}원
              </p>
            </div>
          </div>
          <div className="flex min-w-0 items-stretch justify-between gap-3">
            <div className="tab-stat-tile min-w-0 flex-1 basis-0 rounded-xl p-4">
              <p className="text-xs text-muted-foreground">워키 포인트</p>
              <p className="mt-1 font-display text-lg font-bold tabular-nums text-foreground">
                {walk.cashBalance.toLocaleString()}
              </p>
            </div>
            <div className="tab-stat-tile min-w-0 flex-1 basis-0 rounded-xl p-4">
              <p className="text-xs font-medium text-foreground">투자 평가금</p>
              <p className="mt-1 font-display text-lg font-bold tabular-nums text-foreground">
                {portfolioSummary.totalMarket.toLocaleString("ko-KR")}원
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Menu */}
      <div className="space-y-2 p-4">
        {[
          { icon: Wallet, label: "키움증권 계좌 연결", desc: "계좌를 연결하고 실제 투자하기" },
          { icon: Shield, label: "보안 설정", desc: "생체인증, PIN 설정" },
          { icon: Settings, label: "앱 설정", desc: "닉네임 변경, 알림, 반경 및 언어 설정" },
        ].map(({ icon: Icon, label, desc }) => (
          <button
            key={label}
            type="button"
            className="tab-settings-row flex w-full min-h-[56px] items-center gap-4 rounded-xl p-4 text-left"
            aria-label={label}
          >
            <div className="tab-icon-tile flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">{label}</p>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        ))}
      </div>

      {/* 앱 설정 카드 하단 — 목업과 동일: 카드 밖 가운데 밑줄 텍스트 링크 */}
      <div className="flex justify-center px-4 pb-4 pt-6">
        <button
          type="button"
          onClick={() => void signOut()}
          className="text-sm font-medium text-foreground underline decoration-foreground underline-offset-[5px] transition-colors hover:text-foreground/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
          aria-label="로그아웃"
        >
          로그아웃
        </button>
      </div>

      <BottomNav />
    </div>
  );
};

export default ProfilePage;
