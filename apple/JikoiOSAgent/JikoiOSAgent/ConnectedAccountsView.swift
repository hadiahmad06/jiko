//  ConnectedAccountsView.swift
//  Google (Gmail + Calendar) and Canvas, inside the Settings form. Google opens
//  Safari; when the app comes back to the foreground it re-reads the list.
import SwiftUI
import JikoKit

struct ConnectedAccountsView: View {
  @EnvironmentObject var state: AppState
  @Environment(\.openURL) private var openURL
  @Environment(\.scenePhase) private var scenePhase
  @State private var canvasURL = ""
  @State private var canvasToken = ""
  @State private var busy = false

  var body: some View {
    let info = state.integrations
    Group {
      google(info)
      canvas(info)
      if let p = state.integrationProblem { Text(p).font(.caption).foregroundStyle(.orange) }
    }
    .disabled(busy)
    .task { await state.refreshIntegrations() }
    .onChange(of: scenePhase) { _, phase in
      if phase == .active { Task { await state.refreshIntegrations() } }
    }
  }

  @ViewBuilder private func google(_ info: IntegrationsResponse?) -> some View {
    let g = info?.connected("google")
    VStack(alignment: .leading, spacing: 4) {
      LabeledContent("Google") { status(g) }
      Text("Calendar, and emails that mention an interview, deadline or appointment with a date.")
        .font(.caption).foregroundStyle(.secondary)
    }
    if info?.available.google == false {
      Text("Google sign-in isn't switched on for this server yet.").font(.caption).foregroundStyle(.secondary)
    } else if let g, !g.needsReconnect {
      Button("Sync Google now") { run { await state.syncIntegration("google") } }
      Button("Disconnect Google", role: .destructive) { run { await state.disconnectIntegration("google") } }
    } else {
      Button(g == nil ? "Connect Google" : "Reconnect Google") {
        run { if let url = await state.googleConnectURL() { openURL(url) } }
      }
    }
  }

  @ViewBuilder private func canvas(_ info: IntegrationsResponse?) -> some View {
    let c = info?.connected("canvas")
    VStack(alignment: .leading, spacing: 4) {
      LabeledContent("Canvas") { status(c) }
      Text("Assignments and due dates; submitted work is marked done.").font(.caption).foregroundStyle(.secondary)
    }
    if let c, !c.needsReconnect {
      Button("Sync Canvas now") { run { await state.syncIntegration("canvas") } }
      Button("Disconnect Canvas", role: .destructive) { run { await state.disconnectIntegration("canvas") } }
    } else if info?.available.canvas != false {
      TextField("canvas.yourschool.edu", text: $canvasURL)
        .textInputAutocapitalization(.never).autocorrectionDisabled().keyboardType(.URL)
      SecureField("Canvas access token", text: $canvasToken)
      DisclosureGroup("How to get a token") {
        Text("In Canvas on the web: Account → Settings → Approved Integrations → + New Access Token. Purpose \"Jiko\", then Generate Token and paste it here.")
          .font(.caption).foregroundStyle(.secondary)
      }
      Button("Connect Canvas") {
        run { if await state.connectCanvas(baseURL: canvasURL, token: canvasToken) { canvasToken = "" } }
      }
      .disabled(canvasURL.isEmpty || canvasToken.count < 10)
    }
  }

  @ViewBuilder private func status(_ i: Integration?) -> some View {
    if let i {
      if i.needsReconnect { Text("reconnect").foregroundStyle(.orange) }
      else { Text(i.account ?? "connected").foregroundStyle(i.last_status == "error" ? .orange : .green) }
    } else {
      Text("off").foregroundStyle(.secondary)
    }
  }

  private func run(_ work: @escaping @MainActor () async -> Void) {
    busy = true
    Task { await work(); busy = false }
  }
}
