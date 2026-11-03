//  AppState.swift
//  The one observable the UI reads. Owns the sync loop, the message poll, and
//  a disk-backed outbox so nothing is lost when the backend is unreachable.
import Foundation
import Combine
import AppKit
import ServiceManagement
import JikoKit

@MainActor
final class AppState: ObservableObject {
  // auth / identity
  @Published var isAuthenticated = false
  @Published var me: Me?
  @Published var baseURL: String = UserDefaults.standard.string(forKey: "jiko.baseURL") ?? "http://localhost:3000"

  // status
  @Published var lastSyncAt: Date?
  @Published var lastSyncError: String?
  @Published var pendingPayloads = 0
  @Published var pausedUntil: Date?

  // content
  @Published var messages: [Message] = []
  @Published var budget: Budget?
  @Published var summary: UsageSummary?
  @Published var upcoming: [Obligation] = []
  @Published var preferences: Preferences?
  @Published var seenApps: [SeenApp] = []
  @Published var presets: [TriggerPreset] = []
  @Published var triggers: [Trigger] = []
  @Published var needsOnboarding = false
  @Published var integrations: IntegrationsResponse?
  @Published var integrationProblem: String?
  /// Set when an iMessage send failed, so Settings can explain why.
  @Published var imessageProblem: String?
  /// Mirrors SMAppService; a menu-bar agent is useless if it doesn't come back
  /// after a restart.
  @Published var launchAtLogin = SMAppService.mainApp.status == .enabled
  @Published var launchAtLoginProblem: String?
  /// Last read of the system Focus state; .unknown until the user grants access.
  @Published var focus: FocusState = .unknown

  let tracker = UsageTracker()
  private let api = JikoAPI.shared
  private var syncTimer: Timer?
  private var pollTimer: Timer?
  private let deviceId: String
  private let outboxURL: URL
  private var lastReportedQuiet = false

  static let syncInterval: TimeInterval = 60
  static let pollInterval: TimeInterval = 15

  init() {
    let defaults = UserDefaults.standard
    if let id = defaults.string(forKey: "jiko.deviceId") { deviceId = id } else { deviceId = UUID().uuidString.lowercased(); defaults.set(deviceId, forKey: "jiko.deviceId") }
    let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("Jiko", isDirectory: true)
    try? FileManager.default.createDirectory(at: support, withIntermediateDirectories: true)
    outboxURL = support.appendingPathComponent("outbox.json")
    pendingPayloads = loadOutbox().count
    Notifier.shared.setup()
    Notifier.shared.onReply = { [weak self] id, text in Task { await self?.reply(text, to: id) } }
    Task { await bootstrap() }
  }

  // MARK: - lifecycle

  func bootstrap() async {
    isAuthenticated = await api.isAuthenticated
    guard isAuthenticated else { return }
    do {
      me = try await api.me()
      try await api.registerDevice(DeviceRegistration(id: deviceId, platform: "macos", name: Host.current().localizedName))
      await refreshAll()
      // The web setup can create rules before the Mac ever signs in; the Mac step
      // (which apps are distracting) still has to happen here, so key on doomscroll.
      needsOnboarding = !UserDefaults.standard.bool(forKey: "jiko.onboarded")
        && !triggers.contains { $0.source == "preset:doomscroll" }
      startLoops()
    } catch {
      lastSyncError = error.localizedDescription
      if case APIError.unauthenticated = error { isAuthenticated = false }
    }
  }

  func startLoops() {
    syncTimer?.invalidate(); pollTimer?.invalidate()
    syncTimer = Timer.scheduledTimer(withTimeInterval: Self.syncInterval, repeats: true) { [weak self] _ in Task { await self?.syncNow() } }
    pollTimer = Timer.scheduledTimer(withTimeInterval: Self.pollInterval, repeats: true) { [weak self] _ in Task { await self?.pollMessages() } }
    Task { await syncNow(); await pollMessages() }
  }

  func signIn(phone: String, password: String, signup: Bool, nickname: String?) async throws {
    await api.setBaseURL(baseURL)
    if signup { try await api.signup(phone: phone, password: password, nickname: nickname) } else { try await api.login(phone: phone, password: password) }
    _ = try? await api.updatePreferences(PreferencesPatch(timezone: TimeZone.current.identifier))
    await bootstrap()
  }

  func signOut() async {
    syncTimer?.invalidate(); pollTimer?.invalidate()
    await api.signOut()
    isAuthenticated = false; me = nil; messages = []; budget = nil; summary = nil; triggers = []; needsOnboarding = false; integrations = nil
  }

  func updateBaseURL(_ s: String) async { baseURL = s; await api.setBaseURL(s) }

  // MARK: - sync

