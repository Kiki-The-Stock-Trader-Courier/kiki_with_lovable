import { User, Wallet, Link2, Settings, ChevronRight, Shield } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { useUserData } from "@/hooks/useUserData";
import { useState } from "react";

const ProfilePage = () => {
  const { walk, nickname, setNickname, holdings } = useUserData();
  const [nicknameInput, setNicknameInput] = useState("");
  const totalValue = holdings.reduce((sum, h) => sum + h.currentPrice * h.shares, 0);

  return (
    <div className="mx-auto min-h-[100dvh] w-full max-w-lg bg-background pb-24" data-testid="profile-screen">
      {/* Header */}
      <div className="bg-card px-5 pb-6 pt-[calc(env(safe-area-inset-top,0px)+20px)] sm:rounded-b-2xl sm:shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 ring-1 ring-primary/10">
            <User className="h-8 w-8 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-lg font-bold tracking-tight text-foreground">{nickname}</h1>
            <p className="text-sm text-muted-foreground">캐시워크 투자 3일차 🎉</p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <input
            value={nicknameInput}
            onChange={(e) => setNicknameInput(e.target.value)}
            placeholder="닉네임 입력"
            className="h-10 flex-1 rounded-lg border border-border/70 bg-background px-3 text-sm"
            aria-label="닉네임 입력"
          />
          <button
            type="button"
            onClick={() => {
              if (!nicknameInput.trim()) return;
              setNickname(nicknameInput);
              setNicknameInput("");
            }}
            className="h-10 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground"
            aria-label="닉네임 저장"
          >
            저장
          </button>
        </div>

        {/* Summary cards */}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-border/50 bg-muted/40 p-4">
            <p className="text-xs text-muted-foreground">보유 캐시</p>
            <p className="mt-1 font-display text-lg font-bold tabular-nums text-foreground">
              {walk.cashBalance.toLocaleString()}원
            </p>
          </div>
          <div className="rounded-xl border border-border/50 bg-muted/40 p-4">
            <p className="text-xs text-muted-foreground">투자 평가금</p>
            <p className="mt-1 font-display text-lg font-bold tabular-nums text-foreground">
              {totalValue.toLocaleString()}원
            </p>
          </div>
        </div>
      </div>

      {/* Menu */}
      <div className="space-y-2 p-4">
        {[
          { icon: Wallet, label: "키움증권 계좌 연결", desc: "계좌를 연결하고 실제 투자하기" },
          { icon: Link2, label: "캐시워크 연동", desc: "걸음수 자동 동기화" },
          { icon: Shield, label: "보안 설정", desc: "생체인증, PIN 설정" },
          { icon: Settings, label: "앱 설정", desc: "알림, 반경, 언어" },
        ].map(({ icon: Icon, label, desc }) => (
          <button
            key={label}
            type="button"
            className="flex w-full min-h-[56px] items-center gap-4 rounded-xl border border-border/60 bg-card p-4 text-left shadow-sm transition-colors hover:bg-muted/40 active:bg-muted/60"
            aria-label={label}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
              <Icon className="h-5 w-5 text-foreground" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">{label}</p>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        ))}
      </div>

      <BottomNav />
    </div>
  );
};

export default ProfilePage;
