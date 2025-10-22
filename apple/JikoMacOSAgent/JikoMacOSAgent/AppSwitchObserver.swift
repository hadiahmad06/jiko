//
//  Untitled.swift
//  JikoMacOSAgent
//
//  Created by Hadi Ahmad on 10/15/25.
//

import Foundation
import AppKit

class AppSwitchObserver: ObservableObject {
  @Published var currentApp: NSRunningApplication? = nil
  
  init() {
    NSWorkspace.shared.notificationCenter.addObserver(
      self,
      selector: #selector(handleAppActivation),
      name: NSWorkspace.didActivateApplicationNotification,
      object: nil
    )
  }
  
  @objc func handleAppActivation(notification: Notification) {
    guard let userInfo = notification.userInfo,
          let app = userInfo[NSWorkspace.applicationUserInfoKey] as? NSRunningApplication else {
      return
    }
    currentApp = app
    print("Activated: \(app.localizedName ?? "Unknown") \(app.bundleIdentifier ?? "no ID")")
  }
}
