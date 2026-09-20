//  JikoiOSAgentTests.swift
import Testing
import CoreLocation
import Foundation
@testable import JikoiOSAgent

@MainActor
struct LocationTrackerTests {
  @Test func firstFixIsAlwaysSent() {
    let t = LocationTracker()
    #expect(t.shouldSend(CLLocation(latitude: 40.7, longitude: -74.0)))
  }

  @Test func aFixThatBarelyMovedIsSkipped() {
    let t = LocationTracker()
    let now = Date()
    let first = CLLocation(latitude: 40.700000, longitude: -74.000000)
    t.markSent(first, at: now)
    // ~11 m north, seconds later
    let nudged = CLLocation(latitude: 40.700100, longitude: -74.000000)
    #expect(!t.shouldSend(nudged, now: now.addingTimeInterval(10)))
  }

  @Test func realMovementIsSent() {
    let t = LocationTracker()
    let now = Date()
    t.markSent(CLLocation(latitude: 40.700, longitude: -74.000), at: now)
    // ~500 m away
    #expect(t.shouldSend(CLLocation(latitude: 40.7045, longitude: -74.000), now: now.addingTimeInterval(20)))
  }

  @Test func sittingStillStillReportsEventually() {
    let t = LocationTracker()
    let now = Date()
    let here = CLLocation(latitude: 40.700, longitude: -74.000)
    t.markSent(here, at: now)
    #expect(t.shouldSend(here, now: now.addingTimeInterval(300)))
  }
}
