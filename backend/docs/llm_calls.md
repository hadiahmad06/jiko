
# LLM Action Calls - TBD

## LLM Actions
| Action | Parameters |
|--------|------------|
| `llm_generate` | `{ prompt: string, context?: any }` |
| `llm_chat` | `{ thread_id: string, message: string }` |
| `llm_summarize_activity` | `{ activity_window_minutes: number }` |

---

## Activity CRUD
| Action | Parameters |
|--------|------------|
| `create_activity` | `Partial<ActivityT>` |
| `delete_activity` | `{ activity_id: string }` |
| `update_activity` | `Partial<ActivityT> & { activity_id: string }` |
| `query_activities` | `{ filter?: any }` |

---

## Activity Entries
| Action | Parameters |
|--------|------------|
| `start_activity` | `{ activity_id: string }` |
| `end_activity` | `{ activity_id: string }` |
| `add_activity_note` | `{ activity_id: string, note: string }` |
| `query_activity_entries` | `{ activity_id: string }` |

---

## Preferences
| Action | Parameters |
|--------|------------|
| `set_preference` | `{ key: string, value: any }` |

---

## Locations
| Action | Parameters |
|--------|------------|
| `create_location` | `Partial<LocationT>` |
| `delete_location` | `{ location_id: string }` |
| `update_location` | `Partial<LocationT> & { location_id: string }` |

---

## Triggers (Generic)
| Action | Parameters |
|--------|------------|
| `delete_trigger` | `{ trigger_id: string }` |
| `query_triggers` | `{ filter?: any }` |

---

## Location Triggers
| Action | Parameters |
|--------|------------|
| `create_location_trigger` | `Partial<LocationTriggerT>` |
| `disable_location_trigger` | `{ trigger_id: string }` |
| `enable_location_trigger` | `{ trigger_id: string }` |
| `delete_location_trigger` | `{ trigger_id: string }` |
| `update_location_trigger` | `Partial<LocationTriggerT> & { trigger_id: string }` |
| `query_location_triggers` | `{ location_id?: string }` |

---

## Scheduled Actions
| Action | Parameters |
|--------|------------|
| `create_scheduled_action` | `Partial<ScheduledActionT>` |
| `disable_scheduled_action` | `{ schedule_id: string }` |
| `enable_scheduled_action` | `{ schedule_id: string }` |
| `delete_scheduled_action` | `{ schedule_id: string }` |
| `query_scheduled_actions` | `{ filter?: any }` |

---

## App Usage Triggers
| Action | Parameters |
|--------|------------|
| `create_app_usage_trigger` | `Partial<AppUsageTriggerT>` |
| `disable_app_usage_trigger` | `{ trigger_id: string }` |
| `enable_app_usage_trigger` | `{ trigger_id: string }` |
| `delete_app_usage_trigger` | `{ trigger_id: string }` |

---

## Notifications
| Action | Parameters |
|--------|------------|
| `send_notification` | `{ title: string, body: string, silent?: boolean }` |

---

## Logs & Summaries
| Action | Parameters |
|--------|------------|
| `fetch_usage_logs` | `{ window_minutes: number }` |
| `fetch_summary` | `{ window_minutes: number }` |

---

## Obligations
| Action | Parameters |
|--------|------------|
| `create_obligation` | `Partial<ObligationT>` |
| `delete_obligation` | `{ obligation_id: string }` |
| `update_obligation` | `Partial<ObligationT> & { obligation_id: string }` |
| `query_obligations` | `{ filter?: any }` |