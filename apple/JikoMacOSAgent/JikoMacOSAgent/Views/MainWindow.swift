//  MainWindow.swift
//  Everything that doesn't fit in the menu: sign in, onboarding, conversation, rules, apps, settings.
import SwiftUI
import JikoKit

struct MainWindow: View {
  @EnvironmentObject var state: AppState

  var body: some View {
    Group {
      if !state.isAuthenticated { LoginView() }
      else if state.needsOnboarding { OnboardingView() }
      else {
        TabView {
          ConversationView().tabItem { Label("Chat", systemImage: "bubble.left.and.bubble.right") }
          TodayView().tabItem { Label("Today", systemImage: "sun.max") }
          RulesView().tabItem { Label("Rules", systemImage: "bolt") }
          AppsView().tabItem { Label("Apps", systemImage: "square.grid.2x2") }
          SettingsView().tabItem { Label("Settings", systemImage: "gear") }
        }
      }
    }
    .frame(minWidth: 560, minHeight: 520)
  }
}

// MARK: - Login

struct LoginView: View {
  @EnvironmentObject var state: AppState
  @State private var phone = ""
  @State private var password = ""
  @State private var nickname = ""
  @State private var signup = false
  @State private var busy = false
  @State private var error: String?

  var body: some View {
    VStack(spacing: 14) {
      Image(systemName: "apple.meditate").font(.system(size: 42)).foregroundStyle(.green)
      Text(signup ? "Create your Jiko" : "Sign in to Jiko").font(.title2).bold()
      Form {
        TextField("Server", text: $state.baseURL).onSubmit { Task { await state.updateBaseURL(state.baseURL) } }
        TextField("Phone number", text: $phone)
        SecureField("Password", text: $password)
        if signup { TextField("What should Jiko call you?", text: $nickname) }
      }
      .formStyle(.grouped)
      .frame(maxWidth: 380)
      if let error { Text(error).foregroundStyle(.red).font(.callout) }
      HStack {
        Button(signup ? "Have an account? Sign in" : "New here? Sign up") { signup.toggle() }.buttonStyle(.link)
        Spacer()
        Button(signup ? "Create" : "Sign in") { submit() }
          .keyboardShortcut(.defaultAction)
          .disabled(busy || phone.isEmpty || password.isEmpty)
      }
      .frame(maxWidth: 380)
      if signup { Text("Password: 8+ chars with upper, lower, number, symbol.").font(.caption).foregroundStyle(.secondary) }
    }
    .padding(24)
  }

  private func submit() {
    busy = true; error = nil
    Task {
      do { try await state.signIn(phone: phone, password: password, signup: signup, nickname: nickname) }
      catch { self.error = error.localizedDescription }
      busy = false
    }
  }
}

// MARK: - Conversation

struct ConversationView: View {
  @EnvironmentObject var state: AppState
  @State private var draft = ""

  var body: some View {
    VStack(spacing: 0) {
      ScrollViewReader { proxy in
        ScrollView {
          LazyVStack(alignment: .leading, spacing: 8) {
            if state.messages.isEmpty {
              Text("Nothing yet. Jiko speaks when it has a reason to.").foregroundStyle(.secondary).padding()
            }
            ForEach(state.messages.filter { !$0.body.isEmpty }) { m in
              MessageBubble(message: m).id(m.id)
            }
          }
          .padding()
        }
        .onChange(of: state.messages.count) { _, _ in if let last = state.messages.last { proxy.scrollTo(last.id, anchor: .bottom) } }
      }
      Divider()
      HStack {
        TextField("say something", text: $draft).textFieldStyle(.roundedBorder).onSubmit(send)
        Button("Send", action: send).disabled(draft.trimmingCharacters(in: .whitespaces).isEmpty)
      }
      .padding(10)
    }
  }

  private func send() {
    let t = draft.trimmingCharacters(in: .whitespaces); guard !t.isEmpty else { return }
    draft = ""
    Task { await state.reply(t, to: state.messages.last(where: { $0.isFromJiko })?.id) }
  }
}

