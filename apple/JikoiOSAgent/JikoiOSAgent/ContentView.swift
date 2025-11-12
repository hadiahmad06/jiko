//
//  ContentView.swift
//  JikoiOSAgent
//
//  Created by Hadi Ahmad on 10/18/25.
//

import SwiftUI
import JikoSync

struct ContentView: View {
  @State private var batteryLevel: Float = 0.0
  @State private var isCharging: Bool = false
  
  var body: some View {
    VStack(spacing: 20) {
      Text("JikoiOSAgent Running")
        .font(.title)
        .padding()
      
      Text("Battery Level: \(Int(batteryLevel * 100))%")
      Text("Charging: \(isCharging ? "Yes" : "No")")
      
      Button("Update Environment") {
        let env = JikoSyncManager.shared().currentEnvironmentSnapshot()
        batteryLevel = Float(env.batteryLevel)
        isCharging = env.isCharging
      }
      
      Button("Log Test Event") {
        let event = JikoSyncEvent(appIdentifier: "com.example.test", type: .custom, metadata: ["note": "Test event"])
        JikoSyncManager.shared().logEvent(event)
      }
    }
    .padding()
  }
}

struct ContentView_Previews: PreviewProvider {
  static var previews: some View {
    ContentView()
  }
}
