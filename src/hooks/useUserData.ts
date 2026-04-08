import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MOCK_USER_WALK, MOCK_HOLDINGS } from "@/data/mockStocks";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import type { HoldingStock, UserWalk } from "@/types/stock";

interface WeeklyStepPoint {
  day: string;
  steps: number;
  walkDate: string;
}

interface UseUserDataResult {
  walk: UserWalk;
  nickname: string;
  weeklySteps: WeeklyStepPoint[];
  holdings: HoldingStock[];
  setGoalSteps: (goal: number) => void;
  setNickname: (nickname: string) => void;
  addSteps: (steps: number) => void;
  isReady: boolean;
}

interface ProfileRow {
  user_id: string;
  nickname: string | null;
  cash_balance: number | null;
  cash_per_step: number | null;
  goal_steps: number | null;
}

interface DailyRow {
  user_id: string;
  walk_date: string;
  steps: number | null;
  goal_steps: number | null;
}

interface HoldingRow {
  user_id: string;
  ticker: string;
  name: string;
  shares: number | null;
  avg_price: number | null;
  current_price: number | null;
}

const KOR_DAY = ["일", "월", "화", "수", "목", "금", "토"] as const;

function dateKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dayLabel(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00`);
  return KOR_DAY[d.getDay()];
}

function defaultWeekly(): WeeklyStepPoint[] {
  const arr: WeeklyStepPoint[] = [];
  const today = new Date();
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = dateKey(d);
    arr.push({ day: dayLabel(key), walkDate: key, steps: 0 });
  }
  return arr;
}

export function useUserData(): UseUserDataResult {
  const { session, isAuthenticated } = useAuth();
  const [walk, setWalk] = useState<UserWalk>(MOCK_USER_WALK);
  const [nickname, setNicknameState] = useState("투자자님");
  const [weeklySteps, setWeeklySteps] = useState<WeeklyStepPoint[]>(defaultWeekly);
  const [holdings, setHoldings] = useState<HoldingStock[]>(MOCK_HOLDINGS);
  const [isReady, setIsReady] = useState(false);
  const queueRef = useRef(Promise.resolve());
  const lastDateRef = useRef(dateKey());

  const enqueue = useCallback((task: () => Promise<void>) => {
    queueRef.current = queueRef.current.then(task).catch(() => undefined);
  }, []);

  const syncFromDb = useCallback(async () => {
    if (!supabase || !session?.user?.id) {
      setIsReady(true);
      return;
    }
    const userId = session.user.id;
    const today = dateKey();

    const { data: profileData } = await supabase
      .from("user_profiles")
      .select("user_id,nickname,cash_balance,cash_per_step,goal_steps")
      .eq("user_id", userId)
      .maybeSingle<ProfileRow>();

    let profile = profileData;
    if (!profile) {
      const seedNick =
        (session.user.user_metadata?.name as string | undefined) ||
        (session.user.email?.split("@")[0] ?? "투자자님");
      const { data: inserted } = await supabase
        .from("user_profiles")
        .insert({
          user_id: userId,
          nickname: seedNick,
          cash_balance: MOCK_USER_WALK.cashBalance,
          cash_per_step: MOCK_USER_WALK.cashPerStep,
          goal_steps: MOCK_USER_WALK.goalSteps,
        })
        .select("user_id,nickname,cash_balance,cash_per_step,goal_steps")
        .single<ProfileRow>();
      profile = inserted ?? null;
    }

    const goal = Math.max(1000, Math.round(profile?.goal_steps ?? MOCK_USER_WALK.goalSteps));
    const cashPerStep = profile?.cash_per_step ?? MOCK_USER_WALK.cashPerStep;
    const cashBalance = profile?.cash_balance ?? MOCK_USER_WALK.cashBalance;
    setNicknameState(profile?.nickname?.trim() || "닉네임 미설정");

    let { data: todayData } = await supabase
      .from("user_walk_daily")
      .select("user_id,walk_date,steps,goal_steps")
      .eq("user_id", userId)
      .eq("walk_date", today)
      .maybeSingle<DailyRow>();

    if (!todayData) {
      const { data: insertedDay } = await supabase
        .from("user_walk_daily")
        .insert({
          user_id: userId,
          walk_date: today,
          steps: 0,
          goal_steps: goal,
        })
        .select("user_id,walk_date,steps,goal_steps")
        .single<DailyRow>();
      todayData = insertedDay ?? null;
    }

    const todaySteps = Math.max(0, Math.round(todayData?.steps ?? 0));
    setWalk({
      todaySteps,
      goalSteps: Math.max(1000, Math.round(todayData?.goal_steps ?? goal)),
      cashBalance: Math.round(cashBalance * 10) / 10,
      cashPerStep,
    });

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 6);
    const from = dateKey(weekStart);
    const { data: weekRows } = await supabase
      .from("user_walk_daily")
      .select("user_id,walk_date,steps,goal_steps")
      .eq("user_id", userId)
      .gte("walk_date", from)
      .order("walk_date", { ascending: true });

    const map = new Map((weekRows ?? []).map((r: DailyRow) => [r.walk_date, r.steps ?? 0]));
    setWeeklySteps(
      defaultWeekly().map((d) => ({
        ...d,
        steps: map.get(d.walkDate) ?? 0,
      })),
    );

    let { data: holdingRows } = await supabase
      .from("user_holdings")
      .select("user_id,ticker,name,shares,avg_price,current_price")
      .eq("user_id", userId)
      .order("ticker", { ascending: true });

    if (!holdingRows || holdingRows.length === 0) {
      const seed = MOCK_HOLDINGS.map((h) => ({
        user_id: userId,
        ticker: h.ticker,
        name: h.name,
        shares: h.shares,
        avg_price: h.avgPrice,
        current_price: h.currentPrice,
      }));
      const { data: insertedHoldings } = await supabase
        .from("user_holdings")
        .insert(seed)
        .select("user_id,ticker,name,shares,avg_price,current_price");
      holdingRows = insertedHoldings ?? [];
    }

    setHoldings(
      (holdingRows ?? []).map((h: HoldingRow) => ({
        ticker: h.ticker,
        name: h.name,
        shares: Number(h.shares ?? 0),
        avgPrice: Number(h.avg_price ?? 0),
        currentPrice: Number(h.current_price ?? 0),
      })),
    );

    setIsReady(true);
  }, [session?.user?.id]);

  useEffect(() => {
    setIsReady(false);
    if (!isAuthenticated) {
      setWalk(MOCK_USER_WALK);
      setWeeklySteps(defaultWeekly().map((d, idx) => ({ ...d, steps: [4120, 5340, 4880, 6230, 5720, 7010, 3247][idx] })));
      setHoldings(MOCK_HOLDINGS);
      setNicknameState("투자자님");
      setIsReady(true);
      return;
    }
    void syncFromDb();
  }, [isAuthenticated, syncFromDb]);

  useEffect(() => {
    if (!isAuthenticated || !supabase || !session?.user?.id) return;
    const timer = window.setInterval(() => {
      const nowKey = dateKey();
      if (lastDateRef.current !== nowKey) {
        lastDateRef.current = nowKey;
        void syncFromDb();
      }
    }, 60000);
    return () => window.clearInterval(timer);
  }, [isAuthenticated, session?.user?.id, syncFromDb]);

  const setGoalSteps = useCallback(
    (goal: number) => {
      const nextGoal = Math.max(1000, Math.round(goal));
      setWalk((prev) => ({ ...prev, goalSteps: nextGoal }));

      if (!supabase || !session?.user?.id) return;
      const userId = session.user.id;
      const today = dateKey();
      enqueue(async () => {
        await supabase.from("user_profiles").update({ goal_steps: nextGoal }).eq("user_id", userId);
        await supabase
          .from("user_walk_daily")
          .upsert({ user_id: userId, walk_date: today, goal_steps: nextGoal }, { onConflict: "user_id,walk_date" });
      });
    },
    [enqueue, session?.user?.id],
  );

  const setNickname = useCallback(
    (next: string) => {
      const trimmed = next.trim();
      if (!trimmed) return;
      setNicknameState(trimmed);
      if (!supabase || !session?.user?.id) return;
      const userId = session.user.id;
      enqueue(async () => {
        await supabase.from("user_profiles").update({ nickname: trimmed }).eq("user_id", userId);
      });
    },
    [enqueue, session?.user?.id],
  );

  const addSteps = useCallback(
    (steps: number) => {
      const add = Math.max(0, Math.round(steps));
      if (add <= 0) return;

      setWalk((prev) => ({
        ...prev,
        todaySteps: prev.todaySteps + add,
        cashBalance: Math.round((prev.cashBalance + add * prev.cashPerStep) * 10) / 10,
      }));
      setWeeklySteps((prev) => {
        const today = dateKey();
        return prev.map((p) => (p.walkDate === today ? { ...p, steps: p.steps + add } : p));
      });

      if (!supabase || !session?.user?.id) return;
      const userId = session.user.id;
      const today = dateKey();
      enqueue(async () => {
        const { data: day } = await supabase
          .from("user_walk_daily")
          .select("steps,goal_steps")
          .eq("user_id", userId)
          .eq("walk_date", today)
          .maybeSingle<{ steps: number | null; goal_steps: number | null }>();
        const currentSteps = day?.steps ?? 0;
        await supabase
          .from("user_walk_daily")
          .upsert(
            {
              user_id: userId,
              walk_date: today,
              steps: currentSteps + add,
              goal_steps: day?.goal_steps ?? walk.goalSteps,
            },
            { onConflict: "user_id,walk_date" },
          );

        const { data: profile } = await supabase
          .from("user_profiles")
          .select("cash_balance,cash_per_step")
          .eq("user_id", userId)
          .single<{ cash_balance: number | null; cash_per_step: number | null }>();
        const currentCash = profile?.cash_balance ?? walk.cashBalance;
        const cps = profile?.cash_per_step ?? walk.cashPerStep;
        await supabase.from("user_profiles").update({ cash_balance: currentCash + add * cps }).eq("user_id", userId);
      });
    },
    [enqueue, session?.user?.id, walk.cashBalance, walk.cashPerStep, walk.goalSteps],
  );

  return useMemo(
    () => ({
      walk,
      nickname,
      weeklySteps,
      holdings,
      setGoalSteps,
      setNickname,
      addSteps,
      isReady,
    }),
    [walk, nickname, weeklySteps, holdings, setGoalSteps, setNickname, addSteps, isReady],
  );
}
