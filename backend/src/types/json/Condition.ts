import { z } from "zod";

const NoForegroundActivityCondition = z.object({
  type: z.literal("no_foreground_activity"),
  params: z.object({
    duration_minutes: z.number().int().min(1),
    device_id: z.string().optional()
  })
});

const AppNotRunningCondition = z.object({
  type: z.literal("app_not_running"),
  params: z.object({
    bundle_id: z.string(),
    device_id: z.string().optional(),
    min_seconds_not_running: z.number().int().min(0).optional()
  })
});

const TimeRangeCondition = z.object({
  type: z.literal("time_range"),
  params: z.object({
    start: z.string().regex(/^\d{2}:\d{2}$/), // "HH:MM"
    end: z.string().regex(/^\d{2}:\d{2}$/),
    timezone: z.string().optional(), // IANA TZ
    allow_wrap: z.boolean().optional()
  })
});

const WeekdayCondition = z.object({
  type: z.literal("weekday"),
  params: z.object({
    days: z.union([
      z.string().toLowerCase().refine(v =>
        ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"].includes(v)
      ),
      z.array(
        z.string().toLowerCase().refine(v =>
          ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"].includes(v)
        )
      )
    ]),
    timezone: z.string().optional()
  })
});

const BatteryLevelCondition = z.object({
  type: z.literal("battery_level"),
  params: z.object({
    operator: z.enum(["<", "<=", ">", ">=", "=="]),
    value: z.number().min(0).max(100),
    device_id: z.string().optional(),
    use_latest: z.boolean().optional()
  })
});

const LocationNotInsideCondition = z.object({
  type: z.literal("location_not_inside"),
  params: z.object({
    location_id: z.string(),
    require_duration_seconds: z.number().int().min(0).optional(),
    use_current_location_only: z.boolean().optional()
  })
});

const AppRecentlyUsedCondition = z.object({
  type: z.literal("app_recently_used"),
  params: z.object({
    bundle_id: z.string(),
    within_seconds: z.number().int().min(1),
    device_id: z.string().optional()
  })
});

const UserMotionStateCondition = z.object({
  type: z.literal("user_motion_state"),
  params: z.object({
    states: z.array(z.enum(["walking","driving","stationary","running","cycling"])),
    confidence: z.number().min(0).max(1).optional(),
    duration_seconds: z.number().int().min(0).optional()
  })
});

const SpeedCondition = z.object({
  type: z.literal("speed"),
  params: z.object({
    operator: z.enum(["<", "<=", ">", ">="]),
    value_kmh: z.number().min(0),
    duration_seconds: z.number().int().min(0).optional()
  })
});

const ScreenStateCondition = z.object({
  type: z.literal("screen_state"),
  params: z.object({
    is_on: z.boolean(),
    device_id: z.string().optional()
  })
});

const DndStatusCondition = z.object({
  type: z.literal("dnd_status"),
  params: z.object({
    enabled: z.boolean(),
    device_id: z.string().optional()
  })
});

const BatteryStatusCondition = z.object({
  type: z.literal("battery_status"),
  params: z.object({
    is_charging: z.boolean().optional(),
    operator: z.enum(["<", "<=", ">", ">=", "=="]).optional(),
    value: z.number().min(0).max(100).optional(),
    device_id: z.string().optional()
  })
});

const CooldownExpiredCondition = z.object({
  type: z.literal("cooldown_expired"),
  params: z.object({
    cooldown_seconds: z.number().int().min(0),
    key: z.string()
  })
});

const QuotaRemainingCondition = z.object({
  type: z.literal("quota_remaining"),
  params: z.object({
    quota_key: z.string(),
    max_daily: z.number().int().min(0)
  })
});

const TriggerLastRanCondition = z.object({
  type: z.literal("trigger_last_ran"),
  params: z.object({
    min_seconds_since: z.number().int().min(0)
  })
});

const AllCondition = z.object({
  type: z.literal("all"),
  params: z.object({
    conditions: z.array(z.any())
  })
});

const AnyCondition = z.object({
  type: z.literal("any"),
  params: z.object({
    conditions: z.array(z.any())
  })
});

const NoneCondition = z.object({
  type: z.literal("none"),
  params: z.object({
    conditions: z.array(z.any())
  })
});

const AtLeastNCondition = z.object({
  type: z.literal("at_least_n"),
  params: z.object({
    n: z.number().int().min(1),
    conditions: z.array(z.any())
  })
});

const AtMostNCondition = z.object({
  type: z.literal("at_most_n"),
  params: z.object({
    n: z.number().int().min(0),
    conditions: z.array(z.any())
  })
});

// ! FULL DISCRIMINATED UNION, now allowing boolean literals as valid conditions
export const Condition = z.union([
  z.discriminatedUnion("type", [
    NoForegroundActivityCondition,
    AppNotRunningCondition,
    TimeRangeCondition,
    WeekdayCondition,
    BatteryLevelCondition,
    LocationNotInsideCondition,
    AppRecentlyUsedCondition,
    UserMotionStateCondition,
    SpeedCondition,
    ScreenStateCondition,
    DndStatusCondition,
    BatteryStatusCondition,
    CooldownExpiredCondition,
    QuotaRemainingCondition,
    TriggerLastRanCondition,
    AllCondition,
    AnyCondition,
    NoneCondition,
    AtLeastNCondition,
    AtMostNCondition
  ]),
  z.boolean()
]);

export type ConditionT = z.infer<typeof Condition>;