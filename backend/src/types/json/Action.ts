import { z } from "zod";
import { Activity, ActivityQuery } from "../activity/Activity";
import { Obligation } from "../obligation/Obligation";
import { LocationData } from "types/user/sync/LocationData";

// LLM Actions
export const LlmGenerateAction = z.object({
  action: z.literal("llm_generate"),
  params: z.object({
    prompt: z.string(),
    context: z.any().optional()
  })
});

export const LlmChatAction = z.object({
  action: z.literal("llm_chat"),
  params: z.object({
    thread_id: z.string(),
    message: z.string()
  })
});

export const LlmSummarizeActivityAction = z.object({
  action: z.literal("llm_summarize_activity"),
  params: z.object({
    activity_window_minutes: z.number().int().min(1)
  })
});

// Activity CRUD Actions
export const CreateActivityAction = z.object({
  action: z.literal("create_activity"),
  params: Activity.partial()
});

export const DeleteActivityAction = z.object({
  action: z.literal("delete_activity"),
  params: z.object({
    activity_id: z.string()
  })
});

export const UpdateActivityAction = z.object({
  action: z.literal("update_activity"),
  params: Activity.partial().and(z.object({ activity_id: z.string() }))
});

export const QueryActivitiesAction = z.object({
  action: z.literal("query_activities"),
  params: z.object({
    query: z.string().optional(),
    limit: z.number().optional(),
    skip: z.number().optional()
  })
});

// Activity Entries Actions
export const StartActivityAction = z.object({
  action: z.literal("start_activity"),
  params: z.object({
    activity_id: z.string()
  })
});

export const EndActivityAction = z.object({
  action: z.literal("end_activity"),
  params: z.object({
    activity_id: z.string()
  })
});

export const AddActivityNoteAction = z.object({
  action: z.literal("add_activity_note"),
  params: z.object({
    activity_id: z.string(),
    note: z.string()
  })
});

export const QueryActivityEntriesAction = z.object({
  action: z.literal("query_activity_entries"),
  params: z.object({
    activity_id: z.string()
  })
});

// Preferences Actions
export const SetPreferenceAction = z.object({
  action: z.literal("set_preference"),
  params: z.object({
    key: z.string(),
    value: z.any()
  })
});

// Location Actions
export const CreateLocationAction = z.object({
  action: z.literal("create_location"),
  params: LocationData
});

export const DeleteLocationAction = z.object({
  action: z.literal("delete_location"),
  params: z.object({
    location_id: z.string()
  })
});

export const UpdateLocationAction = z.object({
  action: z.literal("update_location"),
  params: LocationData.partial().and(z.object({ location_id: z.string() })) 
});

// Generic Trigger Actions
export const DeleteTriggerAction = z.object({
  action: z.literal("delete_trigger"),
  params: z.object({
    trigger_id: z.string()
  })
});

export const QueryTriggersAction = z.object({
  action: z.literal("query_triggers"),
  params: z.object({
    filter: z.any().optional()
  })
});

// Location Trigger Actions
export const CreateLocationTriggerAction = z.object({
  action: z.literal("create_location_trigger"),
  params: z.any() // Using any for now since LocationTriggerT isn't defined
});

export const DisableLocationTriggerAction = z.object({
  action: z.literal("disable_location_trigger"),
  params: z.object({
    trigger_id: z.string()
  })
});

export const EnableLocationTriggerAction = z.object({
  action: z.literal("enable_location_trigger"),
  params: z.object({
    trigger_id: z.string()
  })
});

export const DeleteLocationTriggerAction = z.object({
  action: z.literal("delete_location_trigger"),
  params: z.object({
    trigger_id: z.string()
  })
});

export const UpdateLocationTriggerAction = z.object({
  action: z.literal("update_location_trigger"),
  params: z.any().and(z.object({ trigger_id: z.string() })) // Using any for now
});

export const QueryLocationTriggersAction = z.object({
  action: z.literal("query_location_triggers"),
  params: z.object({
    location_id: z.string().optional()
  })
});