  func syncNow() async {
    guard isAuthenticated else { return }
    await reportQuietState()
    let logs = tracker.flush()
    var queue = loadOutbox()
    if !logs.isEmpty { queue.append(AppUsagePayload(timestamp: Date().iso, platform: "macos", device_id: deviceId, log: logs)) }
    guard !queue.isEmpty else { lastSyncAt = Date(); return }
    var remaining: [AppUsagePayload] = []
    for p in queue {
      if let until = pausedUntil, until > Date() { remaining.append(p); continue }
      do {
        let r = try await api.syncAppUsage(p)
        lastSyncError = nil
        if !r.triggered_ids.isEmpty { await pollMessages() }
      } catch {
        lastSyncError = error.localizedDescription
        if case APIError.unauthenticated = error { isAuthenticated = false; remaining.append(p); break }
        if case APIError.http(let code, _) = error, (400..<500).contains(code) { continue } // bad payload: drop
        remaining.append(p)
      }
    }
    saveOutbox(remaining)
    lastSyncAt = Date()
  }

  func pollMessages() async {
    guard isAuthenticated else { return }
    do {
      let queued = try await api.queuedMessages()
      if !queued.isEmpty {
        for m in queued { await deliver(m) }
        try await api.ack(queued.map(\.id))
      }
      let all = try await api.messages(limit: 60)
      messages = all.sorted { $0.createdDate < $1.createdDate }
      budget = try await api.budget()
      lastSyncError = nil
    } catch {
      lastSyncError = error.localizedDescription
      if case APIError.unauthenticated = error { isAuthenticated = false }
    }
  }

  /// Show a queued message the way the user asked for it. iMessage falls back
  /// to a notification rather than dropping the nudge.
  private func deliver(_ m: Message) async {
    guard m.channel == "imessage" else { Notifier.shared.show(m); return }
    guard let number = me?.phoneNumber, !number.isEmpty else {
      imessageProblem = "No phone number on your account, so this went to notifications."
      Notifier.shared.show(m)
      return
    }
    switch await IMessageSender.shared.send(m.body, to: number) {
    case .sent:
      imessageProblem = nil
    case .denied:
      imessageProblem = "Messages automation is off. System Settings > Privacy & Security > Automation > Jiko."
      Notifier.shared.show(m)
    case .notConfigured:
      imessageProblem = "Messages.app has no iMessage account signed in."
      Notifier.shared.show(m)
    case .failed(let detail):
      imessageProblem = detail
      Notifier.shared.show(m)
    }
  }

  func setDeliveryChannel(_ channel: String) async {
    if channel == "imessage" {
      let outcome = await IMessageSender.shared.requestPermission()
      if outcome == .denied {
        imessageProblem = "Messages automation is off. System Settings > Privacy & Security > Automation > Jiko."
      } else {
        imessageProblem = nil
      }
    } else {
      imessageProblem = nil
    }
    preferences = try? await api.updatePreferences(PreferencesPatch(delivery_channel: channel))
  }

  func refreshAll() async {
    async let p = api.preferences()
    async let s = api.summary()
    async let u = api.upcoming()
    async let a = api.seenApps()
    async let pr = api.presets()
    async let t = api.triggers()
    preferences = try? await p
    summary = try? await s
    upcoming = (try? await u) ?? []
    seenApps = (try? await a) ?? []
    presets = (try? await pr) ?? []
    triggers = (try? await t) ?? []
    integrations = try? await api.integrations()
    await pollMessages()
  }

  // MARK: - actions

  func reply(_ text: String, to messageId: String?) async {
    do {
      let r = try await api.send(text, replyTo: messageId)
      await pollMessages()
      if r.intent != "unknown" && r.intent != "ack" { await refreshAll() }
    } catch { lastSyncError = error.localizedDescription }
  }

  func quickAdd(_ text: String) async throws -> Obligation {
    let o = try await api.quickAdd(text)
    upcoming = (try? await api.upcoming()) ?? upcoming
    return o
  }

  func complete(_ o: Obligation) async {
    _ = try? await api.complete(o.id)
    upcoming = (try? await api.upcoming()) ?? upcoming
  }

  func setLabel(_ bundleId: String, _ label: String) async {
    try? await api.setLabels([AppLabel(bundle_id: bundleId, label: label)])
    seenApps = (try? await api.seenApps()) ?? seenApps
    summary = try? await api.summary()
  }

  func setStrictness(_ s: Double) async {
    preferences = try? await api.updatePreferences(PreferencesPatch(strictness: s))
    budget = try? await api.budget()
  }

  func setVoice(_ v: String) async { preferences = try? await api.updatePreferences(PreferencesPatch(voice: v)) }
  func setQuietHours(_ q: QuietHours) async { preferences = try? await api.updatePreferences(PreferencesPatch(quiet_hours: q)) }

  func enablePreset(_ id: String, params: [String: Any] = [:]) async {
    if triggers.isEmpty { triggers = (try? await api.triggers()) ?? [] }
    // the web setup may have turned this one on already
    guard !triggers.contains(where: { $0.source == "preset:\(id)" }) else { return }
    _ = try? await api.enablePreset(id, params: params)
    triggers = (try? await api.triggers()) ?? triggers
  }

  func setTrigger(_ t: Trigger, enabled: Bool) async {
    _ = try? await api.setTriggerEnabled(t.id, enabled)
    triggers = (try? await api.triggers()) ?? triggers
  }

  func deleteTrigger(_ t: Trigger) async {
    try? await api.deleteTrigger(t.id)
    triggers = (try? await api.triggers()) ?? triggers
  }

