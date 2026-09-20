//  JikoMacOSAgentTests.swift
//  Model and API-client tests live in JikoKit's own suite; these cover what
//  only exists on the Mac.
import Testing
import Foundation
import JikoKit
@testable import JikoMacOSAgent

@MainActor
struct TrackerTests {
  @Test func flushReturnsNothingWhenIdle() {
    let t = UsageTracker()
    _ = t.flush()
    #expect(t.flush().isEmpty)
  }
}

struct FocusTests {
  @Test func readsAnActiveFocusFromAssertions() throws {
    let json = Data(#"{"data":[{"storeAssertionRecords":[{"assertionDetails":{"assertionDetailsModeIdentifier":"com.apple.focus.work"}}]}]}"#.utf8)
    #expect(FocusMonitor.parseAssertions(json) == .on(name: "Work"))
  }

  @Test func emptyRecordsMeanNoFocus() throws {
    let json = Data(#"{"data":[{"storeAssertionRecords":[]}]}"#.utf8)
    #expect(FocusMonitor.parseAssertions(json) == .off)
  }

  @Test func unreadableShapeIsUnknown() throws {
    #expect(FocusMonitor.parseAssertions(Data("not json".utf8)) == .unknown)
    #expect(FocusMonitor.parseAssertions(Data(#"{"other":1}"#.utf8)) == .unknown)
  }

  @Test func doNotDisturbGetsItsRealName() throws {
    #expect(FocusMonitor.prettyName("com.apple.donotdisturb.mode.default") == "Do Not Disturb")
    #expect(FocusMonitor.prettyName("com.apple.focus.sleep") == "Sleep")
  }
}

struct IMessageTests {
  @Test func escapesQuotesAndBackslashes() {
    #expect(IMessageSender.escape(#"say "hi" \ now"#) == #"say \"hi\" \\ now"#)
  }

  @Test func scriptAddressesTheRecipientAndKeepsTheBody() {
    let s = IMessageSender.script(body: #"30 min on "Instagram""#, recipient: "+15550101234")
    #expect(s.contains(#"participant "+15550101234""#))
    #expect(s.contains(#"send "30 min on \"Instagram\"""#))
    #expect(s.contains("service type = iMessage"))
  }
}
