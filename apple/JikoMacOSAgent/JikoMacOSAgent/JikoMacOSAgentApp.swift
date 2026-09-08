//  JikoMacOSAgentApp.swift
//  Menu-bar agent. Tracks foreground app time, syncs it, shows Jiko's messages
//  as notifications you can reply to, and hosts a small window for the rest.
import SwiftUI

@main
struct JikoMacOSAgentApp: App {
  @StateObject private var state = AppState()

  var body: some Scene {
    MenuBarExtra {
      MenuView().environmentObject(state)
    } label: {
      Image(systemName: state.isAuthenticated ? (state.lastSyncError == nil ? "apple.meditate" : "exclamationmark.triangle") : "apple.meditate.circle")
    }
    .menuBarExtraStyle(.window)

    Window("Jiko", id: "main") {
      MainWindow().environmentObject(state)
    }
    .windowResizability(.contentSize)
    .defaultSize(width: 560, height: 520)
  }
}
