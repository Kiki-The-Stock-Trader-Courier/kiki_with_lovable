import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MOCK_USER_WALK } from "@/data/mockStocks";
import {
  CASH_PER_STEP_DISPLAY,
  STEPS_PER_POINT,
  WON_PER_POINT,
  claimablePointsFromSteps,
} from "@/lib/walkPoints";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import type { HoldingStock, ScrappedStock, UserWalk } from "@/types/stock";

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
  scraps: ScrappedStock[];
  setGoalSteps: (goal: number) => void;
  setNickname: (nickname: string) => void;
  addSteps: (steps: number) => void;
  /** 걷기 포인트 수령: 코인 버튼 — 100걸음 단위로 잔고에 반영 */
  claimWalkPoints: () => void;
  /** 주식 퀴즈 정답 등 — 난이도별 1~10원 적립 */
  addQuizCash: (won: number) => void;
  buyStock: (order: { ticker: string; name: string; price: number; shares: number }) => Promise<{
    ok: boolean;
    message: string;
  }>;
  toggleScrap: (stock: { ticker: string; name: string; sector?: string | null; price?: number }) => void;
  isScrapped: (ticker: string) => boolean;
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
  steps_claimed_for_cash?: number | null;
}

interface HoldingRow {
  user_id: string;
  ticker: string;
  name: string;
  shares: number | null;
  avg_price: number | null;
  current_price: number | null;
}

/** 소수 주 매수 시 부동소수 오차 완화 */
const SHARE_DECIMALS = 6;
function roundShareAmount(n: number): number {
  return Math.round(n * 10 ** SHARE_DECIMALS) / 10 ** SHARE_DECIMALS;
}

function formatSharesForMessage(shares: number): string {
  const r = roundShareAmount(shares);
  if (Math.abs(r - Math.round(r)) < 1e-9) return Math.round(r).toLocaleString("ko-KR");
  return r.toLocaleString("ko-KR", { maximumFractionDigits: SHARE_DECIMALS });
}

function applyBuyToHoldings(
  prev: HoldingStock[],
  order: { ticker: string; name: string; price: number; shares: number },
): HoldingStock[] {
  const key = normalizeTicker(order.ticker);
  const idx = prev.findIndex((h) => normalizeTicker(h.ticker) === key);
  if (idx < 0) {
    return [
      ...prev,
      {
        ticker: key,
        name: order.name,
        shares: order.shares,
        avgPrice: order.price,
        currentPrice: order.price,
      },
    ];
  }

  const cur = prev[idx];
  const nextShares = cur.shares + order.shares;
  const nextAvg = nextShares > 0 ? (cur.avgPrice * cur.shares + order.price * order.shares) / nextShares : order.price;

  const next = [...prev];
  next[idx] = {
    ...cur,
    name: order.name || cur.name,
    shares: nextShares,
    avgPrice: Math.round(nextAvg),
    currentPrice: order.price,
  };
  return next;
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

function normalizeTicker(raw: string): string {
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length === 0) return "";
  if (digits.length <= 6) return digits.padStart(6, "0");
  return digits.slice(-6);
}

function getScrapStorageKey(userId: string | undefined): string {
  return `kiki_scraps_v1:${userId ?? "guest"}`;
}

function loadScrapsFromStorage(userId: string | undefined): ScrappedStock[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(getScrapStorageKey(userId));
    if (!raw) return [];
    const arr = JSON.parse(raw) as ScrappedStock[];
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((s) => typeof s?.ticker === "string" && typeof s?.name === "string")
      .map((s) => ({
        ticker: normalizeTicker(s.ticker),
        name: String(s.name).trim() || s.ticker,
        sector: String(s.sector ?? "기타").trim() || "기타",
        price: typeof s.price === "number" && Number.isFinite(s.price) ? s.price : undefined,
        savedAt: String(s.savedAt ?? new Date().toISOString()),
      }))
      .filter((s) => s.ticker.length > 0);
  } catch {
    return [];
  }
}

