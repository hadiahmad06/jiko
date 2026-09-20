//  JikoAPI.swift
//  One client for the backend, shared by every agent. Bearer auth,
//  refresh-on-401, typed errors. No UI, no platform APIs.
import Foundation

public enum APIError: LocalizedError {
  case http(Int, String)
  case unauthenticated
  case transport(Error)
  case decoding(Error)
  case notSent(String)

  public var errorDescription: String? {
    switch self {
    case .http(let code, let msg): return "\(code): \(msg)"
    case .unauthenticated: return "Not signed in"
    case .transport(let e): return e.localizedDescription
    case .decoding(let e): return "Bad response: \(e.localizedDescription)"
    case .notSent(let why): return why
    }
  }
}

public actor JikoAPI {
  public static let shared = JikoAPI()

  private let session: URLSession
  public private(set) var baseURL: URL
  private var accessToken: String?
  private var refreshToken: String?

  public init(defaultBaseURL: String = "http://localhost:3000") {
    let cfg = URLSessionConfiguration.default
    cfg.timeoutIntervalForRequest = 15
    cfg.waitsForConnectivity = false
    session = URLSession(configuration: cfg)
    baseURL = URL(string: UserDefaults.standard.string(forKey: "jiko.baseURL") ?? defaultBaseURL)!
    accessToken = Keychain.get("access")
    refreshToken = Keychain.get("refresh")
  }

  public var isAuthenticated: Bool { accessToken != nil }

  public func setBaseURL(_ s: String) {
    guard let u = URL(string: s.trimmingCharacters(in: .whitespaces)) else { return }
    baseURL = u
    UserDefaults.standard.set(u.absoluteString, forKey: "jiko.baseURL")
  }

  public func signOut() {
    accessToken = nil; refreshToken = nil
    Keychain.delete("access"); Keychain.delete("refresh")
  }

  private func store(_ pair: TokenPair) {
    accessToken = pair.token; refreshToken = pair.refreshToken
    Keychain.set(pair.token, for: "access"); Keychain.set(pair.refreshToken, for: "refresh")
  }

  // MARK: - core

  private func request<T: Decodable>(_ method: String, _ path: String, body: Any? = nil, query: [String: String] = [:], auth: Bool = true, retry: Bool = true) async throws -> T {
    var comps = URLComponents(url: baseURL.appendingPathComponent(path), resolvingAgainstBaseURL: false)!
    if !query.isEmpty { comps.queryItems = query.map { URLQueryItem(name: $0.key, value: $0.value) } }
    var req = URLRequest(url: comps.url!)
    req.httpMethod = method
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
    if auth {
      guard let t = accessToken else { throw APIError.unauthenticated }
      req.setValue("Bearer \(t)", forHTTPHeaderField: "Authorization")
    }
    if let body { req.httpBody = try Self.encodeBody(body) }

    let data: Data
    let resp: URLResponse
    do { (data, resp) = try await session.data(for: req) } catch { throw APIError.transport(error) }
    let code = (resp as? HTTPURLResponse)?.statusCode ?? 0

    if code == 401, auth, retry, refreshToken != nil {
      if await refreshAccess() { return try await request(method, path, body: body, query: query, auth: auth, retry: false) }
      signOut()
      throw APIError.unauthenticated
    }
    guard (200..<300).contains(code) else {
      let msg = (try? JSONDecoder().decode(APIErrorBody.self, from: data)).map { ($0.message ?? $0.error) } ?? String(data: data, encoding: .utf8) ?? ""
      throw APIError.http(code, msg)
    }
    if T.self == Empty.self { return Empty() as! T }
    do { return try JSONDecoder().decode(T.self, from: data) } catch { throw APIError.decoding(error) }
  }

  /// Typed bodies go through JSONEncoder; `[String: Any]` through JSONSerialization.
  public static func encodeBody(_ body: Any) throws -> Data {
    if let dict = body as? [String: Any] { return try JSONSerialization.data(withJSONObject: dict) }
    if let enc = body as? any Encodable { return try JSONEncoder().encode(AnyEncodable(enc)) }
    throw APIError.notSent("unencodable body")
  }

  private func refreshAccess() async -> Bool {
    guard let rt = refreshToken else { return false }
    struct R: Codable { var token: String }
    do {
      let r: R = try await request("POST", "auth/refresh", body: ["refreshToken": rt], auth: false, retry: false)
      accessToken = r.token; Keychain.set(r.token, for: "access")
      return true
    } catch { return false }
  }

  // MARK: - auth

  public func login(phone: String, password: String) async throws {
    let pair: TokenPair = try await request("POST", "auth/login", body: ["phone_number": phone, "password": password], auth: false)
    store(pair)
  }

  public func signup(phone: String, password: String, nickname: String?) async throws {
    var body: [String: String] = ["phone_number": phone, "password": password]
    if let nickname, !nickname.isEmpty { body["nickname"] = nickname }
    let pair: TokenPair = try await request("POST", "auth/signup", body: body, auth: false)
    store(pair)
  }

  public func me() async throws -> Me { try await request("GET", "auth/me") }

  // MARK: - devices & sync

  public func registerDevice(_ d: DeviceRegistration) async throws { let _: Empty = try await request("POST", "users/devices", body: d) }
  public func syncAppUsage(_ p: AppUsagePayload) async throws -> SyncResponse { try await request("POST", "sync/app-usage", body: p) }
  public func syncLocation(_ p: LocationPayload) async throws -> SyncResponse { try await request("POST", "sync/location", body: p) }
  public func syncHealth(_ p: HealthPayload) async throws -> SyncResponse { try await request("POST", "sync/health", body: p) }

  // MARK: - messages

  public func queuedMessages() async throws -> [Message] { try await request("GET", "messages/queued") }
  public func messages(limit: Int = 50) async throws -> [Message] { try await request("GET", "messages", query: ["limit": String(limit)]) }
  public func ack(_ ids: [String], status: String = "delivered") async throws { let _: Empty = try await request("POST", "messages/ack", body: ["ids": ids, "status": status] as [String: Any]) }
  public func send(_ text: String, replyTo: String?, channel: String = "agent") async throws -> TalkbackResponse {
    var body: [String: String] = ["body": text, "channel": channel]
    if let replyTo { body["reply_to_id"] = replyTo }
    return try await request("POST", "messages", body: body)
  }
  public func budget() async throws -> Budget { try await request("GET", "messages/budget") }
  public func why(_ messageId: String) async throws -> MessageWhy { try await request("GET", "messages/\(messageId)/why") }
  /// One tap on a nudge. Three "wrong" in a week turns the rule off.
  public func feedback(_ messageId: String, verdict: String, note: String? = nil) async throws -> MessageFeedback {
    var body: [String: Any] = ["verdict": verdict]
    if let note, !note.isEmpty { body["note"] = note }
    return try await request("POST", "messages/\(messageId)/feedback", body: body)
  }
  /// Leased: send it again while the Focus or pause lasts.
  public func setQuiet(active: Bool, minutes: Int, reason: String?) async throws {
    var body: [String: Any] = ["active": active, "minutes": minutes]
    if let reason { body["reason"] = reason }
    let _: Empty = try await request("PUT", "users/quiet", body: body)
  }

  // MARK: - preferences, usage, obligations, triggers

  public func preferences() async throws -> Preferences { try await request("GET", "users/preferences") }
  public func updatePreferences(_ p: PreferencesPatch) async throws -> Preferences { try await request("PATCH", "users/preferences", body: p) }
  public func summary(daysAgo: Int = 0) async throws -> UsageSummary { try await request("GET", "usage/summary", query: ["days_ago": String(daysAgo)]) }
  public func seenApps() async throws -> [SeenApp] { try await request("GET", "usage/apps") }
  public func setLabels(_ labels: [AppLabel]) async throws { let _: Empty = try await request("PUT", "usage/apps/labels", body: AppLabelSet(labels: labels)) }
  public func upcoming(hours: Int = 72) async throws -> [Obligation] { try await request("GET", "obligations/upcoming", query: ["hours": String(hours)]) }
  public func quickAdd(_ text: String) async throws -> Obligation { try await request("POST", "obligations/quick", body: QuickAdd(text: text, timezone: TimeZone.current.identifier)) }
  public func complete(_ id: String) async throws -> Obligation { try await request("POST", "obligations/\(id)/complete") }
  public func presets() async throws -> [TriggerPreset] { try await request("GET", "triggers/presets") }
  public func triggers() async throws -> [Trigger] { try await request("GET", "triggers", query: ["include": "last_firing"]) }
  public func enablePreset(_ id: String, params: [String: Any] = [:]) async throws -> Trigger { try await request("POST", "triggers/presets/\(id)", body: params) }
  public func setTriggerEnabled(_ id: String, _ enabled: Bool) async throws -> Trigger { try await request("PATCH", "triggers/\(id)", body: ["enabled": enabled]) }
  public func deleteTrigger(_ id: String) async throws { let _: Empty = try await request("DELETE", "triggers/\(id)") }

  // MARK: - calendars

  public func calendars() async throws -> [CalendarSubscription] { try await request("GET", "calendars") }
  public func addCalendar(url: String, name: String?) async throws -> CalendarImportResponse {
    var body: [String: Any] = ["url": url]
    if let name, !name.isEmpty { body["name"] = name }
    return try await request("POST", "calendars", body: body)
  }
  public func refreshCalendar(_ id: String) async throws -> CalendarImportResponse { try await request("POST", "calendars/\(id)/refresh") }
  public func deleteCalendar(_ id: String) async throws { let _: Empty = try await request("DELETE", "calendars/\(id)") }
}

public struct Empty: Codable {
  public init() {}
}

public struct AnyEncodable: Encodable {
  private let enc: (Encoder) throws -> Void
  public init(_ value: any Encodable) { enc = { try value.encode(to: $0) } }
  public func encode(to encoder: Encoder) throws { try enc(encoder) }
}
