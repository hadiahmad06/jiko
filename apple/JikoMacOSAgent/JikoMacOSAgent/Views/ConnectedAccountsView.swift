//  ConnectedAccountsView.swift
//  Google (Gmail + Calendar) and Canvas. Used in Settings and as an onboarding
//  step. Google opens a browser; Canvas takes a pasted access token.
import SwiftUI
import AppKit
import JikoKit

struct ConnectedAccountsView: View {
  @EnvironmentObject var state: AppState
  @State private var canvasURL = ""
  @State private var canvasToken = ""
  @State private var busy: String?

  var body: some View {
    let info = state.integrations
    VStack(alignment: .leading, spacing: 14) {
      googleRow(info)
      Divider()
      canvasRow(info)
      if let p = state.integrationProblem {
        Text(p).font(.caption).foregroundStyle(.orange).fixedSize(horizontal: false, vertical: true)
      }
    }
    .task { await state.refreshIntegrations() }
    .onReceive(NotificationCenter.default.publisher(for: NSApplication.didBecomeActiveNotification)) { _ in
      Task { await state.refreshIntegrations() }
    }
  }

  @ViewBuilder private func googleRow(_ info: IntegrationsResponse?) -> some View {
    let g = info?.connected("google")
    VStack(alignment: .leading, spacing: 6) {
      HStack {
        Label("Google", systemImage: "envelope").font(.headline)
        Spacer()
        statusText(g)
      }
      Text("Calendar events, and emails that mention an interview, deadline or appointment with a date. Read-only: subject lines and previews, never full emails.")
        .font(.caption).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
      HStack {
        if info?.available.google == false {
          Text("Google sign-in isn't switched on for this server yet.").font(.caption).foregroundStyle(.secondary)
        } else if let g, !g.needsReconnect {
          Button("Sync now") { run("google") { await state.syncIntegration("google") } }
          Button("Disconnect") { run("google") { await state.disconnectIntegration("google") } }
        } else {
          Button(g == nil ? "Connect Google…" : "Reconnect Google…") { run("google") { await state.connectGoogle() } }
            .buttonStyle(.borderedProminent)
          if busy == "google" { Text("finish in your browser…").font(.caption).foregroundStyle(.secondary) }
        }
      }
      .disabled(busy != nil)
    }
  }

  @ViewBuilder private func canvasRow(_ info: IntegrationsResponse?) -> some View {
    let c = info?.connected("canvas")
    VStack(alignment: .leading, spacing: 6) {
      HStack {
        Label("Canvas", systemImage: "graduationcap").font(.headline)
        Spacer()
        statusText(c)
      }
      Text("Assignments and due dates. Anything you've already submitted is marked done.")
        .font(.caption).foregroundStyle(.secondary)
      if let c, !c.needsReconnect {
        HStack {
          Button("Sync now") { run("canvas") { await state.syncIntegration("canvas") } }
          Button("Disconnect") { run("canvas") { await state.disconnectIntegration("canvas") } }
        }
        .disabled(busy != nil)
      } else {
        TextField("canvas.yourschool.edu", text: $canvasURL).textFieldStyle(.roundedBorder)
        SecureField("access token", text: $canvasToken).textFieldStyle(.roundedBorder)
        DisclosureGroup("How to get a token") {
          Text("In Canvas: Account → Settings → Approved Integrations → + New Access Token. Purpose \"Jiko\", then Generate Token and paste it here. Canvas shows it only once.")
            .font(.caption).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
        }
        .font(.caption)
        Button("Connect Canvas") {
          run("canvas") { if await state.connectCanvas(baseURL: canvasURL, token: canvasToken) { canvasToken = "" } }
        }
        .disabled(busy != nil || canvasURL.isEmpty || canvasToken.count < 10 || info?.available.canvas == false)
      }
    }
    .onAppear { if canvasURL.isEmpty, let u = c?.base_url { canvasURL = u.replacingOccurrences(of: "https://", with: "") } }
  }

  @ViewBuilder private func statusText(_ i: Integration?) -> some View {
    if let i {
      if i.needsReconnect {
        Text("needs reconnecting").font(.caption).foregroundStyle(.orange)
      } else {
        Text([i.account, Self.ago(i.last_synced_at)].compactMap { $0 }.joined(separator: " · "))
          .font(.caption).foregroundStyle(i.last_status == "error" ? .orange : .secondary)
      }
    }
  }

  private func run(_ which: String, _ work: @escaping @MainActor () async -> Void) {
    busy = which
    Task { await work(); busy = nil }
  }

  static func ago(_ iso: String?) -> String {
    guard let iso else { return "not synced yet" }
    let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    guard let d = f.date(from: iso) else { return "synced" }
    return "synced " + RelativeDateTimeFormatter().localizedString(for: d, relativeTo: Date())
  }
}
