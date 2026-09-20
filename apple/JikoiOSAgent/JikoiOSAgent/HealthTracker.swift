//  HealthTracker.swift
//  Steps and sleep, read once an hour. Two numbers, nothing else: they are
//  what the sleep-aware tone and a "you haven't moved all day" rule need.
import Foundation
import HealthKit
import JikoKit

@MainActor
final class HealthTracker: ObservableObject {
  @Published private(set) var authorized = false
  @Published private(set) var lastRead: Date?
  @Published private(set) var steps: Double?
  @Published private(set) var sleepMinutes: Double?

  private let store = HKHealthStore()

  var isAvailable: Bool { HKHealthStore.isHealthDataAvailable() }

  private var readTypes: Set<HKObjectType> {
    var types: Set<HKObjectType> = []
    if let steps = HKObjectType.quantityType(forIdentifier: .stepCount) { types.insert(steps) }
    if let sleep = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) { types.insert(sleep) }
    return types
  }

  func requestAccess() async {
    guard isAvailable else { return }
    do {
      try await store.requestAuthorization(toShare: [], read: readTypes)
      // HealthKit never reveals whether read access was granted; the honest
      // signal is whether a query comes back with anything.
      authorized = true
    } catch {
      print("[health] authorization failed: \(error.localizedDescription)")
    }
  }

  /// Steps since local midnight and sleep minutes from the last night, as one
  /// sample the backend can read with `health_metric`.
  func sample(now: Date = Date()) async -> HealthLog? {
    guard isAvailable else { return nil }
    let startOfDay = Calendar.current.startOfDay(for: now)
    async let stepCount = sumQuantity(.stepCount, unit: .count(), from: startOfDay, to: now)
    async let asleep = sleepMinutesBetween(from: startOfDay.addingTimeInterval(-6 * 3600), to: now)

    let (s, sleep) = await (stepCount, asleep)
    steps = s
    sleepMinutes = sleep
    lastRead = now
    guard s != nil || sleep != nil else { return nil }

    var values: [String: Double] = [:]
    if let s { values["steps"] = s }
    if let sleep { values["sleep_minutes"] = sleep }
    return HealthLog(timestamp: now.iso, start_time: startOfDay.iso, end_time: now.iso, values: values)
  }

  private func sumQuantity(_ id: HKQuantityTypeIdentifier, unit: HKUnit, from: Date, to: Date) async -> Double? {
    guard let type = HKQuantityType.quantityType(forIdentifier: id) else { return nil }
    let predicate = HKQuery.predicateForSamples(withStart: from, end: to, options: .strictStartDate)
    return await withCheckedContinuation { continuation in
      let q = HKStatisticsQuery(quantityType: type, quantitySamplePredicate: predicate, options: .cumulativeSum) { _, stats, _ in
        continuation.resume(returning: stats?.sumQuantity()?.doubleValue(for: unit))
      }
      store.execute(q)
    }
  }

  /// Minutes actually asleep in the window. Time in bed is not sleep.
  private func sleepMinutesBetween(from: Date, to: Date) async -> Double? {
    guard let type = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) else { return nil }
    let predicate = HKQuery.predicateForSamples(withStart: from, end: to, options: .strictStartDate)
    return await withCheckedContinuation { continuation in
      let q = HKSampleQuery(sampleType: type, predicate: predicate, limit: HKObjectQueryNoLimit, sortDescriptors: nil) { _, samples, _ in
        guard let samples = samples as? [HKCategorySample], !samples.isEmpty else {
          continuation.resume(returning: nil)
          return
        }
        let asleep: Set<Int> = [
          HKCategoryValueSleepAnalysis.asleepUnspecified.rawValue,
          HKCategoryValueSleepAnalysis.asleepCore.rawValue,
          HKCategoryValueSleepAnalysis.asleepDeep.rawValue,
          HKCategoryValueSleepAnalysis.asleepREM.rawValue,
        ]
        let seconds = samples
          .filter { asleep.contains($0.value) }
          .reduce(0.0) { $0 + $1.endDate.timeIntervalSince($1.startDate) }
        continuation.resume(returning: seconds > 0 ? seconds / 60 : nil)
      }
      store.execute(q)
    }
  }
}
