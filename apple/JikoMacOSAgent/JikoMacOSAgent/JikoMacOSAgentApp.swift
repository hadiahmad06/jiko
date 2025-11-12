//
//  JikoMacOSAgentApp.swift
//  JikoMacOSAgent
//
//  Created by Hadi Ahmad on 10/15/25.
//

import SwiftUI
import JikoSync

@main
struct JikoMacOSAgentApp: App {
//  @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
  @StateObject var observer = AppSwitchObserver()
  
  // Start the agent on launch
  init() {
    JikoSyncManager.shared().startSyncing()
    JikoSyncManager.shared().onEventSynced = { event in
      print("Synced event: \(event.appIdentifier) at \(event.timestamp)")
    }
  }

  var body: some Scene {
    MenuBarExtra("Jiko", systemImage: "apple.meditate") {
      JikoMenu()
        .environmentObject(observer)
    }
  }
}
