//  OnboardingView.swift
//  Three questions, asked the way Jiko would ask them. Sets labels, one
//  obligation, strictness, and turns on the two rules that matter.
import SwiftUI

struct OnboardingView: View {
  @EnvironmentObject var state: AppState
  @State private var step = 0
  @State private var chosenApps: Set<String> = []
  @State private var dueText = ""
  @State private var strictness = 0.5
  @State private var busy = false

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
      bubble(step == 0 ? "hey. i'm jiko. what are you trying to stop doing?" : step == 1 ? "got it. what's due this week?" : "last one. how mean should i be?")
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
        default:
          Slider(value: $strictness, in: 0...1, step: 0.1) { Text("Strictness") } minimumValueLabel: { Text("gentle") } maximumValueLabel: { Text("ruthless") }
          Text(strictness < 0.3 ? "one nudge a day, softly." : strictness < 0.7 ? "a few nudges a day, direct." : "as many as it takes. no softeners.").font(.caption).foregroundStyle(.secondary)
        }
      }
      Spacer()
      HStack {
        if step > 0 { Button("Back") { step -= 1 } }
        Spacer()
        Button(step < 2 ? "Next" : "Let's go") { advance() }.keyboardShortcut(.defaultAction).disabled(busy)
      }
    }
    .padding(24)
    .task { await state.refreshAll() }
  }

  private func bubble(_ t: String) -> some View {
    Text(t).padding(.horizontal, 12).padding(.vertical, 8)
      .background(Color.gray.opacity(0.18), in: RoundedRectangle(cornerRadius: 14))
  }

  private func advance() {
    if step < 2 { step += 1; return }
    busy = true
    Task {
      for b in chosenApps { await state.setLabel(b, "distracting") }
      if !dueText.trimmingCharacters(in: .whitespaces).isEmpty { _ = try? await state.quickAdd(dueText) }
      await state.setStrictness(strictness)
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
