// src/jobs/triggerScheduler.ts
import cron from "node-cron";
import { evaluateScheduledTriggers } from "../services/triggers/scheduledTriggerService.js";

export function startTriggerScheduler() {
  // runs every 10 seconds
  cron.schedule("*/10 * * * * *", async () => {
    console.log("[cron] checking scheduled triggers...");
    await evaluateScheduledTriggers();
  });
}