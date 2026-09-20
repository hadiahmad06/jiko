//  OnboardingView.swift
//  Four questions, asked the way Jiko would ask them. Sets labels, one
//  obligation, strictness, how messages arrive, and turns on the rules that
//  matter.
import SwiftUI
import JikoKit

struct OnboardingView: View {
  @EnvironmentObject var state: AppState
  @State private var step = 0
  @State private var chosenApps: Set<String> = []
  @State private var dueText = ""
  @State private var strictness = 0.5
  @State private var channel = "agent"
  @State private var busy = false
  private let lastStep = 3

  private var candidates: [SeenApp] {
    // what's already been seen on this Mac, plus the usual suspects
    let seen = state.seenApps
    let usual = ["com.apple.Safari": "Safari", "com.google.Chrome": "Google Chrome", "com.tinyspeck.slackmacgap": "Slack", "com.hnc.Discord": "Discord", "com.apple.TV": "TV", "com.apple.Music": "Music", "com.apple.MobileSMS": "Messages", "com.apple.mail": "Mail"]
    var out = seen
    for (b, n) in usual where !seen.contains(where: { $0.bundle_id == b }) { out.append(SeenApp(bundle_id: b, app_name: n, label: nil, last_seen: "")) }
    return out
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      bubble(prompt)
      Group {
        switch step {
        case 0:
          List(candidates) { a in
            Toggle(a.app_name ?? a.bundle_id, isOn: Binding(get: { chosenApps.contains(a.bundle_id) }, set: { v in if v { chosenApps.insert(a.bundle_id) } else { chosenApps.remove(a.bundle_id) } }))
          }
          .frame(height: 240)
          Text("pick the apps that eat your time. you can change this later.").font(.caption).foregroundStyle(.secondary)
        case 1:
          TextField("\"OS midterm thu 2pm\", \"pset 3 due friday\". or leave it blank.", text: $dueText).textFieldStyle(.roundedBorder)
          Text("jiko only interrupts when there's a reason. this is the reason.").font(.caption).foregroundStyle(.secondary)
        case 2:
          Slider(value: $strictness, in: 0...1, step: 0.1) { Text("Strictness") } minimumValueLabel: { Text("gentle") } maximumValueLabel: { Text("ruthless") }
          Text(strictness < 0.3 ? "one nudge a day, softly." : strictness < 0.7 ? "a few nudges a day, direct." : "as many as it takes. no softeners.").font(.caption).foregroundStyle(.secondary)
        default:
          Picker("", selection: $channel) {
            Text("Notifications").tag("agent")
            Text("iMessage").tag("imessage")
          }
          .pickerStyle(.radioGroup)
          Text(channel == "imessage"
               ? "i'll text your own number through Messages. macOS will ask once for permission to control it."
               : "banners with a reply box. no permissions needed.")
            .font(.caption).foregroundStyle(.secondary)
          if let problem = state.imessageProblem {
            Text(problem).font(.caption).foregroundStyle(.orange)
          }
        }
      }
      Spacer()
      HStack {
        if step > 0 { Button("Back") { step -= 1 } }
        Spacer()
        Button(step < lastStep ? "Next" : "Let's go") { advance() }.keyboardShortcut(.defaultAction).disabled(busy)
      }
    }
    .padding(24)
    .task { await state.refreshAll() }
  }

  private var prompt: String {
    switch step {
    case 0: return "hey. i'm jiko. what are you trying to stop doing?"
    case 1: return "got it. what's due this week?"
    case 2: return "how mean should i be?"
    default: return "last one. how should i reach you?"
    }
  }

  private func bubble(_ t: String) -> some View {
    Text(t).padding(.horizontal, 12).padding(.vertical, 8)
      .background(Color.gray.opacity(0.18), in: RoundedRectangle(cornerRadius: 14))
  }

  private func advance() {
    if step < lastStep {
      step += 1
      // Ask for Messages automation while the user is looking at the reason.
      if step == lastStep && channel == "imessage" { Task { await state.setDeliveryChannel("imessage") } }
      return
    }
    busy = true
    Task {
      for b in chosenApps { await state.setLabel(b, "distracting") }
      if !dueText.trimmingCharacters(in: .whitespaces).isEmpty { _ = try? await state.quickAdd(dueText) }
      await state.setStrictness(strictness)
      await state.setDeliveryChannel(channel)
      await state.enablePreset("deadline_drift")
      await state.enablePreset("doomscroll", params: ["minutes": strictness > 0.7 ? 15 : strictness > 0.3 ? 30 : 45])
      await state.enablePreset("nightly_summary")
      await state.enablePreset("deadline_reminder")
      _ = try? await JikoAPI.shared.send("hey", replyTo: nil)
      await state.refreshAll()
      state.finishOnboarding()
      busy = false
    }
  }
}