export function useUserData(): UseUserDataResult {
  const { session, isAuthenticated } = useAuth();
  const [walk, setWalk] = useState<UserWalk>(MOCK_USER_WALK);
  const [nickname, setNicknameState] = useState("투자자님");
  const [weeklySteps, setWeeklySteps] = useState<WeeklyStepPoint[]>(defaultWeekly);
  const [holdings, setHoldings] = useState<HoldingStock[]>([]);
  const [scraps, setScraps] = useState<ScrappedStock[]>([]);
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
          cash_per_step: CASH_PER_STEP_DISPLAY,
          goal_steps: MOCK_USER_WALK.goalSteps,
        })
        .select("user_id,nickname,cash_balance,cash_per_step,goal_steps")
        .single<ProfileRow>();
      profile = inserted ?? null;
    }

    const goal = Math.max(1000, Math.round(profile?.goal_steps ?? MOCK_USER_WALK.goalSteps));
    const cashPerStep = Number(profile?.cash_per_step ?? CASH_PER_STEP_DISPLAY);
    const cashBalance = profile?.cash_balance ?? MOCK_USER_WALK.cashBalance;
    setNicknameState(profile?.nickname?.trim() || "닉네임 미설정");

    let { data: todayData } = await supabase
      .from("user_walk_daily")
      .select("user_id,walk_date,steps,goal_steps,steps_claimed_for_cash")
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
          steps_claimed_for_cash: 0,
        })
        .select("user_id,walk_date,steps,goal_steps,steps_claimed_for_cash")
        .single<DailyRow>();
      todayData = insertedDay ?? null;
    }

    const todaySteps = Math.max(0, Math.round(todayData?.steps ?? 0));
    const stepsClaimed = Math.max(0, Math.round(todayData?.steps_claimed_for_cash ?? 0));
    setWalk({
      todaySteps,
      goalSteps: Math.max(1000, Math.round(todayData?.goal_steps ?? goal)),
      cashBalance: Math.round(Number(cashBalance) * 10) / 10,
      cashPerStep,
      stepsClaimedForCashToday: stepsClaimed,
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

    const { data: holdingRows } = await supabase
      .from("user_holdings")
      .select("user_id,ticker,name,shares,avg_price,current_price")
      .eq("user_id", userId)
      .order("ticker", { ascending: true });

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
      setHoldings([]);
      setScraps(loadScrapsFromStorage(undefined));
      setNicknameState("투자자님");
      setIsReady(true);
      return;
    }
    void syncFromDb();
  }, [isAuthenticated, syncFromDb]);

  /** 사용자별(localStorage) 스크랩 로드 */
  useEffect(() => {
    const userId = session?.user?.id;
    setScraps(loadScrapsFromStorage(userId));
  }, [session?.user?.id, isAuthenticated]);

  /** 스크랩 저장: 현재 로그인 사용자 키에 동기화 */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const userId = session?.user?.id;
    try {
      window.localStorage.setItem(getScrapStorageKey(userId), JSON.stringify(scraps));
    } catch {
      // 저장 실패 시 UX는 유지 (권한/용량 이슈)
    }
  }, [scraps, session?.user?.id]);

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
        const { data: day } = await supabase
          .from("user_walk_daily")
          .select("steps,steps_claimed_for_cash")
          .eq("user_id", userId)
          .eq("walk_date", today)
          .maybeSingle<{ steps: number | null; steps_claimed_for_cash: number | null }>();
        await supabase.from("user_walk_daily").upsert(
          {
            user_id: userId,
            walk_date: today,
            steps: day?.steps ?? 0,
            goal_steps: nextGoal,
            steps_claimed_for_cash: day?.steps_claimed_for_cash ?? 0,
          },
          { onConflict: "user_id,walk_date" },
        );
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
          .select("steps,goal_steps,steps_claimed_for_cash")
          .eq("user_id", userId)
          .eq("walk_date", today)
          .maybeSingle<{
            steps: number | null;
            goal_steps: number | null;
            steps_claimed_for_cash: number | null;
          }>();
        const currentSteps = day?.steps ?? 0;
        await supabase.from("user_walk_daily").upsert(
          {
            user_id: userId,
            walk_date: today,
            steps: currentSteps + add,
            goal_steps: day?.goal_steps ?? walk.goalSteps,
            steps_claimed_for_cash: day?.steps_claimed_for_cash ?? 0,
          },
          { onConflict: "user_id,walk_date" },
        );
      });
    },
    [enqueue, session?.user?.id, walk.goalSteps],
  );

  const claimWalkPoints = useCallback(() => {
    let claimedPoints = 0;
    setWalk((prev) => {
      claimedPoints = claimablePointsFromSteps(prev.todaySteps, prev.stepsClaimedForCashToday);
      if (claimedPoints <= 0) return prev;
      return {
        ...prev,
        cashBalance: Math.round((prev.cashBalance + claimedPoints * WON_PER_POINT) * 10) / 10,
        stepsClaimedForCashToday: prev.stepsClaimedForCashToday + claimedPoints * STEPS_PER_POINT,
      };
    });
    if (claimedPoints <= 0 || !supabase || !session?.user?.id) return;
    const userId = session.user.id;
    const today = dateKey();
    enqueue(async () => {
      const { data: day } = await supabase
        .from("user_walk_daily")
        .select("steps,goal_steps,steps_claimed_for_cash")
        .eq("user_id", userId)
        .eq("walk_date", today)
        .maybeSingle<{
          steps: number | null;
          goal_steps: number | null;
          steps_claimed_for_cash: number | null;
        }>();
      const st = Math.max(0, Math.round(day?.steps ?? 0));
      const sc = Math.max(0, Math.round(day?.steps_claimed_for_cash ?? 0));
      const pts = claimablePointsFromSteps(st, sc);
      if (pts <= 0) return;
      const nextClaimed = sc + pts * STEPS_PER_POINT;
      const goalStepsRow = Math.max(1000, Math.round(day?.goal_steps ?? 5000));
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("cash_balance")
        .eq("user_id", userId)
        .single<{ cash_balance: number | null }>();
      const bal = Number(profile?.cash_balance ?? 0);
      await supabase.from("user_walk_daily").upsert(
        {
          user_id: userId,
          walk_date: today,
          steps: st,
          goal_steps: goalStepsRow,
          steps_claimed_for_cash: nextClaimed,
        },
        { onConflict: "user_id,walk_date" },
      );
      await supabase.from("user_profiles").update({ cash_balance: bal + pts * WON_PER_POINT }).eq("user_id", userId);
    });
  }, [enqueue, session?.user?.id]);

  const addQuizCash = useCallback(
    (won: number) => {
      const add = Math.min(10, Math.max(1, Math.round(Number(won) || 0)));
      if (add < 1) return;

      setWalk((prev) => ({
        ...prev,
        cashBalance: Math.round((prev.cashBalance + add) * 10) / 10,
      }));

      if (!supabase || !session?.user?.id) return;
      const userId = session.user.id;
      enqueue(async () => {
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("cash_balance")
          .eq("user_id", userId)
          .single<{ cash_balance: number | null }>();
        const currentCash = Number(profile?.cash_balance ?? 0);
        await supabase.from("user_profiles").update({ cash_balance: currentCash + add }).eq("user_id", userId);
      });
    },
    [enqueue, session?.user?.id],
  );

  const buyStock = useCallback(
    async (order: { ticker: string; name: string; price: number; shares: number }) => {
      const ticker = normalizeTicker(order.ticker);
      const shares = roundShareAmount(Math.max(0, order.shares));
      const price = Math.max(0, Math.round(order.price));
      const total = Math.round(price * shares * 10) / 10;

      if (!ticker || shares <= 0 || !Number.isFinite(shares) || price <= 0) {
        return { ok: false, message: "매수 수량/가격이 올바르지 않습니다." };
      }
      if (walk.cashBalance + 1e-9 < total) {
        return { ok: false, message: "캐시가 부족합니다." };
      }

      // 1) 즉시 UI 반영
      setWalk((prev) => ({
        ...prev,
        cashBalance: Math.round((prev.cashBalance - total) * 10) / 10,
      }));
      setHoldings((prev) => applyBuyToHoldings(prev, { ticker, name: order.name, price, shares }));

      // 2) 비로그인/오프라인 모드: 로컬 상태만 유지
      if (!supabase || !session?.user?.id) {
        return { ok: true, message: `${order.name} ${formatSharesForMessage(shares)}주를 매수했습니다.` };
      }

      // 3) DB 동기화(직렬 큐)
      const userId = session.user.id;
      enqueue(async () => {
        const { data: dbHolding } = await supabase
          .from("user_holdings")
          .select("ticker,name,shares,avg_price,current_price")
          .eq("user_id", userId)
          .eq("ticker", ticker)
          .maybeSingle<{
            ticker: string;
            name: string;
            shares: number | null;
            avg_price: number | null;
            current_price: number | null;
          }>();

        const curShares = Number(dbHolding?.shares ?? 0);
        const curAvg = Number(dbHolding?.avg_price ?? 0);
        const nextShares = curShares + shares;
        const nextAvg = nextShares > 0 ? (curAvg * curShares + price * shares) / nextShares : price;

        await supabase.from("user_holdings").upsert(
          {
            user_id: userId,
            ticker,
            name: order.name,
            shares: nextShares,
            avg_price: Math.round(nextAvg),
            current_price: price,
          },
          { onConflict: "user_id,ticker" },
        );

        const { data: profile } = await supabase
          .from("user_profiles")
          .select("cash_balance")
          .eq("user_id", userId)
          .single<{ cash_balance: number | null }>();
        const nextCash = Math.max(0, Number(profile?.cash_balance ?? 0) - total);
        await supabase.from("user_profiles").update({ cash_balance: nextCash }).eq("user_id", userId);
      });

      return { ok: true, message: `${order.name} ${formatSharesForMessage(shares)}주를 매수했습니다.` };
    },
    [enqueue, session?.user?.id, walk.cashBalance],
  );

  const toggleScrap = useCallback((stock: { ticker: string; name: string; sector?: string | null; price?: number }) => {
    const key = normalizeTicker(stock.ticker);
    if (!key) return;

    setScraps((prev) => {
      const idx = prev.findIndex((s) => normalizeTicker(s.ticker) === key);
      if (idx >= 0) {
        return prev.filter((_, i) => i !== idx);
      }
      const price =
        typeof stock.price === "number" && Number.isFinite(stock.price) ? stock.price : undefined;
      return [
        {
          ticker: key,
          name: stock.name?.trim() || key,
          sector: stock.sector?.trim() || "기타",
          price,
          savedAt: new Date().toISOString(),
        },
        ...prev,
      ];
    });
  }, []);

  const isScrapped = useCallback(
    (ticker: string) => {
      const key = normalizeTicker(ticker);
      if (!key) return false;
      return scraps.some((s) => normalizeTicker(s.ticker) === key);
    },
    [scraps],
  );

  return useMemo(
    () => ({
      walk,
      nickname,
      weeklySteps,
      holdings,
      scraps,
      setGoalSteps,
      setNickname,
      addSteps,
      claimWalkPoints,
      addQuizCash,
      buyStock,
      toggleScrap,
      isScrapped,
      isReady,
    }),
    [
      walk,
      nickname,
      weeklySteps,
      holdings,
      scraps,
      setGoalSteps,
      setNickname,
      addSteps,
      claimWalkPoints,
      addQuizCash,
      buyStock,
      toggleScrap,
      isScrapped,
      isReady,
    ],
  );
}
