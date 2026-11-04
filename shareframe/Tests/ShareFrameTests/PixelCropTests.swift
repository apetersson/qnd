import XCTest
import CoreImage
import CoreVideo
@testable import ShareFrame

final class PixelCropTests: XCTestCase {
    func testBottomHalfOfScreenProducesBottomHalfOfPixelBuffer() throws {
        // A video buffer stores its top scanline first; AppKit and Core Image
        // expose bottom-left geometry. Verify that the actual rendering agrees.
        var optionalBuffer: CVPixelBuffer?
        let result = CVPixelBufferCreate(kCFAllocatorDefault, 8, 8, kCVPixelFormatType_32BGRA,
                                        [kCVPixelBufferCGImageCompatibilityKey: true] as CFDictionary,
                                        &optionalBuffer)
        XCTAssertEqual(result, kCVReturnSuccess)
        let buffer = try XCTUnwrap(optionalBuffer)
        CVPixelBufferLockBaseAddress(buffer, [])
        let bytes = try XCTUnwrap(CVPixelBufferGetBaseAddress(buffer)).assumingMemoryBound(to: UInt8.self)
        let stride = CVPixelBufferGetBytesPerRow(buffer)
        for row in 0..<8 {
            for column in 0..<8 {
                let offset = row * stride + column * 4
                bytes[offset] = row < 4 ? 0 : 255  // Blue: bottom half
                bytes[offset + 1] = 0
                bytes[offset + 2] = row < 4 ? 255 : 0  // Red: top half
                bytes[offset + 3] = 255
            }
        }
        CVPixelBufferUnlockBaseAddress(buffer, [])
        let crop = SelectionGeometry.pixelCrop(
            selection: CGRect(x: 0, y: 0, width: 8, height: 4),
            screen: CGRect(x: 0, y: 0, width: 8, height: 8),
            pixels: CGSize(width: 8, height: 8)
        )
        let image = try XCTUnwrap(CIContext().createCGImage(CIImage(cvPixelBuffer: buffer), from: crop))
        XCTAssertEqual(image.width, 8)
        XCTAssertEqual(image.height, 4)
        var rgba = [UInt8](repeating: 0, count: 8 * 4 * 4)
        try rgba.withUnsafeMutableBytes { storage in
            let context = try XCTUnwrap(CGContext(
                data: storage.baseAddress, width: 8, height: 4, bitsPerComponent: 8, bytesPerRow: 32,
                space: CGColorSpaceCreateDeviceRGB(),
                bitmapInfo: CGBitmapInfo.byteOrder32Big.rawValue | CGImageAlphaInfo.premultipliedLast.rawValue
            ))
            context.draw(image, in: CGRect(x: 0, y: 0, width: 8, height: 4))
        }
        XCTAssertLessThan(rgba[0], 5, "The bottom crop must not contain the red top half")
        XCTAssertGreaterThan(rgba[2], 250, "The bottom crop must contain the blue bottom half")
    }
}
