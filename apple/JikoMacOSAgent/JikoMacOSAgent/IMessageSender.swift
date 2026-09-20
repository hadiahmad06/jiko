//  IMessageSender.swift
//  Sends a queued message to the user's own number through Messages.app, so a
//  nudge lands in the same thread list as every other text they get.
//
//  Needs Automation permission for Messages (System Settings > Privacy &
//  Security > Automation). The first send is what triggers the prompt; until
//  the user allows it, `send` returns .denied and the caller falls back to a
//  notification.
import Foundation
import AppKit
import JikoKit

enum IMessageResult: Equatable {
  case sent
  case denied            // user said no, or hasn't answered the Automation prompt
  case notConfigured     // Messages.app has no iMessage account signed in
  case failed(String)
}

final class IMessageSender {
  static let shared = IMessageSender()

  /// NSAppleScript is not thread-safe; every compile/execute goes through here.
  private let queue = DispatchQueue(label: "com.jiko.imessage")

  /// AppleScript string literals escape backslash and double quote, nothing else.
  static func escape(_ s: String) -> String {
    s.replacingOccurrences(of: "\\", with: "\\\\")
      .replacingOccurrences(of: "\"", with: "\\\"")
  }

  static func script(body: String, recipient: String) -> String {
    """
    tell application "Messages"
      set svc to 1st account whose service type = iMessage
      set buddy to participant "\(escape(recipient))" of svc
      send "\(escape(body))" to buddy
    end tell
    """
  }

  func send(_ body: String, to recipient: String) async -> IMessageResult {
    let source = Self.script(body: body, recipient: recipient)
    return await withCheckedContinuation { continuation in
      queue.async {
        var error: NSDictionary?
        guard let script = NSAppleScript(source: source) else {
          continuation.resume(returning: .failed("could not compile the script"))
          return
        }
        script.executeAndReturnError(&error)
        guard let error else { continuation.resume(returning: .sent); return }
        let code = (error[NSAppleScript.errorNumber] as? Int) ?? 0
        let message = (error[NSAppleScript.errorMessage] as? String) ?? "unknown AppleScript error"
        switch code {
        case -1743, -1744:            // not authorised to send Apple events
          continuation.resume(returning: .denied)
        case -1728:                   // "can't get account 1 whose service type = iMessage"
          continuation.resume(returning: .notConfigured)
        default:
          continuation.resume(returning: .failed("\(code): \(message)"))
        }
      }
    }
  }

  /// Whether Messages.app is installed at all; cheap pre-flight for onboarding.
  var messagesAppAvailable: Bool {
    NSWorkspace.shared.urlForApplication(withBundleIdentifier: "com.apple.MobileSMS") != nil
  }

  /// Ask for Automation permission without sending anything, so onboarding can
  /// trigger the prompt at a moment the user expects it.
  func requestPermission() async -> IMessageResult {
    let source = """
    tell application "Messages"
      get name
    end tell
    """
    return await withCheckedContinuation { continuation in
      queue.async {
        var error: NSDictionary?
        guard let script = NSAppleScript(source: source) else {
          continuation.resume(returning: .failed("could not compile the script"))
          return
        }
        script.executeAndReturnError(&error)
        guard let error else { continuation.resume(returning: .sent); return }
        let code = (error[NSAppleScript.errorNumber] as? Int) ?? 0
        continuation.resume(returning: code == -1743 || code == -1744 ? .denied : .sent)
      }
    }
  }
}
