//  Views_Rules.swift
//  Rules and Places on the phone: what Jiko is allowed to do, and the places a
//  location rule can point at. Parity with the macOS Rules list, plus the two
//  location presets the Mac cannot offer because it does not move.
import SwiftUI
import JikoKit

struct RulesView: View {
  @EnvironmentObject var state: AppState
  @State private var showPlaces = false

  var body: some View {
    NavigationStack {
      List {
        Section("On") {
          if state.triggers.isEmpty {
            Text("No rules yet. Turn one on below.").foregroundStyle(.secondary)
          }
          ForEach(state.triggers) { t in
            VStack(alignment: .leading, spacing: 4) {
              Toggle(isOn: Binding(get: { t.enabled }, set: { v in Task { await state.setTrigger(t, enabled: v) } })) {
                VStack(alignment: .leading, spacing: 2) {
                  Text(t.name)
                  Text("\(t.kind) · fired \(t.fire_count)×").font(.caption).foregroundStyle(.secondary)
                }
              }
              if let wrong = t.wrong_recently, wrong > 0 {
                Text("\(wrong) wrong this week\(t.wrong_limit.map { " of \($0)" } ?? "")")
                  .font(.caption2).foregroundStyle(.orange)
              }
              if let last = t.last_firing {
                Text("last time: \(last.reason)")
                  .font(.caption2).foregroundStyle(.tertiary)
              }
            }
            .swipeActions {
              Button("Delete", role: .destructive) { Task { await state.deleteTrigger(t) } }
            }
          }
        }

        Section("Turn on") {
          ForEach(state.presets.filter { $0.kind != "location" }) { p in
            VStack(alignment: .leading, spacing: 4) {
              HStack {
                Text(p.name).bold()
                Spacer()
                Button("Enable") { Task { await state.enablePreset(p.id) } }.buttonStyle(.borderless)
              }
              Text(p.description).font(.caption).foregroundStyle(.secondary)
            }
          }
        }

        Section("Places") {
          if state.places.isEmpty {
            Text("Save a place and Jiko can start something when you get there.")
              .font(.caption).foregroundStyle(.secondary)
          }
          ForEach(state.places) { p in
            VStack(alignment: .leading) {
              Text(p.name)
              Text("\(Int(p.radius_m))m radius").font(.caption).foregroundStyle(.secondary)
            }
            .swipeActions {
              Button("Delete", role: .destructive) { Task { await state.deletePlace(p) } }
            }
          }
          Button("Save where I am now") { showPlaces = true }
        }
      }
      .navigationTitle("Rules")
      .refreshable { await state.refreshAll() }
      .task { await state.refreshAll() }
      .sheet(isPresented: $showPlaces) { SavePlaceSheet() }
    }
  }
}

/// Name the spot you are standing in, and optionally wire the arrive/leave
/// rules to an activity in the same step.
struct SavePlaceSheet: View {
  @EnvironmentObject var state: AppState
  @Environment(\.dismiss) private var dismiss
  @State private var name = ""
  @State private var activityName = ""
  @State private var radius = 150.0
  @State private var busy = false
  @State private var error: String?

  var body: some View {
    NavigationStack {
      Form {
        Section("This place") {
          TextField("Library", text: $name)
          VStack(alignment: .leading) {
            Text("Radius: \(Int(radius))m").font(.caption).foregroundStyle(.secondary)
            Slider(value: $radius, in: 50...500, step: 25)
          }
          if state.location.last == nil {
            Text("No fix yet. Turn on location in Settings and give it a minute.")
              .font(.caption).foregroundStyle(.orange)
          }
        }
        Section("Start something when you arrive") {
          TextField("studying (optional)", text: $activityName)
          Text("Jiko starts the clock when you get here and stops it when you leave.")
            .font(.caption).foregroundStyle(.secondary)
        }
        if let error { Text(error).font(.caption).foregroundStyle(.red) }
      }
      .navigationTitle("Save a place")
      .toolbar {
        ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
        ToolbarItem(placement: .confirmationAction) {
          Button("Save") { save() }.disabled(busy || name.trimmingCharacters(in: .whitespaces).isEmpty)
        }
      }
    }
  }

  private func save() {
    busy = true; error = nil
    Task {
      do {
        let place = try await state.savePlaceHere(name: name.trimmingCharacters(in: .whitespaces), radius: Int(radius))
        let activity = activityName.trimmingCharacters(in: .whitespaces)
        if !activity.isEmpty {
          let a = try await state.createActivity(activity)
          await state.enablePreset("arrive", params: ["location_id": place.id, "activity_id": a.id])
          await state.enablePreset("leave", params: ["location_id": place.id, "activity_id": a.id])
        }
        await state.refreshAll()
        dismiss()
      } catch {
        self.error = error.localizedDescription
      }
      busy = false
    }
  }
}
