//  JikoMenu.swift
//  The menu-bar popover: status, today in one line, last message, quick reply.
import SwiftUI

struct MenuView: View {
  @EnvironmentObject var state: AppState
  @Environment(\.openWindow) private var openWindow
  @State private var draft = ""
  @State private var quick = ""

  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      header
      Divider()
      if state.isAuthenticated {
        today
        lastMessage
        replyField
        quickAddField
        Divider()
        footer
      } else {
        Text("Not signed in.").foregroundStyle(.secondary)
        Button("Sign in…") { openWindow(id: "main"); NSApp.activate(ignoringOtherApps: true) }
      }
    }
    .padding(12)
    .frame(width: 320)
  }

  private var header: some View {
    HStack {
      Image(systemName: "apple.meditate").foregroundStyle(.green)
      Text("Jiko").bold()
      Spacer()
      if let app = state.tracker.currentApp?.localizedName {
        Text(app).font(.caption).foregroundStyle(.secondary).lineLimit(1)
      }
    }
  }

  private var today: some View {
    VStack(alignment: .leading, spacing: 4) {
      Text(state.summary?.text ?? "no data yet today").font(.callout)
      HStack(spacing: 8) {
        if let b = state.budget {
          Label("\(b.remaining) of \(b.budget) nudges left", systemImage: "bell").font(.caption).foregroundStyle(.secondary)
          if b.quiet_hours_active { Text("quiet hours").font(.caption).foregroundStyle(.secondary) }
        }
        if let until = state.pausedUntil, until > Date() {
          Text("paused until \(until.formatted(date: .omitted, time: .shortened))").font(.caption).foregroundStyle(.orange)
        }
      }
    }
  }

  @ViewBuilder private var lastMessage: some View {
    if let m = state.messages.last(where: { $0.isFromJiko }) {
      VStack(alignment: .leading, spacing: 2) {
        Text(m.body).font(.body).textSelection(.enabled)
        Text(m.createdDate.formatted(.relative(presentation: .named))).font(.caption2).foregroundStyle(.tertiary)
      }
      .padding(8)
      .frame(maxWidth: .infinity, alignment: .leading)
      .background(Color.accentColor.opacity(0.12), in: RoundedRectangle(cornerRadius: 8))
    }
  }

  private var replyField: some View {
    HStack {
      TextField("reply to jiko… (snooze 20 / done / status)", text: $draft)
        .textFieldStyle(.roundedBorder)
        .onSubmit(sendReply)
      Button("Send", action: sendReply).disabled(draft.trimmingCharacters(in: .whitespaces).isEmpty)
    }
  }

  private var quickAddField: some View {
    HStack {
      TextField("add something due… (\"pset 3 friday 5pm\")", text: $quick)
        .textFieldStyle(.roundedBorder)
        .onSubmit(addQuick)
      Button("Add", action: addQuick).disabled(quick.trimmingCharacters(in: .whitespaces).isEmpty)
    }
  }

  private var footer: some View {
    HStack {
      Button("Open Jiko") { openWindow(id: "main"); NSApp.activate(ignoringOtherApps: true) }
      Menu("Pause") {
        Button("1 hour") { state.pause(minutes: 60) }
        Button("Until tomorrow") { state.pause(minutes: 16 * 60) }
        if state.pausedUntil != nil { Button("Resume") { state.resume() } }
      }.fixedSize()
      Spacer()
      if let err = state.lastSyncError { Image(systemName: "exclamationmark.triangle").foregroundStyle(.orange).help(err) }
      if state.pendingPayloads > 0 { Text("\(state.pendingPayloads) queued").font(.caption2).foregroundStyle(.secondary) }
      Button("Quit") { NSApp.terminate(nil) }.keyboardShortcut("q")
    }
    .font(.callout)
  }

  private func sendReply() {
    let text = draft.trimmingCharacters(in: .whitespaces)
    guard !text.isEmpty else { return }
    draft = ""
    let last = state.messages.last(where: { $0.isFromJiko })?.id
    Task { await state.reply(text, to: last) }
  }

  private func addQuick() {
    let text = quick.trimmingCharacters(in: .whitespaces)
    guard !text.isEmpty else { return }
    quick = ""
    Task { _ = try? await state.quickAdd(text) }
  }
}
