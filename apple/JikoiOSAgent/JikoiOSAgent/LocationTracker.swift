//  LocationTracker.swift
//  Significant-change location updates: a few hundred metres of movement wakes
//  the app, including from the background, at roughly no battery cost. Good
//  enough for "you got to the library", which is all a geofence trigger needs.
import Foundation
import CoreLocation

@MainActor
final class LocationTracker: NSObject, ObservableObject, CLLocationManagerDelegate {
  @Published private(set) var authorization: CLAuthorizationStatus
  @Published private(set) var last: CLLocation?

  /// Called on every accepted fix. The agent forwards it to the backend.
  var onFix: ((CLLocation) -> Void)?

  private let manager = CLLocationManager()
  /// Don't spend a request on a fix that barely moved.
  private let minimumMetres: CLLocationDistance = 120
  private let minimumInterval: TimeInterval = 120
  private var lastSentAt: Date?

  override init() {
    authorization = CLLocationManager().authorizationStatus
    super.init()
    manager.delegate = self
    manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
    manager.pausesLocationUpdatesAutomatically = true
  }

  var isAuthorized: Bool {
    authorization == .authorizedAlways || authorization == .authorizedWhenInUse
  }

  func requestAccess() {
    // When-in-use first; iOS only offers Always after the app has been used.
    manager.requestWhenInUseAuthorization()
  }

  func requestAlways() { manager.requestAlwaysAuthorization() }

  func start() {
    guard isAuthorized else { return }
    manager.allowsBackgroundLocationUpdates = authorization == .authorizedAlways
    manager.startMonitoringSignificantLocationChanges()
    manager.requestLocation()
  }

  func stop() { manager.stopMonitoringSignificantLocationChanges() }

  /// A fix worth sending: far enough, or long enough, since the last one.
  func shouldSend(_ fix: CLLocation, now: Date = Date()) -> Bool {
    guard let previous = last, let sentAt = lastSentAt else { return true }
    if now.timeIntervalSince(sentAt) >= minimumInterval { return true }
    return fix.distance(from: previous) >= minimumMetres
  }

  func markSent(_ fix: CLLocation, at now: Date = Date()) {
    last = fix
    lastSentAt = now
  }

  nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
    let status = manager.authorizationStatus
    Task { @MainActor in
      self.authorization = status
      if self.isAuthorized { self.start() }
    }
  }

  nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
    guard let fix = locations.last else { return }
    Task { @MainActor in
      guard self.shouldSend(fix) else { return }
      self.markSent(fix)
      self.onFix?(fix)
    }
  }

  nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
    // A denied or transiently unavailable fix is not worth surfacing; the next
    // significant change will try again.
    print("[location] \(error.localizedDescription)")
  }
}
