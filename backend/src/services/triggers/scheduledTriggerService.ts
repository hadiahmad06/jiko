// src/services/scheduleTriggerService.ts
import { getDdbClient } from "../../db/ddbClient.js";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { executeActions } from "./execute.js";

export async function evaluateScheduledTriggers() {
  const now = new Date().toISOString();
  const db = getDdbClient();

  // Get all scheduled triggers where enabled = true and scheduled_at <= now
  const scheduledResponse = await db.send(
    new ScanCommand({
      TableName: "scheduled_triggers",
      FilterExpression: "enabled = :enabled AND scheduled_at <= :now",
      ExpressionAttributeValues: {
        ":enabled": true,
        ":now": now
      }
    })
  );

    // inside evaluateScheduledTriggers
    const scheduledTriggers = scheduledResponse.Items || [];

    // execute all triggers asynchronously and collect results
    const results = await Promise.all(
    scheduledTriggers.map(async (trigger) => {
        try {
        const rescheduleSuccess = await rescheduleTrigger(trigger);
        if (!rescheduleSuccess) {
          console.error(`Failed to reschedule trigger ${trigger.trigger_id}`);
          return { trigger_id: trigger.trigger_id, success: false };
        }
        await executeActions(trigger.user_id, trigger.action_json);

        // optionally handle recurrence_rule here
        return { trigger_id: trigger.trigger_id, success: true };
        } catch (err) {
        console.error(`Failed to execute trigger ${trigger.trigger_id}`, err);
        return { trigger_id: trigger.trigger_id, success: false };
        }
    })
    );
    return results;
}

async function rescheduleTrigger(trigger: any) : Promise<boolean> { 
  console.log(`Rescheduling trigger ${trigger.id}`);
  // Parse recurrence_rule and compute next scheduled_at
  if (!trigger.recurrence_rule) return false;
  let recurrence;
  try {
    recurrence = typeof trigger.recurrence_rule === "string"
      ? JSON.parse(trigger.recurrence_rule)
      : trigger.recurrence_rule;
  } catch (e) {
    console.error("Invalid recurrence_rule JSON", e);
    return false;
  }
  const interval = Number(recurrence.interval);
  const unit = recurrence.unit;
  if (!interval || !unit) return false;

  // Compute next scheduled_at
  const unitMs: Record<string, number> = {
    seconds: 1000,
    minutes: 60 * 1000,
    hours: 60 * 60 * 1000,
    days: 24 * 60 * 60 * 1000,
  };
  const ms = unitMs[unit];
  if (!ms) return false;
  const lastScheduled = new Date(trigger.scheduled_at || Date.now());
  const nextScheduled = new Date(lastScheduled.getTime() + interval * ms);
  const nextScheduledIso = nextScheduled.toISOString();

  // Update DynamoDB
  const db = getDdbClient();
  try {
    await db.send(
      new UpdateCommand({
        TableName: "scheduled_triggers",
        Key: { trigger_id: trigger.trigger_id },
        UpdateExpression: "SET scheduled_at = :next",
        ExpressionAttributeValues: {
          ":next": nextScheduledIso,
        },
      })
    );
    return true;
  } catch (error) {
    console.error(`Failed to reschedule trigger ${trigger.trigger_id}`, error);
    return false;
  }
}