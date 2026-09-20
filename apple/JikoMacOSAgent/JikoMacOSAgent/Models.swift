//  Models.swift
//  Codable mirrors of the backend's JSON. Field names match the API exactly.
import Foundation

struct AppUsageLog: Codable, Equatable {
  var bundleId: String
  var timestamp: String
  var appName: String
  var startTime: String
  var durationSeconds: Double
  var category: String?
  var isForeground: Bool?
  var windowTitle: String?
}

struct AppUsagePayload: Codable {
  var timestamp: String
  var platform: String = "macos"
  var device_id: String
  var log: [AppUsageLog]
}

struct SyncResponse: Codable {
  var triggered_ids: [String]
}

struct TokenPair: Codable {
  var token: String
  var refreshToken: String
  var user_id: String?
}

struct Me: Codable {
  var id: String
  var phoneNumber: String?
  var username: String?
  var displayName: String?
  var nickname: String?
}

struct Message: Codable, Identifiable, Equatable {
  var id: String
  var user_id: String
  var direction: String   // outbound (Jiko -> user) | inbound
  var channel: String
  var body: String
  var status: String
  var trigger_id: String?
  var reply_to_id: String?
  var created_at: String

  var isFromJiko: Bool { direction == "outbound" }
  var createdDate: Date { ISO8601DateFormatter.jiko.date(from: created_at) ?? Date() }
}

struct TalkbackResponse: Codable {
  var message: Message
  var intent: String
  var reply: String
  var effects: [String]
}

struct Budget: Codable, Equatable {
  var used: Int
  var budget: Int
  var remaining: Int
  var quiet_hours_active: Bool
  var quiet_mode_active: Bool?
  var quiet_until: String?
  var quiet_reason: String?
}

struct QuietHours: Codable, Equatable {
  var start: String
  var end: String
}

struct Preferences: Codable, Equatable {
  var user_id: String
  var timezone: String
  var language: String
  var strictness: Double
  var interrupt_budget_per_day: Int
  var quiet_hours: QuietHours
  var voice: String
  var delivery_channel: String
  var budget: Budget?
}

struct PreferencesPatch: Codable {
  var timezone: String?
  var strictness: Double?
  var interrupt_budget_per_day: Int?
  var quiet_hours: QuietHours?
  var voice: String?
  var delivery_channel: String?
}

struct SeenApp: Codable, Identifiable, Equatable {
  var bundle_id: String
  var app_name: String?
  var label: String?
  var last_seen: String
  var id: String { bundle_id }
}

struct AppLabel: Codable { var bundle_id: String; var label: String }
struct AppLabelSet: Codable { var labels: [AppLabel] }

struct UsageSummary: Codable, Equatable {
  struct TopApp: Codable, Equatable, Identifiable {
    var bundle_id: String; var app_name: String?; var label: String?; var seconds: Int; var opens: Int
    var id: String { bundle_id }
  }
  var day: String
  var total_seconds: Int
  var by_label: [String: Int]
  var top_apps: [TopApp]
  var focus_minutes: Int
  var obligations_due_soon: Int
  var text: String
}

struct Obligation: Codable, Identifiable, Equatable {
  var id: String
  var kind: String
  var title: String
  var due_at: String?
  var start_at: String?
  var completed: Bool
  var whenDate: Date? { ISO8601DateFormatter.jiko.date(from: due_at ?? start_at ?? "") }
}

struct QuickAdd: Codable { var text: String; var timezone: String? }

struct TriggerPreset: Codable, Identifiable, Equatable {
  var id: String
  var name: String
  var description: String
  var kind: String
  var params: [String: String]
}

struct Trigger: Codable, Identifiable, Equatable {
  var id: String
  var kind: String
  var name: String
  var enabled: Bool
  var source: String
  var fire_count: Int
  var last_fired_at: String?
  var last_firing: LastFiring?
}

struct LastFiring: Codable, Equatable {
  var id: String
  var fired_at: String
  var reason: String

  var firedDate: Date { ISO8601DateFormatter.jiko.date(from: fired_at) ?? Date() }
}

/// GET /messages/:id/why
struct MessageWhy: Codable, Equatable {
  var message_id: String
  var reason: String
  var trigger: WhyTrigger?

  struct WhyTrigger: Codable, Equatable {
    var id: String
    var name: String
    var kind: String
  }
}

struct DeviceRegistration: Codable {
  var id: String
  var platform: String = "macos"
  var name: String?
}

struct APIErrorBody: Codable {
  var error: String
  var message: String?
}

extension ISO8601DateFormatter {
  /// Backend emits fractional seconds; parse both forms.
  static let jiko: ISO8601DateFormatter = {
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return f
  }()
  static let jikoPlain: ISO8601DateFormatter = {
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withInternetDateTime]
    return f
  }()
}

extension Date {
  var iso: String { ISO8601DateFormatter.jiko.string(from: self) }
}
