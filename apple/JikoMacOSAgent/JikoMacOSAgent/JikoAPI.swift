//  JikoAPI.swift
//  One client for the backend. Bearer auth, refresh-on-401, typed errors.
import Foundation

enum APIError: LocalizedError {
  case http(Int, String)
  case unauthenticated
  case transport(Error)
  case decoding(Error)
  case notSent(String)

  var errorDescription: String? {
    switch self {
    case .http(let code, let msg): return "\(code): \(msg)"
    case .unauthenticated: return "Not signed in"
    case .transport(let e): return e.localizedDescription
    case .decoding(let e): return "Bad response: \(e.localizedDescription)"
    case .notSent(let why): return why
    }
  }
}

actor JikoAPI {
  static let shared = JikoAPI()

  private let session: URLSession
  private(set) var baseURL: URL
  private var accessToken: String?
  private var refreshToken: String?

  init() {
    let cfg = URLSessionConfiguration.default
    cfg.timeoutIntervalForRequest = 15
    cfg.waitsForConnectivity = false
    session = URLSession(configuration: cfg)
    baseURL = URL(string: UserDefaults.standard.string(forKey: "jiko.baseURL") ?? "http://localhost:3000")!
    accessToken = Keychain.get("access")
    refreshToken = Keychain.get("refresh")
  }

  var isAuthenticated: Bool { accessToken != nil }

  func setBaseURL(_ s: String) {
    guard let u = URL(string: s.trimmingCharacters(in: .whitespaces)) else { return }
    baseURL = u
    UserDefaults.standard.set(u.absoluteString, forKey: "jiko.baseURL")
  }

  func signOut() {
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

    let (data, resp): (Data, URLResponse)
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
  static func encodeBody(_ body: Any) throws -> Data {
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

  func login(phone: String, password: String) async throws {
    let pair: TokenPair = try await request("POST", "auth/login", body: ["phone_number": phone, "password": password], auth: false)
    store(pair)
  }

  func signup(phone: String, password: String, nickname: String?) async throws {
    var body: [String: String] = ["phone_number": phone, "password": password]
    if let nickname, !nickname.isEmpty { body["nickname"] = nickname }
    let pair: TokenPair = try await request("POST", "auth/signup", body: body, auth: false)
    store(pair)
  }

  func me() async throws -> Me { try await request("GET", "auth/me") }

  // MARK: - devices & sync

  func registerDevice(_ d: DeviceRegistration) async throws { let _: Empty = try await request("POST", "users/devices", body: d) }
  func syncAppUsage(_ p: AppUsagePayload) async throws -> SyncResponse { try await request("POST", "sync/app-usage", body: p) }

  // MARK: - messages

  func queuedMessages() async throws -> [Message] { try await request("GET", "messages/queued") }
  func messages(limit: Int = 50) async throws -> [Message] { try await request("GET", "messages", query: ["limit": String(limit)]) }
  func ack(_ ids: [String], status: String = "delivered") async throws { let _: Empty = try await request("POST", "messages/ack", body: ["ids": ids, "status": status] as [String: Any]) }
  func send(_ text: String, replyTo: String?) async throws -> TalkbackResponse {
    var body: [String: String] = ["body": text, "channel": "agent"]
    if let replyTo { body["reply_to_id"] = replyTo }
    return try await request("POST", "messages", body: body)
  }
  func budget() async throws -> Budget { try await request("GET", "messages/budget") }

  // MARK: - preferences, usage, obligations, triggers

  func preferences() async throws -> Preferences { try await request("GET", "users/preferences") }
  func updatePreferences(_ p: PreferencesPatch) async throws -> Preferences { try await request("PATCH", "users/preferences", body: p) }
  func summary(daysAgo: Int = 0) async throws -> UsageSummary { try await request("GET", "usage/summary", query: ["days_ago": String(daysAgo)]) }
  func seenApps() async throws -> [SeenApp] { try await request("GET", "usage/apps") }
  func setLabels(_ labels: [AppLabel]) async throws { let _: Empty = try await request("PUT", "usage/apps/labels", body: AppLabelSet(labels: labels)) }
  func upcoming(hours: Int = 72) async throws -> [Obligation] { try await request("GET", "obligations/upcoming", query: ["hours": String(hours)]) }
  func quickAdd(_ text: String) async throws -> Obligation { try await request("POST", "obligations/quick", body: QuickAdd(text: text, timezone: TimeZone.current.identifier)) }
  func complete(_ id: String) async throws -> Obligation { try await request("POST", "obligations/\(id)/complete") }
  func presets() async throws -> [TriggerPreset] { try await request("GET", "triggers/presets") }
  func triggers() async throws -> [Trigger] { try await request("GET", "triggers") }
  func enablePreset(_ id: String, params: [String: Any] = [:]) async throws -> Trigger { try await request("POST", "triggers/presets/\(id)", body: params) }
  func setTriggerEnabled(_ id: String, _ enabled: Bool) async throws -> Trigger { try await request("PATCH", "triggers/\(id)", body: ["enabled": enabled]) }
  func deleteTrigger(_ id: String) async throws { let _: Empty = try await request("DELETE", "triggers/\(id)") }
}

struct Empty: Codable {}

struct AnyEncodable: Encodable {
  private let enc: (Encoder) throws -> Void
  init(_ value: any Encodable) { enc = { try value.encode(to: $0) } }
  func encode(to encoder: Encoder) throws { try enc(encoder) }
}
