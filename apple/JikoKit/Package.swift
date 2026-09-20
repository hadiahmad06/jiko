// swift-tools-version: 6.0
import PackageDescription

// Shared between the macOS and iOS agents: the API client, the Codable mirrors
// of the backend's JSON, and the keychain wrapper. Nothing platform-specific
// lives here, so a new agent starts with the network layer already written.
let package = Package(
  name: "JikoKit",
  platforms: [.macOS(.v14), .iOS(.v17)],
  products: [
    .library(name: "JikoKit", targets: ["JikoKit"]),
  ],
  targets: [
    .target(name: "JikoKit"),
    .testTarget(name: "JikoKitTests", dependencies: ["JikoKit"]),
  ]
)
