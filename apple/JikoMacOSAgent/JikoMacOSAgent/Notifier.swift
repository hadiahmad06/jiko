//  Notifier.swift
//  Native notifications with an inline reply box, so talking back to Jiko never
//  requires opening a window.
import Foundation
import UserNotifications

@MainActor
final class Notifier: NSObject, UNUserNotificationCenterDelegate {
  static let shared = Notifier()
  static let category = "JIKO_MESSAGE"
  var onReply: ((_ messageId: String, _ text: String) -> Void)?

  func setup() {
    let center = UNUserNotificationCenter.current()
    center.delegate = self
    let reply = UNTextInputNotificationAction(identifier: "REPLY", title: "Reply", options: [], textInputButtonTitle: "Send", textInputPlaceholder: "snooze 20 / done / ok")
    let snooze = UNNotificationAction(identifier: "SNOOZE", title: "Snooze 30 min", options: [])
    center.setNotificationCategories([UNNotificationCategory(identifier: Self.category, actions: [reply, snooze], intentIdentifiers: [], options: [])])
    center.requestAuthorization(options: [.alert, .sound]) { _, _ in }
  }

  func show(_ m: Message) {
    let content = UNMutableNotificationContent()
    content.title = "Jiko"
    content.body = m.body
    content.sound = .default
    content.categoryIdentifier = Self.category
    content.userInfo = ["message_id": m.id]
    content.threadIdentifier = "jiko"
    UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: m.id, content: content, trigger: nil))
  }

  nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
    [.banner, .sound, .list]
  }

  nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse) async {
    let id = response.notification.request.content.userInfo["message_id"] as? String ?? ""
    let text: String?
    switch response.actionIdentifier {
    case "REPLY": text = (response as? UNTextInputNotificationResponse)?.userText
    case "SNOOZE": text = "snooze 30"
    default: text = nil
    }
    if let text, !text.isEmpty {
      await MainActor.run { self.onReply?(id, text) }
    }
  }
}
