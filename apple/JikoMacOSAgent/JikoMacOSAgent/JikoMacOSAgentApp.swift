//
//  JikoMacOSAgentApp.swift
//  JikoMacOSAgent
//
//  Created by Hadi Ahmad on 10/15/25.
//

import SwiftUI

@main
struct JikoMacOSAgentApp: App {
//  @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
  @StateObject var observer = AppSwitchObserver()

  var body: some Scene {
    MenuBarExtra("Jiko", systemImage: "apple.meditate") {
      JikoMenu()
        .environmentObject(observer)
    }
  }
}
