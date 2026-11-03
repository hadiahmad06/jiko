//  ContentView.swift
//  Three tabs: the conversation, what's due, and what Jiko is allowed to see.
import SwiftUI
import JikoKit

struct ContentView: View {
  @EnvironmentObject var state: AppState

  var body: some View {
    if state.isAuthenticated {
      TabView {
        ConversationView().tabItem { Label("Jiko", systemImage: "message") }
        TodayView().tabItem { Label("Today", systemImage: "checklist") }
        RulesView().tabItem { Label("Rules", systemImage: "bolt") }
        SettingsView().tabItem { Label("Settings", systemImage: "gear") }
      }
    } else {
      LoginView()
    }
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
    NavigationStack {
      Form {
        Section("Server") {
          TextField("http://localhost:3000", text: $state.baseURL)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
            .onSubmit { Task { await state.updateBaseURL(state.baseURL) } }
        }
        Section(signup ? "Create your Jiko" : "Sign in") {
          TextField("Phone number", text: $phone).keyboardType(.phonePad)
          SecureField("Password", text: $password)
          if signup { TextField("What should Jiko call you?", text: $nickname) }
        }
        if let error { Text(error).foregroundStyle(.red).font(.callout) }
        Section {
          Button(signup ? "Create account" : "Sign in") { submit() }
            .disabled(busy || phone.isEmpty || password.isEmpty)
          Button(signup ? "Have an account? Sign in" : "New here? Sign up") { signup.toggle() }
        }
      }
      .navigationTitle("Jiko")
    }
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
    NavigationStack {
      VStack(spacing: 0) {
        ScrollViewReader { proxy in
          ScrollView {
            LazyVStack(alignment: .leading, spacing: 8) {
              if state.messages.isEmpty {
                Text("Nothing yet. Jiko speaks when it has a reason to.")
                  .foregroundStyle(.secondary).padding()
              }
              ForEach(state.messages.filter { !$0.body.isEmpty }) { m in
                MessageBubble(message: m).id(m.id)
              }
            }
            .padding()
          }
          .onChange(of: state.messages.count) { _, _ in
            if let last = state.messages.last { proxy.scrollTo(last.id, anchor: .bottom) }
          }
        }
        Divider()
        HStack {
          TextField("say something", text: $draft).textFieldStyle(.roundedBorder).onSubmit(send)
          Button("Send", action: send).disabled(draft.trimmingCharacters(in: .whitespaces).isEmpty)
        }
        .padding(10)
      }
      .navigationTitle("Jiko")
      .toolbar {
        if let b = state.budget {
          ToolbarItem(placement: .topBarTrailing) {
            Text("\(b.remaining)/\(b.budget)").font(.caption).foregroundStyle(.secondary)
          }
        }
      }
      .refreshable { await state.pollMessages() }
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
  @State private var why: String?
  @State private var loadingWhy = false
  @State private var verdict: String?

  private var canExplain: Bool { message.isFromJiko && message.trigger_id != nil }

  var body: some View {
    HStack {
      if !message.isFromJiko { Spacer(minLength: 60) }
      VStack(alignment: message.isFromJiko ? .leading : .trailing, spacing: 2) {
        Text(message.body)
          .padding(.horizontal, 12).padding(.vertical, 8)
          .background(message.isFromJiko ? Color.gray.opacity(0.18) : Color.accentColor.opacity(0.85),
                      in: RoundedRectangle(cornerRadius: 16))
          .foregroundStyle(message.isFromJiko ? Color.primary : Color.white)
        Text(message.createdDate.formatted(date: .abbreviated, time: .shortened))
          .font(.caption2).foregroundStyle(.tertiary)
        if canExplain {
          if let why {
            Text(why).font(.caption2).foregroundStyle(.secondary)
          } else {
            Button(loadingWhy ? "checking…" : "why did I get this?") { loadWhy() }
              .font(.caption2).disabled(loadingWhy)
          }
          if let verdict {
            Text(verdict).font(.caption2).foregroundStyle(.secondary)
          } else {
            Button("that was wrong") { Task { await mark() } }.font(.caption2)
          }
        }
      }
      if message.isFromJiko { Spacer(minLength: 60) }
    }
  }

  private func loadWhy() {
    guard !loadingWhy, why == nil else { return }
    loadingWhy = true
    Task {
      why = (try? await JikoAPI.shared.why(message.id))?.reason ?? "couldn't reach the server for that."
      loadingWhy = false
    }
  }

  private func mark() async {
    guard let result = try? await JikoAPI.shared.feedback(message.id, verdict: "wrong") else {
      verdict = "couldn't reach the server for that."
      return
    }
    verdict = result.disabled_trigger ? "noted. that rule is off now." : "noted."
  }
}

// MARK: - Today

struct TodayView: View {
  @EnvironmentObject var state: AppState
  @State private var draft = ""
  @State private var error: String?

  var body: some View {
    NavigationStack {
      List {
        Section("Due soon") {
          if state.upcoming.isEmpty { Text("Nothing on the books.").foregroundStyle(.secondary) }
          ForEach(state.upcoming) { o in
            HStack {
              VStack(alignment: .leading) {
                Text(o.title)
                if let when = o.whenDate {
                  Text(when.formatted(date: .abbreviated, time: .shortened))
                    .font(.caption).foregroundStyle(.secondary)
                }
              }
              Spacer()
              Button("Done") { Task { await state.complete(o) } }.buttonStyle(.borderless)
            }
          }
        }
        Section("Add") {
          HStack {
            TextField("\"pset 3 due friday 5pm\"", text: $draft).onSubmit(add)
            Button("Add", action: add).disabled(draft.trimmingCharacters(in: .whitespaces).isEmpty)
          }
          if let error { Text(error).font(.caption).foregroundStyle(.orange) }
        }
      }
      .navigationTitle("Today")
      .refreshable { await state.refreshAll() }
      .task { await state.refreshAll() }
    }
  }

  private func add() {
    let t = draft.trimmingCharacters(in: .whitespaces); guard !t.isEmpty else { return }
    Task {
      do { _ = try await state.quickAdd(t); draft = ""; error = nil }
      catch { self.error = error.localizedDescription }
    }
  }
}

// MARK: - Settings

struct SettingsView: View {
  @EnvironmentObject var state: AppState

  var body: some View {
    NavigationStack {
      Form {
        Section("What Jiko can see") {
          LabeledContent("Location") {
            Text(state.location.isAuthorized ? "on" : "off").foregroundStyle(state.location.isAuthorized ? .green : .secondary)
          }
          if !state.location.isAuthorized {
            Button("Turn on location") { state.enableLocation() }
            Text("Significant-change updates only: Jiko notices when you get somewhere, not every step.")
              .font(.caption).foregroundStyle(.secondary)
          } else if state.location.authorization == .authorizedWhenInUse {
            Button("Allow in the background too") { state.location.requestAlways() }
            Text("Without background access, a place rule only fires while the app is open.")
              .font(.caption).foregroundStyle(.secondary)
          }

          LabeledContent("Health") {
            Text(state.health.authorized ? "on" : "off").foregroundStyle(state.health.authorized ? .green : .secondary)
          }
          if !state.health.authorized {
            Button("Turn on health") { Task { await state.enableHealth() } }
            Text("Steps and sleep, read once an hour. A short night makes Jiko ease off.")
              .font(.caption).foregroundStyle(.secondary)
          }
          Text("Screen time on iPhone needs an entitlement Apple has to approve. Not in this build.")
            .font(.caption).foregroundStyle(.tertiary)
        }

        Section {
          ConnectedAccountsView()
        } header: {
          Text("Connected accounts")
        } footer: {
          Text("Where \"due\" comes from. Read-only.")
        }

        Section("Last seen") {
          LabeledContent("Messages", value: state.lastSyncAt?.formatted(date: .omitted, time: .standard) ?? "never")
          LabeledContent("Location", value: state.lastLocationAt?.formatted(date: .omitted, time: .standard) ?? "never")
          LabeledContent("Health", value: state.lastHealthAt?.formatted(date: .omitted, time: .standard) ?? "never")
          if let steps = state.health.steps { LabeledContent("Steps today", value: String(Int(steps))) }
          if let sleep = state.health.sleepMinutes {
            LabeledContent("Slept", value: "\(Int(sleep / 60))h \(Int(sleep) % 60)m")
          }
          if let e = state.lastSyncError { Text(e).font(.caption).foregroundStyle(.red) }
        }

        Section("Account") {
          LabeledContent("Signed in as", value: state.me?.nickname ?? state.me?.phoneNumber ?? "")
          LabeledContent("Server", value: state.baseURL)
          Button("Sign out", role: .destructive) { Task { await state.signOut() } }
        }
      }
      .navigationTitle("Settings")
    }
  }
}

#Preview {
  ContentView().environmentObject(AppState())
}
