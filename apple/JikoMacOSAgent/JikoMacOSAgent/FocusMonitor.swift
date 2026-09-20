//  FocusMonitor.swift
//  Whether a macOS Focus is on. There is no public API for this, so Jiko reads
//  the Focus database the system writes to the user's Library — which, from a
//  sandboxed app, means the user has to hand it over once through an open
//  panel. The resulting security-scoped bookmark is kept in UserDefaults.
//
//  If the user never grants it (or the OS version keeps its Focus state
//  somewhere unreadable), `state` is .unknown and the agent falls back to the
//  manual pause. Nothing else in the app depends on this working.
import Foundation
import AppKit

enum FocusState: Equatable {
  case unknown            // no access, or nothing readable
  case off
  case on(name: String?)

  var isOn: Bool { if case .on = self { return true }; return false }
  var displayName: String? { if case .on(let n) = self { return n }; return nil }
}

final class FocusMonitor {
  static let shared = FocusMonitor()

  private let bookmarkKey = "jiko.focusBookmark"
  private let dbPath = "Library/DoNotDisturb/DB"

  /// The folder the system keeps Focus state in, for the open panel's default.
  var defaultDirectory: URL {
    FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent(dbPath, isDirectory: true)
  }

  var hasAccess: Bool { UserDefaults.standard.data(forKey: bookmarkKey) != nil }

  /// Ask once, at a moment the user expects it. Returns true if they granted it.
  @MainActor
  func requestAccess() -> Bool {
    let panel = NSOpenPanel()
    panel.message = "Pick the DoNotDisturb folder so Jiko can tell when a Focus is on."
    panel.prompt = "Allow"
    panel.canChooseFiles = false
    panel.canChooseDirectories = true
    panel.allowsMultipleSelection = false
    panel.directoryURL = defaultDirectory
    guard panel.runModal() == .OK, let url = panel.url else { return false }
    guard let bookmark = try? url.bookmarkData(options: .withSecurityScope, includingResourceValuesForKeys: nil, relativeTo: nil) else { return false }
    UserDefaults.standard.set(bookmark, forKey: bookmarkKey)
    return true
  }

  func forgetAccess() { UserDefaults.standard.removeObject(forKey: bookmarkKey) }

  /// Current Focus state. Cheap enough to call once a minute.
  func state() -> FocusState {
    guard let data = UserDefaults.standard.data(forKey: bookmarkKey) else { return .unknown }
    var stale = false
    guard let dir = try? URL(resolvingBookmarkData: data, options: .withSecurityScope, relativeTo: nil, bookmarkDataIsStale: &stale) else {
      return .unknown
    }
    guard dir.startAccessingSecurityScopedResource() else { return .unknown }
    defer { dir.stopAccessingSecurityScopedResource() }

    // Assertions.json is written while a Focus is on and emptied when it ends.
    let assertions = dir.appendingPathComponent("Assertions.json")
    guard let json = try? Data(contentsOf: assertions) else { return .unknown }
    return Self.parseAssertions(json)
  }

  /// `{"data":[{"storeAssertionRecords":[{"assertionDetails":{"assertionDetailsModeIdentifier":"com.apple.focus.work"}}]}]}`
  static func parseAssertions(_ data: Data) -> FocusState {
    guard let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
          let entries = root["data"] as? [[String: Any]] else { return .unknown }
    for entry in entries {
      guard let records = entry["storeAssertionRecords"] as? [[String: Any]], !records.isEmpty else { continue }
      let details = records.first?["assertionDetails"] as? [String: Any]
      let identifier = details?["assertionDetailsModeIdentifier"] as? String
      return .on(name: identifier.map(Self.prettyName))
    }
    return .off
  }

  /// "com.apple.focus.work" -> "Work", "com.apple.donotdisturb.mode.default" -> "Do Not Disturb".
  static func prettyName(_ identifier: String) -> String {
    if identifier.contains("donotdisturb") { return "Do Not Disturb" }
    let last = identifier.split(separator: ".").last.map(String.init) ?? identifier
    return last.prefix(1).uppercased() + last.dropFirst()
  }
}
