import { ConditionT } from "../../types/json/Condition.js";
import { AppUsageDataT } from "../../types/user/sync/AppUsageData.js";

// Evaluate a condition against app usage data and other context
export async function condition(conditionObj: ConditionT, user_id: string, data: AppUsageDataT, lastChecked: string | undefined): Promise<boolean> {
  // For now, we'll implement a simple version that handles basic conditions
  // In a full implementation, this would check various data sources
  if (typeof conditionObj === "boolean") return conditionObj;

  switch (conditionObj.type) {
    case "no_foreground_activity":
      // Check if user hasn't had foreground activity for X minutes
      // This is a simplified implementation - in reality, we'd need to check actual foreground activity data
      const durationMinutes = conditionObj.params.duration_minutes;
      const cutoffTime = new Date(Date.now() - durationMinutes * 60 * 1000);
      // For now, we'll just check if any app usage is older than the cutoff
      return !data.log.some(log => 
        new Date(log.timestamp) > cutoffTime && (log.isForeground === true)
      );
    
    case "app_not_running":
      // Check if a specific app is not currently running
      const bundleId = conditionObj.params.bundle_id;
      // Check if the app has been used recently (within a small time window)
      const recentLogs = data.log.filter(log => 
        log.bundleId === bundleId && 
        new Date(log.timestamp) > new Date(Date.now() - 30 * 1000) // Last 30 seconds
      );
      return recentLogs.length === 0;
    
    case "time_range":
      // Check if current time is within a specific range
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      // Simple string comparison for time ranges (doesn't handle wraparound)
      return currentTime >= conditionObj.params.start && currentTime <= conditionObj.params.end;
    
    case "weekday":
      // Check if today is a specific weekday
      const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      if (typeof conditionObj.params.days === 'string') {
        return conditionObj.params.days === today;
      } else {
        return conditionObj.params.days.includes(today);
      }
    
    case "all":
      // All conditions must be true
      if (!conditionObj.params.conditions || conditionObj.params.conditions.length === 0) {
        return true;
      }
      for (const subCondition of conditionObj.params.conditions) {
        if (!(await condition(subCondition, user_id, data, lastChecked))) {
          return false;
        }
      }
      return true;
    
    case "any":
      // At least one condition must be true
      if (!conditionObj.params.conditions || conditionObj.params.conditions.length === 0) {
        return false;
      }
      for (const subCondition of conditionObj.params.conditions) {
        if (await condition(subCondition, user_id, data, lastChecked)) {
          return true;
        }
      }
      return false;
    
    case "none":
      // No conditions must be true
      if (!conditionObj.params.conditions || conditionObj.params.conditions.length === 0) {
        return true;
      }
      for (const subCondition of conditionObj.params.conditions) {
        if (await condition(subCondition, user_id, data, lastChecked)) {
          return false;
        }
      }
      return true;
    
    case "at_least_n":
      // At least N conditions must be true
      if (!conditionObj.params.conditions || conditionObj.params.conditions.length === 0) {
        return conditionObj.params.n === 0;
      }
      let trueCount = 0;
      for (const subCondition of conditionObj.params.conditions) {
        if (await condition(subCondition, user_id, data, lastChecked)) {
          trueCount++;
          if (trueCount >= conditionObj.params.n) {
            return true;
          }
        }
      }
      return false;
    
    case "at_most_n":
      // At most N conditions must be true
      if (!conditionObj.params.conditions || conditionObj.params.conditions.length === 0) {
        return true;
      }
      let trueCountAtMost = 0;
      for (const subCondition of conditionObj.params.conditions) {
        if (await condition(subCondition, user_id, data, lastChecked)) {
          trueCountAtMost++;
          if (trueCountAtMost > conditionObj.params.n) {
            return false;
          }
        }
      }
      return true;
    
    default:
      // For unimplemented conditions, return true to avoid blocking triggers
      console.warn(`Unimplemented condition type: ${conditionObj.type}`);
      return true;
  }
}