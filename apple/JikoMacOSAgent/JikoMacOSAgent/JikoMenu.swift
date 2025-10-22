//
//  ContentView.swift
//  JikoMacOSAgent
//
//  Created by Hadi Ahmad on 10/15/25.
//

import SwiftUI
import Cocoa

struct JikoMenu: View {
  @EnvironmentObject var observer: AppSwitchObserver
  
  var body: some View {
    VStack(alignment: .leading, spacing: 5) {
      
      // Status
      HStack {
        Text("Jiko is running!")
          .bold()
          .foregroundColor(.green)
        Image(systemName: "apple.meditate")
          .resizable()
          .frame(width: 18, height: 18)
          .foregroundColor(.green)
      }
      
      // Version / Build
      if let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String,
         let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String {
        Text("Version \(version) (Build \(build))")
      } else {
        Text("Version ? (Build ?)")
      }
      
      Divider()
      
      Text("Active: \(observer.currentApp?.localizedName ?? "N/A")")
        .bold()
      Text("Screen Time: N/A")
        .bold()
      
      Divider()
      
      Button("Quit") {
        NSApp.terminate(nil)
      }
      .keyboardShortcut(.init("q"), modifiers: .command)
      .padding(.top, 4)
    }
    .padding(8)
  }
}

#Preview {
  VStack {
      Text("Previewing MenuBarExtra contents")
      Divider()
      JikoMenu()
          .environmentObject(AppSwitchObserver())
          .buttonStyle(.accessoryBar)
  }
  .frame(width: 200)
  .padding()
}
