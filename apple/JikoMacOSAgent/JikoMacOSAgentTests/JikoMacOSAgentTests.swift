//  JikoMacOSAgentTests.swift
import Testing
import Foundation
@testable import JikoMacOSAgent

struct ModelTests {
  @Test func appUsagePayloadMatchesBackendShape() throws {
    let log = AppUsageLog(bundleId: "com.x", timestamp: "2026-09-08T12:00:00.000Z", appName: "X", startTime: "2026-09-08T11:30:00.000Z", durationSeconds: 1800, category: nil, isForeground: true, windowTitle: nil)
    let p = AppUsagePayload(timestamp: "2026-09-08T12:00:00.000Z", device_id: "d", log: [log])
    let json = try JSONSerialization.jsonObject(with: JSONEncoder().encode(p)) as! [String: Any]
    #expect(json["platform"] as? String == "macos")
    #expect(json["device_id"] as? String == "d")
    let first = (json["log"] as! [[String: Any]])[0]
    #expect(Set(first.keys) == ["bundleId", "timestamp", "appName", "startTime", "durationSeconds", "isForeground"])
  }

  @Test func messageDecodesWithFractionalSeconds() throws {
    let data = Data(#"{"id":"a","user_id":"u","direction":"outbound","channel":"agent","body":"hi","status":"queued","created_at":"2026-09-08T12:00:00.123Z"}"#.utf8)
    let m = try JSONDecoder().decode(Message.self, from: data)
    #expect(m.isFromJiko)
    #expect(Calendar(identifier: .gregorian).component(.year, from: m.createdDate) == 2026)
  }

  @Test func dictionaryBodiesEncode() throws {
    let body: [String: Any] = ["ids": ["a", "b"], "status": "delivered", "n": 3, "f": true]
    let data = try JikoAPI.encodeBody(body)
    let back = try JSONSerialization.jsonObject(with: data) as! [String: Any]
    #expect((back["ids"] as! [String]) == ["a", "b"])
    #expect(back["n"] as? Int == 3)
    #expect(back["f"] as? Bool == true)
  }
}

@MainActor
struct TrackerTests {
  @Test func flushReturnsNothingWhenIdle() {
    let t = UsageTracker()
    _ = t.flush()
    #expect(t.flush().isEmpty)
  }
}