struct MessageBubble: View {
  let message: Message
  @EnvironmentObject var state: AppState
  @State private var why: String?
  @State private var loadingWhy = false
  @State private var verdict: String?

  private var bubbleColor: Color { message.isFromJiko ? Color.gray.opacity(0.18) : Color.accentColor.opacity(0.85) }
  private var textColor: Color { message.isFromJiko ? Color.primary : Color.white }

  /// Only a nudge Jiko sent on its own has a firing worth explaining.
  private var canExplain: Bool { message.isFromJiko && message.trigger_id != nil }

  private func loadWhy() {
    guard !loadingWhy, why == nil else { return }
    loadingWhy = true
    Task {
      why = (try? await JikoAPI.shared.why(message.id))?.reason ?? "couldn't reach the server for that."
      loadingWhy = false
    }
  }

  /// Marking a nudge wrong is the only feedback Jiko acts on: three in a week
  /// and the rule behind it turns itself off.
  private func mark() async {
    guard let result = try? await JikoAPI.shared.feedback(message.id, verdict: "wrong") else {
      verdict = "couldn't reach the server for that."
      return
    }
    verdict = result.disabled_trigger ? "noted. that rule is off now." : "noted."
    await state.refreshAll()
  }

  var body: some View {
    HStack {
      if !message.isFromJiko { Spacer(minLength: 60) }
      VStack(alignment: message.isFromJiko ? .leading : .trailing, spacing: 2) {
        Text(message.body)
          .textSelection(.enabled)
          .padding(.horizontal, 12)
          .padding(.vertical, 8)
          .background(bubbleColor, in: RoundedRectangle(cornerRadius: 14))
          .foregroundStyle(textColor)
        Text(message.createdDate.formatted(date: .abbreviated, time: .shortened))
          .font(.caption2)
          .foregroundStyle(.tertiary)
        if canExplain {
          if let why {
            Text(why).font(.caption2).foregroundStyle(.secondary)
              .fixedSize(horizontal: false, vertical: true)
          } else {
            Button(loadingWhy ? "checking…" : "why did I get this?") { loadWhy() }
              .buttonStyle(.link).font(.caption2).disabled(loadingWhy)
          }
          if let verdict {
            Text(verdict).font(.caption2).foregroundStyle(.secondary)
          } else {
            Button("that was wrong") { Task { await mark() } }
              .buttonStyle(.link).font(.caption2)
          }
        }
      }
      if message.isFromJiko { Spacer(minLength: 60) }
    }
  }
}

// MARK: - Today

struct TodayView: View {
  @EnvironmentObject var state: AppState
  @State private var quick = ""

  var body: some View {
    List {
      Section("Today") {
        Text(state.summary?.text ?? "no data yet")
        if let s = state.summary {
          ForEach(s.top_apps.prefix(6)) { a in
            HStack {
              Text(a.app_name ?? a.bundle_id)
              if let l = a.label { Text(l).font(.caption).padding(.horizontal, 6).padding(.vertical, 2).background(labelColor(l).opacity(0.2), in: Capsule()) }
              Spacer()
              Text(minutes(a.seconds)).foregroundStyle(.secondary).monospacedDigit()
            }
          }
        }
        if let b = state.budget {
          Text("\(b.remaining) of \(b.budget) nudges left today\(b.quiet_hours_active ? " · quiet hours" : "")").font(.callout).foregroundStyle(.secondary)
        }
      }
      Section("Coming up") {
        HStack {
          TextField("\"OS midterm thu 2pm\", \"pset due friday\", \"gym tonight\"", text: $quick).onSubmit(add)
          Button("Add", action: add).disabled(quick.isEmpty)
        }
        if state.upcoming.isEmpty { Text("Nothing due in the next three days.").foregroundStyle(.secondary) }
        ForEach(state.upcoming) { o in
          HStack {
            Button { Task { await state.complete(o) } } label: { Image(systemName: "circle") }.buttonStyle(.plain)
            Text(o.title)
            Spacer()
            if let d = o.whenDate { Text(d.formatted(.relative(presentation: .named))).foregroundStyle(.secondary).font(.callout) }
          }
        }
      }
    }
    .refreshable { await state.refreshAll() }
    .task { await state.refreshAll() }
  }

