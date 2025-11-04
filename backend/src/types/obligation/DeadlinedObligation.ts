import { z } from "zod";
import { Obligation } from "./Obligation";

// DEADLINED_OBLIGATIONS table schema
export const DeadlinedObligation = Obligation.extend({
  deadline: z.date(),
  is_completed: z.boolean(),
});
