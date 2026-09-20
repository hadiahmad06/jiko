import Testing
import Foundation
@testable import JikoKit

struct PayloadTests {
  @Test func appUsagePayloadMatchesBackendShape() throws {
    let log = AppUsageLog(bundleId: "com.x", timestamp: "2026-09-08T12:00:00.000Z", appName: "X",
                          startTime: "2026-09-08T11:30:00.000Z", durationSeconds: 1800, isForeground: true)
    let p = AppUsagePayload(timestamp: "2026-09-08T12:00:00.000Z", platform: "ios", device_id: "d", log: [log])
    let json = try JSONSerialization.jsonObject(with: JSONEncoder().encode(p)) as! [String: Any]
    #expect(json["platform"] as? String == "ios")
    let first = (json["log"] as! [[String: Any]])[0]
    #expect(Set(first.keys) == ["bundleId", "timestamp", "appName", "startTime", "durationSeconds", "isForeground"])
  }

  @Test func locationPayloadCarriesAccuracyAsRadius() throws {
    let p = LocationPayload(timestamp: "2026-09-08T12:00:00.000Z", platform: "ios", device_id: "d",
                            latitude: 40.7, longitude: -74.0, radius: 12.5, altitude: 30)
    let json = try JSONSerialization.jsonObject(with: JSONEncoder().encode(p)) as! [String: Any]
    #expect(json["latitude"] as? Double == 40.7)
    #expect(json["radius"] as? Double == 12.5)
    #expect(json["altitude"] as? Double == 30)
  }

  @Test func healthLogFlattensItsMetrics() throws {
    let log = HealthLog(timestamp: "2026-09-08T12:00:00.000Z", start_time: "2026-09-08T00:00:00.000Z",
                        end_time: "2026-09-08T12:00:00.000Z", values: ["steps": 4210, "sleep_minutes": 287])
    let json = try JSONSerialization.jsonObject(with: JSONEncoder().encode(log)) as! [String: Any]
    #expect(json["steps"] as? Double == 4210)
    #expect(json["sleep_minutes"] as? Double == 287)
    #expect(json["values"] == nil)      // flattened, not nested
  }

  @Test func healthLogRoundTrips() throws {
    let log = HealthLog(timestamp: "t", start_time: "s", end_time: "e", values: ["steps": 10])
    let back = try JSONDecoder().decode(HealthLog.self, from: JSONEncoder().encode(log))
    #expect(back.values["steps"] == 10)
    #expect(back.end_time == "e")
  }

  @Test func messageDecodesWithFractionalSeconds() throws {
    let data = Data(#"{"id":"a","user_id":"u","direction":"outbound","channel":"agent","body":"hi","status":"queued","created_at":"2026-09-08T12:00:00.123Z"}"#.utf8)
    let m = try JSONDecoder().decode(Message.self, from: data)
    #expect(m.isFromJiko)
    #expect(Calendar(identifier: .gregorian).component(.year, from: m.createdDate) == 2026)
  }

  @Test func dictionaryBodiesEncode() throws {
    let body: [String: Any] = ["ids": ["a", "b"], "status": "delivered", "n": 3, "f": true]
    let back = try JSONSerialization.jsonObject(with: JikoAPI.encodeBody(body)) as! [String: Any]
    #expect((back["ids"] as! [String]) == ["a", "b"])
    #expect(back["n"] as? Int == 3)
  }
}
