//
//  JikoMacOSAgentApp.swift
//  JikoMacOSAgent
//
//  Created by Hadi Ahmad on 10/15/25.
//

import SwiftUI

@main
struct JikoMacOSAgentApp: App {
  @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

  var body: some Scene {
    Settings {
      EmptyView() // optional settings window
    }
  }
}
