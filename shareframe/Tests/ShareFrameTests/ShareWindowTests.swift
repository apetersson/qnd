import AppKit
import XCTest
@testable import ShareFrame

final class ShareWindowTests: XCTestCase {
    private func checkerboard(width: Int, height: Int) throws -> CGImage {
        var bytes = [UInt8](repeating: 255, count: width * height * 4)
        for y in 0..<height {
            for x in 0..<width {
                let value: UInt8 = (x + y).isMultiple(of: 2) ? 0 : 255
                let offset = (y * width + x) * 4
                bytes[offset] = value
                bytes[offset + 1] = value
                bytes[offset + 2] = value
            }
        }
        let provider = try XCTUnwrap(CGDataProvider(data: Data(bytes) as CFData))
        return try XCTUnwrap(CGImage(width: width, height: height, bitsPerComponent: 8,
                                    bitsPerPixel: 32, bytesPerRow: width * 4,
                                    space: CGColorSpaceCreateDeviceRGB(),
                                    bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.premultipliedLast.rawValue),
                                    provider: provider, decode: nil, shouldInterpolate: false,
                                    intent: .defaultIntent))
    }

    @MainActor private func makeWindow() -> (ShareWindow, OutputView) {
        _ = NSApplication.shared
        let window = ShareWindow(contentRect: CGRect(x: 100, y: 100, width: 720, height: 450),
                                 styleMask: [.titled, .closable, .miniaturizable, .resizable],
                                 backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false
        window.contentMinSize = CGSize(width: 520, height: 380)
        let view = OutputView(frame: CGRect(x: 0, y: 0, width: 720, height: 450))
        window.contentView = view
        return (window, view)
    }

    func testOddSizedImageHasExactBackingDimensionsAndRestoresMessageWindow() async throws {
        let image = try checkerboard(width: 481, height: 321)
        await MainActor.run {
            let (window, view) = makeWindow()
            defer { window.close() }
            view.show(image: image)
            view.layoutSubtreeIfNeeded()
            XCTAssertEqual(view.convertToBacking(view.bounds).size, CGSize(width: 481, height: 321))
            XCTAssertFalse(window.styleMask.contains(.resizable))
            let captureFrame = window.frame
            window.zoom(nil)
            window.toggleFullScreen(nil)
            XCTAssertEqual(window.frame, captureFrame)
            view.viewDidChangeBackingProperties()
            XCTAssertEqual(view.convertToBacking(view.bounds).size, CGSize(width: 481, height: 321))

            view.showMessage(title: "Paused", detail: "Capture is paused.", button: "Resume")
            XCTAssertNil(window.capturePixelSize)
            XCTAssertTrue(window.styleMask.contains(.resizable))
            XCTAssertEqual(window.contentMinSize, CGSize(width: 520, height: 380))
            XCTAssertEqual(view.bounds.size, CGSize(width: 720, height: 450))
        }
    }

    func testOnePixelCheckerboardIsRenderedWithoutResampling() async throws {
        let width = 481
        let height = 321
        let image = try checkerboard(width: width, height: height)
        try await MainActor.run {
            let (window, view) = makeWindow()
            defer { window.close() }
            view.show(image: image)
            view.layoutSubtreeIfNeeded()
            var rendered = [UInt8](repeating: 0, count: width * height * 4)
            try rendered.withUnsafeMutableBytes { storage in
                let context = try XCTUnwrap(CGContext(
                    data: storage.baseAddress, width: width, height: height,
                    bitsPerComponent: 8, bytesPerRow: width * 4, space: CGColorSpaceCreateDeviceRGB(),
                    bitmapInfo: CGBitmapInfo.byteOrder32Big.rawValue | CGImageAlphaInfo.premultipliedLast.rawValue
                ))
                context.scaleBy(x: window.backingScaleFactor, y: window.backingScaleFactor)
                try XCTUnwrap(view.layer).render(in: context)
            }
            for y in 0..<height {
                for x in 0..<width {
                    let expected: UInt8 = (x + y).isMultiple(of: 2) ? 0 : 255
                    let offset = (y * width + x) * 4
                    guard rendered[offset] == expected,
                          rendered[offset + 1] == expected,
                          rendered[offset + 2] == expected,
                          rendered[offset + 3] == 255 else {
                        XCTFail("Pixel (\(x), \(y)) was changed: expected \(expected), got \(Array(rendered[offset..<offset + 4]))")
                        return
                    }
                }
            }
        }
    }

    func testCaptureLargerThanOutputDisplayIsNotFittedToScreen() async {
        await MainActor.run {
            let (window, view) = makeWindow()
            defer { window.close() }
            let screen = window.screen ?? NSScreen.screens[0]
            let pixels = CGSize(width: screen.frame.width * window.backingScaleFactor + 1024,
                                height: screen.frame.height * window.backingScaleFactor + 512)
            window.presentCapture(pixelSize: pixels)
            XCTAssertEqual(view.convertToBacking(view.bounds).size, pixels)
            XCTAssertGreaterThan(view.bounds.width, screen.frame.width)
            XCTAssertGreaterThan(view.bounds.height, screen.frame.height)
        }
    }
}
