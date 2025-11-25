import { getDdbDocClient } from "../../db/ddbClient.js";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { executeActions } from "./execute.js";
import { AppUsageDataT } from "../../types/user/sync/AppUsageData.js";
import { condition } from "./condition.js";
import { Result } from "types/common/common.js";

// Check app usage triggers for a given user with new app usage data
export async function checkAppUsageTriggers(user_id: string, data: AppUsageDataT, lastChecked: string | undefined) : Promise<Result<string[]>> {
  const ddb = getDdbDocClient();
  
  // Get all enabled app usage triggers for the user
  // We query by user_id and enabled_event_type (format: "true#{eventType}")
  const query = new QueryCommand({
    TableName: "APP_USAGE_TRIGGERS",
    IndexName: "user-id-index",
    KeyConditionExpression: "user_id = :userId",
    FilterExpression: "begins_with(enabled_event_type, :enabledPrefix)",
    ExpressionAttributeValues: {
      ":userId": user_id,
      ":enabledPrefix": "true#"
    }
  });

  try {
    const result = await ddb.send(query);
    if (!result.Items || result.Items.length === 0) {
      return { 
      success: false, 
      code: 404, 
      details: { 
        message: "Failed to check app usage triggers.", 
        error: "No triggers found."
      }
    };
    }

    // Filter triggers based on app usage data and conditions
    const triggeredItems = [];
    
    for (const item of result.Items) {
      const shouldTrigger = await condition(item.precondition, user_id, data, lastChecked);
      if (shouldTrigger) {
        triggeredItems.push(item);
      }
    }

    // Execute actions for triggered items
    const actions = triggeredItems.map(item => item.action_json);
    if (actions.length > 0) {
      await executeActions(user_id, actions);
    }

    return { success: true, value: triggeredItems.map(item => item.id) }; 
  } catch (error) {
    console.error(`Error checking app usage triggers for user ${user_id}:`, error);
    return { 
      success: false, 
      code: 500, 
      details: { 
        message: "Failed to check app usage triggers.", 
        error: error instanceof Error ? error.message : String(error)
      }
    };
  }
}

/*
Example JSON format for APP_USAGE_TRIGGERS table items:

{
  "id": "trigger-123",
  "user_id": "user-456",
  "enabled=": true,  // "true" means enabled
  "bundle_id": "com.example.app",
  "precondition": {
    "type": "no_foreground_activity",
    "params": {
      "duration_minutes": 10,
      "device_id": "device-789"  // Optional: specific device to check
    }
  },
  "action_json": [
    {
      "type": "notify_user",
      "params": {
        "message": "You've opened Example App!"
      }
    }
  ]
}

Precondition types:
- no_foreground_activity: Check if user hasn't had foreground activity for X minutes
- app_not_running: Check if a specific app is not currently running
- time_range: Check if current time is within a specific range
- weekday: Check if today is a specific weekday
- battery_level: Check if device battery is below/above a threshold
*/