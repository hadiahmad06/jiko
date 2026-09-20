//  Models.swift
//  Codable mirrors of the backend's JSON. Field names match the API exactly.
//  Shared by every agent; nothing here is platform-specific.
import Foundation

public struct AppUsageLog: Codable, Equatable {
  public var bundleId: String
  public var timestamp: String
  public var appName: String
  public var startTime: String
  public var durationSeconds: Double
  public var category: String?
  public var isForeground: Bool?
  public var windowTitle: String?

  public init(bundleId: String, timestamp: String, appName: String, startTime: String, durationSeconds: Double,
              category: String? = nil, isForeground: Bool? = nil, windowTitle: String? = nil) {
    self.bundleId = bundleId; self.timestamp = timestamp; self.appName = appName; self.startTime = startTime
    self.durationSeconds = durationSeconds; self.category = category; self.isForeground = isForeground; self.windowTitle = windowTitle
  }
}

public struct AppUsagePayload: Codable {
  public var timestamp: String
  public var platform: String
  public var device_id: String
  public var log: [AppUsageLog]

  public init(timestamp: String, platform: String, device_id: String, log: [AppUsageLog]) {
    self.timestamp = timestamp; self.platform = platform; self.device_id = device_id; self.log = log
  }
}

/// POST /sync/location
public struct LocationPayload: Codable {
  public var timestamp: String
  public var platform: String
  public var device_id: String
  public var latitude: Double
  public var longitude: Double
  /// GPS accuracy in metres, not a geofence radius.
  public var radius: Double
  public var altitude: Double?

  public init(timestamp: String, platform: String, device_id: String, latitude: Double, longitude: Double, radius: Double, altitude: Double? = nil) {
    self.timestamp = timestamp; self.platform = platform; self.device_id = device_id
    self.latitude = latitude; self.longitude = longitude; self.radius = radius; self.altitude = altitude
  }
}

/// One health sample. Extra metrics ride along as `values`, flattened on encode
/// so the backend's catchall schema sees `sleep_minutes`, `steps` and friends
/// as top-level keys.
public struct HealthLog: Codable, Equatable {
  public var timestamp: String
  public var start_time: String
  public var end_time: String
  public var values: [String: Double]

  public init(timestamp: String, start_time: String, end_time: String, values: [String: Double]) {
    self.timestamp = timestamp; self.start_time = start_time; self.end_time = end_time; self.values = values
  }

  private struct Key: CodingKey {
    var stringValue: String
    var intValue: Int? { nil }
    init?(stringValue: String) { self.stringValue = stringValue }
    init?(intValue: Int) { nil }
    init(_ s: String) { stringValue = s }
  }

  public func encode(to encoder: Encoder) throws {
    var c = encoder.container(keyedBy: Key.self)
    try c.encode(timestamp, forKey: Key("timestamp"))
    try c.encode(start_time, forKey: Key("start_time"))
    try c.encode(end_time, forKey: Key("end_time"))
    for (k, v) in values { try c.encode(v, forKey: Key(k)) }
  }

  public init(from decoder: Decoder) throws {
    let c = try decoder.container(keyedBy: Key.self)
    timestamp = try c.decode(String.self, forKey: Key("timestamp"))
    start_time = try c.decode(String.self, forKey: Key("start_time"))
    end_time = try c.decode(String.self, forKey: Key("end_time"))
    var rest: [String: Double] = [:]
    for key in c.allKeys where !["timestamp", "start_time", "end_time"].contains(key.stringValue) {
      if let v = try? c.decode(Double.self, forKey: key) { rest[key.stringValue] = v }
    }
    values = rest
  }
}

/// POST /sync/health
public struct HealthPayload: Codable {
  public var timestamp: String
  public var platform: String
  public var device_id: String
  public var log: [HealthLog]

  public init(timestamp: String, platform: String, device_id: String, log: [HealthLog]) {
    self.timestamp = timestamp; self.platform = platform; self.device_id = device_id; self.log = log
  }
}

