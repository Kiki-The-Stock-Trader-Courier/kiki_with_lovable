import { Footprints, Coins } from "lucide-react";
import type { UserWalk } from "@/types/stock";

interface StepCounterProps {
  walk: UserWalk;
}

const StepCounter = ({ walk }: StepCounterProps) => {
  const progress = Math.min((walk.todaySteps / walk.goalSteps) * 100, 100);

  return (
    <div
      className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/95 px-4 py-3 shadow-md backdrop-blur-sm supports-[backdrop-filter]:bg-card/90"
      data-testid="step-counter"
      aria-label="걸음수 카운터"
    >
      {/* Steps */}
      <div className="flex items-center gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Footprints className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">오늘 걸음</p>
          <p className="text-sm font-bold tabular-nums text-foreground">
            {walk.todaySteps.toLocaleString()}
            <span className="text-xs font-normal text-muted-foreground">
              /{walk.goalSteps.toLocaleString()}
            </span>
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex-1">
        <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Cash */}
      <div className="flex items-center gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cash/10">
          <Coins className="h-5 w-5 text-cash" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">포인트</p>
          <p className="text-sm font-bold tabular-nums text-foreground">
            {walk.cashBalance.toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
};

export default StepCounter;