// Scheduled Actions
export const CreateScheduledActionAction = z.object({
  action: z.literal("create_scheduled_action"),
  params: z.any() // Using any for now since ScheduledActionT isn't defined
});

export const DisableScheduledActionAction = z.object({
  action: z.literal("disable_scheduled_action"),
  params: z.object({
    schedule_id: z.string()
  })
});

export const EnableScheduledActionAction = z.object({
  action: z.literal("enable_scheduled_action"),
  params: z.object({
    schedule_id: z.string()
  })
});

export const DeleteScheduledActionAction = z.object({
  action: z.literal("delete_scheduled_action"),
  params: z.object({
    schedule_id: z.string()
  })
});

export const QueryScheduledActionsAction = z.object({
  action: z.literal("query_scheduled_actions"),
  params: z.object({
    filter: z.any().optional()
  })
});

// App Usage Trigger Actions
export const CreateAppUsageTriggerAction = z.object({
  action: z.literal("create_app_usage_trigger"),
  params: z.any()
});

export const DisableAppUsageTriggerAction = z.object({
  action: z.literal("disable_app_usage_trigger"),
  params: z.object({
    trigger_id: z.string()
  })
});

export const EnableAppUsageTriggerAction = z.object({
  action: z.literal("enable_app_usage_trigger"),
  params: z.object({
    trigger_id: z.string()
  })
});

export const DeleteAppUsageTriggerAction = z.object({
  action: z.literal("delete_app_usage_trigger"),
  params: z.object({
    trigger_id: z.string()
  })
});

// Notification Actions
export const SendNotificationAction = z.object({
  action: z.literal("send_notification"),
  params: z.object({
    title: z.string(),
    body: z.string(),
    silent: z.boolean().optional()
  })
});

// Logs & Summaries Actions
export const FetchUsageLogsAction = z.object({
  action: z.literal("fetch_usage_logs"),
  params: z.object({
    window_minutes: z.number().int().min(1)
  })
});

export const FetchSummaryAction = z.object({
  action: z.literal("fetch_summary"),
  params: z.object({
    window_minutes: z.number().int().min(1)
  })
});

// Obligation Actions
export const CreateObligationAction = z.object({
  action: z.literal("create_obligation"),
  params: Obligation.partial()
});

export const DeleteObligationAction = z.object({
  action: z.literal("delete_obligation"),
  params: z.object({
    obligation_id: z.string()
  })
});

export const UpdateObligationAction = z.object({
  action: z.literal("update_obligation"),
  params: Obligation.partial().and(z.object({ obligation_id: z.string() }))
});

export const QueryObligationsAction = z.object({
  action: z.literal("query_obligations"),
  params: z.object({
    filter: z.any().optional()
  })
});

// Union of all actions
export const Action = z.discriminatedUnion("action", [
  LlmGenerateAction,
  LlmChatAction,
  LlmSummarizeActivityAction,
  CreateActivityAction,
  DeleteActivityAction,
  UpdateActivityAction,
  QueryActivitiesAction,
  StartActivityAction,
  EndActivityAction,
  AddActivityNoteAction,
  QueryActivityEntriesAction,
  SetPreferenceAction,
  CreateLocationAction,
  DeleteLocationAction,
  UpdateLocationAction,
  DeleteTriggerAction,
  QueryTriggersAction,
  CreateLocationTriggerAction,
  DisableLocationTriggerAction,
  EnableLocationTriggerAction,
  DeleteLocationTriggerAction,
  UpdateLocationTriggerAction,
  QueryLocationTriggersAction,
  CreateScheduledActionAction,
  DisableScheduledActionAction,
  EnableScheduledActionAction,
  DeleteScheduledActionAction,
  QueryScheduledActionsAction,
  CreateAppUsageTriggerAction,
  DisableAppUsageTriggerAction,
  EnableAppUsageTriggerAction,
  DeleteAppUsageTriggerAction,
  SendNotificationAction,
  FetchUsageLogsAction,
  FetchSummaryAction,
  CreateObligationAction,
  DeleteObligationAction,
  UpdateObligationAction,
  QueryObligationsAction
]);

export type ActionT = z.infer<typeof Action>;