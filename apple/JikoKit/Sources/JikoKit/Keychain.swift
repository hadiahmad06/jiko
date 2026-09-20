//  Keychain.swift
//  Minimal SecItem wrapper for the two tokens. Nothing else is stored here.
//  `service` defaults to the host app's bundle id, so the macOS and iOS agents
//  keep separate tokens on the same iCloud keychain.
import Foundation
import Security

public enum Keychain {
  /// The host app's bundle id, so the macOS and iOS agents keep separate
  /// tokens. Immutable, which keeps it Sendable under strict concurrency.
  public static let service: String = Bundle.main.bundleIdentifier ?? "com.hadiahmad.Jiko"

  public static func set(_ value: String, for key: String) {
    let data = Data(value.utf8)
    let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: key]
    SecItemDelete(query as CFDictionary)
    var add = query
    add[kSecValueData as String] = data
    add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
    SecItemAdd(add as CFDictionary, nil)
  }

  public static func get(_ key: String) -> String? {
    let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: key,
                                kSecReturnData as String: true, kSecMatchLimit as String: kSecMatchLimitOne]
    var out: AnyObject?
    guard SecItemCopyMatching(query as CFDictionary, &out) == errSecSuccess, let data = out as? Data else { return nil }
    return String(data: data, encoding: .utf8)
  }

  public static func delete(_ key: String) {
    let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: key]
    SecItemDelete(query as CFDictionary)
  }
}