public struct SyncResponse: Codable {
  public var triggered_ids: [String]
}

public struct TokenPair: Codable {
  public var token: String
  public var refreshToken: String
  public var user_id: String?
}

public struct Me: Codable {
  public var id: String
  public var phoneNumber: String?
  public var username: String?
  public var displayName: String?
  public var nickname: String?
}

public struct Message: Codable, Identifiable, Equatable {
  public var id: String
  public var user_id: String
  public var direction: String   // outbound (Jiko -> user) | inbound
  public var channel: String
  public var body: String
  public var status: String
  public var trigger_id: String?
  public var reply_to_id: String?
  public var created_at: String

  public var isFromJiko: Bool { direction == "outbound" }
  public var createdDate: Date { ISO8601DateFormatter.jiko.date(from: created_at) ?? Date() }
}

public struct TalkbackResponse: Codable {
  public var message: Message
  public var intent: String
  public var reply: String
  public var effects: [String]
}

public struct Budget: Codable, Equatable {
  public var used: Int
  /// What Jiko will spend today; `budget_set` is the ceiling the user chose.
  public var budget: Int
  public var budget_set: Int?
  public var budget_reason: String?
  public var remaining: Int
  public var quiet_hours_active: Bool
  public var quiet_mode_active: Bool?
  public var quiet_until: String?
  public var quiet_reason: String?
}

public struct QuietHours: Codable, Equatable {
  public var start: String
  public var end: String

  public init(start: String, end: String) { self.start = start; self.end = end }
}

public struct Preferences: Codable, Equatable {
  public var user_id: String
  public var timezone: String
  public var language: String
  public var strictness: Double
  public var interrupt_budget_per_day: Int
  public var quiet_hours: QuietHours
  public var voice: String
  public var delivery_channel: String
  public var budget: Budget?
}

public struct PreferencesPatch: Codable {
  public init(timezone: String? = nil, strictness: Double? = nil, interrupt_budget_per_day: Int? = nil,
              quiet_hours: QuietHours? = nil, voice: String? = nil, delivery_channel: String? = nil) {
    self.timezone = timezone; self.strictness = strictness; self.interrupt_budget_per_day = interrupt_budget_per_day
    self.quiet_hours = quiet_hours; self.voice = voice; self.delivery_channel = delivery_channel
  }

  public var timezone: String?
  public var strictness: Double?
  public var interrupt_budget_per_day: Int?
  public var quiet_hours: QuietHours?
  public var voice: String?
  public var delivery_channel: String?
}

public struct SeenApp: Codable, Identifiable, Equatable {
  public var bundle_id: String
  public var app_name: String?
  public var label: String?
  public var last_seen: String

  public init(bundle_id: String, app_name: String?, label: String?, last_seen: String) {
    self.bundle_id = bundle_id; self.app_name = app_name; self.label = label; self.last_seen = last_seen
  }
  public var id: String { bundle_id }
}

public struct AppLabel: Codable {
  public var bundle_id: String
  public var label: String
  public init(bundle_id: String, label: String) { self.bundle_id = bundle_id; self.label = label }
}

public struct AppLabelSet: Codable {
  public var labels: [AppLabel]
  public init(labels: [AppLabel]) { self.labels = labels }
}

public struct UsageSummary: Codable, Equatable {
  public struct TopApp: Codable, Equatable, Identifiable {
    public var bundle_id: String
    public var app_name: String?
    public var label: String?
    public var seconds: Int
    public var opens: Int
    public var id: String { bundle_id }
  }
  public var day: String
  public var total_seconds: Int
  public var by_label: [String: Int]
  public var top_apps: [TopApp]
  public var focus_minutes: Int
  public var obligations_due_soon: Int
  public var text: String
}

public struct Obligation: Codable, Identifiable, Equatable {
  public var id: String
  public var kind: String
  public var title: String
  public var due_at: String?
  public var start_at: String?
  public var completed: Bool
  public var whenDate: Date? { ISO8601DateFormatter.jiko.date(from: due_at ?? start_at ?? "") }
}

