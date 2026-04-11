import { registerPlugin } from "@capacitor/core";

export interface StepStats {
  steps: number;
  goal: number;
  cashPerStep: number;
  cash: number;
}

interface StepTrackerPlugin {
  requestAllPermissions(): Promise<void>;
  start(options: { goal: number; cashPerStep: number; steps: number }): Promise<{ ok: boolean }>;
  stop(): Promise<void>;
  getStats(): Promise<StepStats>;
}

export const StepTracker = registerPlugin<StepTrackerPlugin>("StepTracker");
