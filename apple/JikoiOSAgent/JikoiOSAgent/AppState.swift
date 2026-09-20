//  AppState.swift
//  The iOS agent's one observable. Sends location and health to the backend,
//  pulls queued messages, and lets the user reply. No app-usage tracking yet:
//  that needs the FamilyControls entitlement (applied for, not granted).
import Foundation
import Combine
import CoreLocation
import UIKit
import JikoKit

@MainActor
final class AppState: ObservableObject {
  @Published var isAuthenticated = false
  @Published var me: Me?
  @Published var baseURL: String = UserDefaults.standard.string(forKey: "jiko.baseURL") ?? "http://localhost:3000"

  @Published var messages: [Message] = []
  @Published var budget: Budget?
  @Published var upcoming: [Obligation] = []

  @Published var lastSyncAt: Date?
  @Published var lastSyncError: String?
  @Published var lastLocationAt: Date?
  @Published var lastHealthAt: Date?

  let location = LocationTracker()
  let health = HealthTracker()

  private let api = JikoAPI.shared
  private let deviceId: String
  private var pollTimer: Timer?
  private var healthTimer: Timer?

  static let pollInterval: TimeInterval = 30
  static let healthInterval: TimeInterval = 3600

  init() {
    let defaults = UserDefaults.standard
    if let id = defaults.string(forKey: "jiko.deviceId") {
      deviceId = id
    } else {
      deviceId = UUID().uuidString.lowercased()
      defaults.set(deviceId, forKey: "jiko.deviceId")
    }
    Notifier.shared.setup()
    Notifier.shared.onReply = { [weak self] id, text in Task { await self?.reply(text, to: id) } }
    location.onFix = { [weak self] fix in Task { await self?.sendLocation(fix) } }
    Task { await bootstrap() }
  }

  // MARK: - lifecycle

  func bootstrap() async {
    isAuthenticated = await api.isAuthenticated
    guard isAuthenticated else { return }
    do {
      me = try await api.me()
      try await api.registerDevice(DeviceRegistration(id: deviceId, platform: "ios", name: await UIDevice.current.name))
      startLoops()
      await refreshAll()
    } catch {
      lastSyncError = error.localizedDescription
      if case APIError.unauthenticated = error { isAuthenticated = false }
    }
  }

  func startLoops() {
    pollTimer?.invalidate(); healthTimer?.invalidate()
    pollTimer = Timer.scheduledTimer(withTimeInterval: Self.pollInterval, repeats: true) { [weak self] _ in
      Task { await self?.pollMessages() }
    }
    healthTimer = Timer.scheduledTimer(withTimeInterval: Self.healthInterval, repeats: true) { [weak self] _ in
      Task { await self?.syncHealth() }
    }
    if location.isAuthorized { location.start() }
    Task { await syncHealth(); await pollMessages() }
  }

  func signIn(phone: String, password: String, signup: Bool, nickname: String?) async throws {
    await api.setBaseURL(baseURL)
    if signup {
      try await api.signup(phone: phone, password: password, nickname: nickname)
    } else {
      try await api.login(phone: phone, password: password)
    }
    _ = try? await api.updatePreferences(PreferencesPatch(timezone: TimeZone.current.identifier))
    await bootstrap()
  }

  func signOut() async {
    pollTimer?.invalidate(); healthTimer?.invalidate()
    location.stop()
    await api.signOut()
    isAuthenticated = false; me = nil; messages = []; budget = nil; upcoming = []
  }

  func updateBaseURL(_ s: String) async { baseURL = s; await api.setBaseURL(s) }

  // MARK: - sync

  private func sendLocation(_ fix: CLLocation) async {
    guard isAuthenticated else { return }
    let payload = LocationPayload(
      timestamp: fix.timestamp.iso,
      platform: "ios",
      device_id: deviceId,
      latitude: fix.coordinate.latitude,
      longitude: fix.coordinate.longitude,
      // The backend's `radius` is GPS accuracy, not a geofence.
      radius: max(0, fix.horizontalAccuracy),
      altitude: fix.verticalAccuracy >= 0 ? fix.altitude : nil
    )
    do {
      let r = try await api.syncLocation(payload)
      lastLocationAt = Date(); lastSyncError = nil
      if !r.triggered_ids.isEmpty { await pollMessages() }
    } catch {
      lastSyncError = error.localizedDescription
      if case APIError.unauthenticated = error { isAuthenticated = false }
    }
  }

  func syncHealth() async {
    guard isAuthenticated, let log = await health.sample() else { return }
    do {
      let r = try await api.syncHealth(HealthPayload(timestamp: Date().iso, platform: "ios", device_id: deviceId, log: [log]))
      lastHealthAt = Date(); lastSyncError = nil
      if !r.triggered_ids.isEmpty { await pollMessages() }
    } catch {
      lastSyncError = error.localizedDescription
      if case APIError.unauthenticated = error { isAuthenticated = false }
    }
  }

  func pollMessages() async {
    guard isAuthenticated else { return }
    do {
      let queued = try await api.queuedMessages()
      if !queued.isEmpty {
        for m in queued { Notifier.shared.show(m) }
        try await api.ack(queued.map(\.id))
      }
      messages = try await api.messages(limit: 60).sorted { $0.createdDate < $1.createdDate }
      budget = try await api.budget()
      lastSyncAt = Date(); lastSyncError = nil
    } catch {
      lastSyncError = error.localizedDescription
      if case APIError.unauthenticated = error { isAuthenticated = false }
    }
  }

  func refreshAll() async {
    upcoming = (try? await api.upcoming()) ?? []
    await pollMessages()
  }

  // MARK: - actions

  func reply(_ text: String, to messageId: String?) async {
    do {
      _ = try await api.send(text, replyTo: messageId)
      await pollMessages()
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

  func enableLocation() {
    location.requestAccess()
  }

  func enableHealth() async {
    await health.requestAccess()
    await syncHealth()
  }

  /// Called when the app comes back to the foreground.
  func refreshOnForeground() async {
    guard isAuthenticated else { return }
    await pollMessages()
    if let last = health.lastRead, Date().timeIntervalSince(last) < Self.healthInterval { return }
    await syncHealth()
  }
}
