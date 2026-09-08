//
//  JikoiOSAgentApp.swift
//  JikoiOSAgent
//
//  Created by Hadi Ahmad on 10/18/25.
//

import SwiftUI
import JikoSync

@main
struct JikoiOSAgentApp: App {
  
  // Start the agent on launch
  init() {
    JikoSyncManager.shared().startSyncing()
    JikoSyncManager.shared().onEventSynced = { event in
      print("Synced event: \(event.appIdentifier) at \(event.timestamp)")
    }
  }
  
  var body: some Scene {
    WindowGroup {
      ContentView()
    }
  }
}