  private func add() { let t = quick; quick = ""; Task { _ = try? await state.quickAdd(t) } }
  private func minutes(_ s: Int) -> String { s < 3600 ? "\(s / 60) min" : String(format: "%dh %02dm", s / 3600, (s % 3600) / 60) }
}

func labelColor(_ l: String) -> Color { l == "distracting" ? .red : l == "work" ? .green : .gray }

// MARK: - Rules

struct RulesView: View {
  @EnvironmentObject var state: AppState

  var body: some View {
    List {
      Section("Active") {
        if state.triggers.isEmpty { Text("No rules yet. Turn one on below.").foregroundStyle(.secondary) }
        ForEach(state.triggers) { t in
          HStack {
            Toggle(isOn: Binding(get: { t.enabled }, set: { v in Task { await state.setTrigger(t, enabled: v) } })) {
              VStack(alignment: .leading, spacing: 2) {
                Text(t.name)
                Text("\(t.kind) · fired \(t.fire_count)×").font(.caption).foregroundStyle(.secondary)
                if let wrong = t.wrong_recently, wrong > 0 {
                  Text("\(wrong) wrong this week\(t.wrong_limit.map { " of \($0)" } ?? "")")
                    .font(.caption2).foregroundStyle(.orange)
                }
                if let last = t.last_firing {
                  Text("last time: \(last.reason) (\(last.firedDate.formatted(date: .abbreviated, time: .shortened)))")
                    .font(.caption2).foregroundStyle(.tertiary)
                    .fixedSize(horizontal: false, vertical: true)
                }
              }
            }
            Spacer()
            Button(role: .destructive) { Task { await state.deleteTrigger(t) } } label: { Image(systemName: "trash") }.buttonStyle(.plain)
          }
        }
      }
      Section("Turn on") {
        ForEach(state.presets.filter { $0.kind != "location" }) { p in
          HStack(alignment: .top) {
            VStack(alignment: .leading) {
              Text(p.name).bold()
              Text(p.description).font(.caption).foregroundStyle(.secondary)
            }
            Spacer()
            Button("Enable") { Task { await state.enablePreset(p.id) } }
          }
        }
        Text("Location rules need a saved place; that's coming with the iOS app.").font(.caption).foregroundStyle(.tertiary)
      }
    }
    .task { await state.refreshAll() }
  }
}

// MARK: - Apps

struct AppsView: View {
  @EnvironmentObject var state: AppState
  private let labels = ["distracting", "work", "neutral"]

  var body: some View {
    List {
      Section {
        Text("Tell Jiko which apps pull you away. Unlabeled apps are ignored by the \"distracting apps\" rules.").font(.callout).foregroundStyle(.secondary)
      }
      Section("Seen on this Mac") {
        if state.seenApps.isEmpty { Text("Nothing synced yet. Use your Mac for a minute.").foregroundStyle(.secondary) }
        ForEach(state.seenApps) { a in
          HStack {
            Text(a.app_name ?? a.bundle_id)
            Text(a.bundle_id).font(.caption2).foregroundStyle(.tertiary)
            Spacer()
            Picker("", selection: Binding(get: { a.label ?? "" }, set: { v in if !v.isEmpty { Task { await state.setLabel(a.bundle_id, v) } } })) {
              Text("—").tag("")
              ForEach(labels, id: \.self) { Text($0).tag($0) }
            }
            .frame(width: 130)
          }
        }
      }
    }
    .task { await state.refreshAll() }
  }
}

// MARK: - Settings

