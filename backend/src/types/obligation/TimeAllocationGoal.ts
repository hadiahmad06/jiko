import { z } from "zod";
import { Obligation } from "./Obligation";

// TIME_ALLOCATION_GOALS table schema
export const TimeAllocationGoal = Obligation.extend({
  target_minutes: z.number(),
  timeframe_days: z.number(),
});