  /// Register or unregister the login item. Returns to the previous value if
  /// the system refuses (unsigned build, or the user denied it in Settings).
  func setLaunchAtLogin(_ on: Bool) {
    do {
      if on { try SMAppService.mainApp.register() } else { try SMAppService.mainApp.unregister() }
      launchAtLogin = SMAppService.mainApp.status == .enabled
      launchAtLoginProblem = launchAtLogin == on ? nil : "macOS has this pending in System Settings > General > Login Items."
    } catch {
      launchAtLogin = SMAppService.mainApp.status == .enabled
      launchAtLoginProblem = error.localizedDescription
    }
  }

  /// A Focus, or a manual pause, told to the server as a short lease. Renewed
  /// every sync, so if this agent stops running Jiko starts talking again.
  private func reportQuietState() async {
    focus = FocusMonitor.shared.state()
    let paused = pausedUntil.map { $0 > Date() } ?? false
    let quiet = focus.isOn || paused
    let reason = paused ? "paused" : focus.displayName.map { "focus: \($0)" } ?? "focus"
    // Lease slightly longer than the sync interval so a late sync doesn't
    // leave a gap mid-Focus.
    let lease = paused
      ? max(1, Int(ceil((pausedUntil!.timeIntervalSinceNow) / 60)))
      : Int(Self.syncInterval / 60) + 2
    if quiet == lastReportedQuiet && !quiet { return }   // nothing to renew
    lastReportedQuiet = quiet
    try? await api.setQuiet(active: quiet, minutes: lease, reason: quiet ? reason : nil)
  }

  func pause(minutes: Int) {
    pausedUntil = Date().addingTimeInterval(Double(minutes) * 60)
    Task { await reportQuietState() }
  }

  func resume() {
    pausedUntil = nil
    Task { await reportQuietState() }
  }

  /// Ask for read access to the Focus database once, from Settings.
  func enableFocusAwareness() async {
    guard FocusMonitor.shared.requestAccess() else { return }
    focus = FocusMonitor.shared.state()
    await reportQuietState()
  }

  func disableFocusAwareness() {
    FocusMonitor.shared.forgetAccess()
    focus = .unknown
  }

  // MARK: - connected accounts

  func refreshIntegrations() async {
    integrations = try? await api.integrations()
  }

  /// Opens Google's consent page in the browser, then watches for the account to
  /// appear (Google redirects to the server, not back to this app).
  func connectGoogle() async {
    integrationProblem = nil
    do {
      let before = integrations?.connected("google")?.last_synced_at
      NSWorkspace.shared.open(try await api.googleConnectURL())
      for _ in 0..<60 {
        try await Task.sleep(for: .seconds(3))
        await refreshIntegrations()
        if let g = integrations?.connected("google"), !g.needsReconnect, g.last_synced_at != nil, g.last_synced_at != before {
          upcoming = (try? await api.upcoming()) ?? upcoming
          return
        }
      }
    } catch { integrationProblem = error.localizedDescription }
  }

  func connectCanvas(baseURL: String, token: String) async -> Bool {
    integrationProblem = nil
    do {
      let r = try await api.connectCanvas(baseURL: baseURL, token: token)
      if r.sync.status != "ok" { integrationProblem = r.sync.error ?? "Connected, but the first sync failed." }
      await refreshIntegrations()
      upcoming = (try? await api.upcoming()) ?? upcoming
      return true
    } catch {
      integrationProblem = Self.serverMessage(error)
      return false
    }
  }

  func syncIntegration(_ provider: String) async {
    integrationProblem = nil
    do {
      let r = try await api.syncIntegration(provider)
      if let e = r.sync.error { integrationProblem = e }
    } catch { integrationProblem = Self.serverMessage(error) }
    await refreshIntegrations()
    upcoming = (try? await api.upcoming()) ?? upcoming
  }

  func disconnectIntegration(_ provider: String) async {
    do { try await api.disconnectIntegration(provider) } catch { integrationProblem = Self.serverMessage(error) }
    await refreshIntegrations()
  }

  /// The server's own sentence ("Canvas rejected that token...") rather than "400: ...".
  static func serverMessage(_ error: Error) -> String {
    if case APIError.http(_, let msg) = error, !msg.isEmpty { return msg }
    return error.localizedDescription
  }

  func finishOnboarding() { UserDefaults.standard.set(true, forKey: "jiko.onboarded"); needsOnboarding = false }

  // MARK: - outbox

  private func loadOutbox() -> [AppUsagePayload] {
    guard let data = try? Data(contentsOf: outboxURL) else { return [] }
    return (try? JSONDecoder().decode([AppUsagePayload].self, from: data)) ?? []
  }
  private func saveOutbox(_ q: [AppUsagePayload]) {
    // cap so a week offline doesn't become a 50MB file: keep the most recent 500 payloads
    let trimmed = Array(q.suffix(500))
    if trimmed.isEmpty { try? FileManager.default.removeItem(at: outboxURL) } else { try? JSONEncoder().encode(trimmed).write(to: outboxURL, options: .atomic) }
    pendingPayloads = trimmed.count
  }
}