struct SettingsView: View {
  @EnvironmentObject var state: AppState
  @State private var strictness = 0.5
  @State private var voice = "older_sibling"
  @State private var quietStart = "23:00"
  @State private var quietEnd = "08:00"
  @State private var channel = "agent"
  private let channels = [("agent", "Notifications"), ("imessage", "iMessage"), ("sms", "SMS")]
  private let voices = [("older_sibling", "Older sibling"), ("drill_sergeant", "Drill sergeant"), ("dry_coworker", "Dry coworker"), ("gentle", "Gentle"), ("own_voice", "My own voice")]

  var body: some View {
    Form {
      Section("How hard should Jiko push?") {
        Slider(value: $strictness, in: 0...1, step: 0.1) { Text("Strictness") } minimumValueLabel: { Text("gentle") } maximumValueLabel: { Text("ruthless") }
          .onChange(of: strictness) { _, v in Task { await state.setStrictness(v) } }
        if let p = state.preferences { Text("\(p.interrupt_budget_per_day) unsolicited messages per day max.").font(.caption).foregroundStyle(.secondary) }
      }
      Section("Voice") {
        Picker("Jiko sounds like", selection: $voice) { ForEach(voices, id: \.0) { Text($0.1).tag($0.0) } }
          .onChange(of: voice) { _, v in Task { await state.setVoice(v) } }
        Text("Only applies when the server has an LLM key; otherwise you get the plain templates.").font(.caption).foregroundStyle(.secondary)
      }
      Section("How messages arrive") {
        Picker("Deliver as", selection: $channel) { ForEach(channels, id: \.0) { Text($0.1).tag($0.0) } }
          .onChange(of: channel) { _, v in Task { await state.setDeliveryChannel(v) } }
        if channel == "imessage" {
          Text("Jiko texts your own number through Messages. macOS will ask once for permission to control Messages.")
            .font(.caption).foregroundStyle(.secondary)
        }
        if let problem = state.imessageProblem {
          Text(problem).font(.caption).foregroundStyle(.orange)
        }
      }
      Section("Quiet hours") {
        HStack {
          TextField("23:00", text: $quietStart).frame(width: 70)
          Text("to")
          TextField("08:00", text: $quietEnd).frame(width: 70)
          Button("Save") { Task { await state.setQuietHours(QuietHours(start: quietStart, end: quietEnd)) } }
        }
      }
      Section("Focus") {
        switch state.focus {
        case .on(let name):
          Text("\(name ?? "A Focus") is on. Jiko is holding nudges.").font(.callout)
        case .off:
          Text("No Focus on right now.").font(.callout).foregroundStyle(.secondary)
        case .unknown:
          Text("Jiko can treat a macOS Focus as quiet hours, but macOS needs you to hand over the Focus folder once.")
            .font(.caption).foregroundStyle(.secondary)
        }
        HStack {
          Button(state.focus == .unknown ? "Let Jiko see my Focus" : "Re-grant access") {
            Task { await state.enableFocusAwareness() }
          }
          if state.focus != .unknown {
            Button("Stop using Focus") { state.disableFocusAwareness() }
          }
        }
      }
      Section("Startup") {
        Toggle("Launch Jiko at login", isOn: Binding(get: { state.launchAtLogin }, set: { state.setLaunchAtLogin($0) }))
        if let problem = state.launchAtLoginProblem {
          Text(problem).font(.caption).foregroundStyle(.orange)
        }
      }
      Section("Account") {
        LabeledContent("Signed in as", value: state.me?.nickname ?? state.me?.phoneNumber ?? "")
        LabeledContent("Server", value: state.baseURL)
        LabeledContent("Last sync", value: state.lastSyncAt?.formatted(date: .omitted, time: .standard) ?? "never")
        if let e = state.lastSyncError { Text(e).foregroundStyle(.red).font(.callout) }
        Button("Sign out", role: .destructive) { Task { await state.signOut() } }
      }
    }
    .formStyle(.grouped)
    .onAppear {
      if let p = state.preferences { strictness = p.strictness; voice = p.voice; quietStart = p.quiet_hours.start; quietEnd = p.quiet_hours.end; channel = p.delivery_channel }
    }
  }
}