public struct QuickAdd: Codable {
  public var text: String
  public var timezone: String?
  public init(text: String, timezone: String? = nil) { self.text = text; self.timezone = timezone }
}

public struct TriggerPreset: Codable, Identifiable, Equatable {
  public var id: String
  public var name: String
  public var description: String
  public var kind: String
  public var params: [String: String]
}

public struct Trigger: Codable, Identifiable, Equatable {
  public var id: String
  public var kind: String
  public var name: String
  public var enabled: Bool
  public var source: String
  public var fire_count: Int
  public var last_fired_at: String?
  public var last_firing: LastFiring?
  /// Times the user marked one of this rule's nudges wrong in the last week.
  public var wrong_recently: Int?
  public var wrong_limit: Int?
}

public struct LastFiring: Codable, Equatable {
  public var id: String
  public var fired_at: String
  public var reason: String

  public var firedDate: Date { ISO8601DateFormatter.jiko.date(from: fired_at) ?? Date() }
}

/// GET /messages/:id/why
public struct MessageWhy: Codable, Equatable {
  public var message_id: String
  public var reason: String
  public var trigger: WhyTrigger?

  public struct WhyTrigger: Codable, Equatable {
    public var id: String
    public var name: String
    public var kind: String
  }
}

/// POST /messages/:id/feedback
public struct MessageFeedback: Codable, Equatable {
  public var message_id: String
  public var verdict: String
  public var trigger_id: String?
  public var wrong_in_window: Int
  public var disabled_trigger: Bool
}

public struct DeviceRegistration: Codable {
  public var id: String
  public var platform: String
  public var name: String?

  public init(id: String, platform: String, name: String? = nil) {
    self.id = id; self.platform = platform; self.name = name
  }
}

public struct APIErrorBody: Codable {
  public var error: String
  public var message: String?
}

extension ISO8601DateFormatter {
  /// Backend emits fractional seconds; parse both forms. `nonisolated(unsafe)`
  /// because ISO8601DateFormatter isn't Sendable but is safe to read from
  /// several tasks once configured.
  public nonisolated(unsafe) static let jiko: ISO8601DateFormatter = {
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return f
  }()
  public nonisolated(unsafe) static let jikoPlain: ISO8601DateFormatter = {
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withInternetDateTime]
    return f
  }()
}

extension Date {
  public var iso: String { ISO8601DateFormatter.jiko.string(from: self) }
}

public struct Place: Codable, Identifiable, Equatable {
  public var id: String
  public var name: String
  public var latitude: Double
  public var longitude: Double
  public var radius_m: Int
  public var archived: Bool
}

public struct PlaceCreate: Codable {
  public var name: String
  public var latitude: Double
  public var longitude: Double
  public var radius_m: Int

  public init(name: String, latitude: Double, longitude: Double, radius_m: Int = 150) {
    self.name = name; self.latitude = latitude; self.longitude = longitude; self.radius_m = radius_m
  }
}

public struct Activity: Codable, Identifiable, Equatable {
  public var id: String
  public var name: String
}

public struct ActivityCreate: Codable {
  public var name: String
  public init(name: String) { self.name = name }
}

// MARK: - calendars

public struct CalendarSubscription: Codable, Identifiable, Equatable {
  public var id: String
  public var url: String
  public var name: String?
  public var enabled: Bool
  public var window_days: Int
  public var refresh_hours: Int
  public var last_imported_at: String?
  public var last_status: String?
  public var last_error: String?
  public var last_created: Int
  public var last_updated: Int
}

public struct CalendarImportResponse: Codable, Equatable {
  public struct ImportResult: Codable, Equatable {
    public var status: String
    public var parsed: Int?
    public var created: Int?
    public var updated: Int?
    public var error: String?
  }
  public var subscription: CalendarSubscription
  public var `import`: ImportResult
}
