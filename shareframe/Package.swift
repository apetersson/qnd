// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "ShareFrame",
    platforms: [.macOS(.v13)],
    products: [.executable(name: "ShareFrame", targets: ["ShareFrame"])],
    targets: [
        .executableTarget(name: "ShareFrame"),
        .testTarget(name: "ShareFrameTests", dependencies: ["ShareFrame"])
    ]
)
