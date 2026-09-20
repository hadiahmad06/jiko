//  UsageTracker.swift
//  Turns NSWorkspace activation events into foreground sessions per app.
//  Sleep, lock, and screensaver close the current session; the next activation
//  opens a new one. `flush()` closes and immediately reopens the live session so
//  long sessions report incrementally (every sync interval).
import AppKit
import Combine
import JikoKit

final class UsageTracker: ObservableObject {
  @Published private(set) var currentApp: NSRunningApplication?
  @Published private(set) var currentSessionStart: Date?
  @Published private(set) var todaySeconds: [String: Double] = [:]   // bundle id -> seconds since launch (display only)

  private var pending: [AppUsageLog] = []
  private var paused = false
  private let ownBundle = Bundle.main.bundleIdentifier ?? ""

  init() {
    let nc = NSWorkspace.shared.notificationCenter
    nc.addObserver(self, selector: #selector(activated(_:)), name: NSWorkspace.didActivateApplicationNotification, object: nil)
    nc.addObserver(self, selector: #selector(interrupted), name: NSWorkspace.willSleepNotification, object: nil)
    nc.addObserver(self, selector: #selector(interrupted), name: NSWorkspace.screensDidSleepNotification, object: nil)
    nc.addObserver(self, selector: #selector(interrupted), name: NSWorkspace.sessionDidResignActiveNotification, object: nil)
    nc.addObserver(self, selector: #selector(resumed), name: NSWorkspace.didWakeNotification, object: nil)
    nc.addObserver(self, selector: #selector(resumed), name: NSWorkspace.screensDidWakeNotification, object: nil)
    nc.addObserver(self, selector: #selector(resumed), name: NSWorkspace.sessionDidBecomeActiveNotification, object: nil)
    DistributedNotificationCenter.default().addObserver(self, selector: #selector(interrupted), name: Notification.Name("com.apple.screenIsLocked"), object: nil)
    DistributedNotificationCenter.default().addObserver(self, selector: #selector(resumed), name: Notification.Name("com.apple.screenIsUnlocked"), object: nil)
    if let front = NSWorkspace.shared.frontmostApplication { open(front) }
  }

  @objc private func activated(_ n: Notification) {
    guard let app = n.userInfo?[NSWorkspace.applicationUserInfoKey] as? NSRunningApplication else { return }
    closeCurrent()
    if !paused { open(app) }
  }

  @objc private func interrupted() { closeCurrent(); paused = true }
  @objc private func resumed() { paused = false; if let front = NSWorkspace.shared.frontmostApplication { open(front) } }

  private func open(_ app: NSRunningApplication) {
    guard app.bundleIdentifier != ownBundle else { currentApp = nil; currentSessionStart = nil; return }
    currentApp = app
    currentSessionStart = Date()
  }

  private func closeCurrent(at end: Date = Date()) {
    guard let app = currentApp, let start = currentSessionStart else { return }
    let dur = end.timeIntervalSince(start)
    if dur >= 1, let bid = app.bundleIdentifier {
      pending.append(AppUsageLog(bundleId: bid, timestamp: end.iso, appName: app.localizedName ?? bid, startTime: start.iso, durationSeconds: dur, category: nil, isForeground: true, windowTitle: nil))
      todaySeconds[bid, default: 0] += dur
    }
    currentSessionStart = nil
  }

  /// Returns everything accumulated and restarts the live session from now.
  func flush() -> [AppUsageLog] {
    let now = Date()
    closeCurrent(at: now)
    if let app = currentApp, !paused { currentApp = app; currentSessionStart = now }
    let out = pending
    pending.removeAll()
    return out
  }

  func resetDay() { todaySeconds = [:] }
}
