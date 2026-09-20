//  JikoiOSAgentApp.swift
//  The iOS half of Jiko: location and health in, nudges out. Pure Swift on top
//  of the shared JikoKit package.
import SwiftUI

@main
struct JikoiOSAgentApp: App {
  @StateObject private var state = AppState()
  @Environment(\.scenePhase) private var scenePhase

  var body: some Scene {
    WindowGroup {
      ContentView()
        .environmentObject(state)
    }
    .onChange(of: scenePhase) { _, phase in
      if phase == .active { Task { await state.refreshOnForeground() } }
    }
  }
}
