import XCTest
import CoreMedia
import CoreVideo
import ScreenCaptureKit
@testable import ShareFrame

final class FrameReceiverTests: XCTestCase {
    private func sample(status: SCFrameStatus) throws -> CMSampleBuffer {
        var buffer: CVPixelBuffer?
        XCTAssertEqual(CVPixelBufferCreate(kCFAllocatorDefault, 8, 8, kCVPixelFormatType_32BGRA,
                                          nil, &buffer), kCVReturnSuccess)
        let pixels = try XCTUnwrap(buffer)
        var format: CMVideoFormatDescription?
        XCTAssertEqual(CMVideoFormatDescriptionCreateForImageBuffer(allocator: kCFAllocatorDefault,
                                                                   imageBuffer: pixels,
                                                                   formatDescriptionOut: &format), noErr)
        var timing = CMSampleTimingInfo(duration: CMTime(value: 1, timescale: 30),
                                       presentationTimeStamp: .zero, decodeTimeStamp: .invalid)
        var result: CMSampleBuffer?
        XCTAssertEqual(CMSampleBufferCreateReadyWithImageBuffer(allocator: kCFAllocatorDefault,
                                                               imageBuffer: pixels,
                                                               formatDescription: try XCTUnwrap(format),
                                                               sampleTiming: &timing,
                                                               sampleBufferOut: &result), noErr)
        let sample = try XCTUnwrap(result)
        let attachments = try XCTUnwrap(CMSampleBufferGetSampleAttachmentsArray(sample, createIfNecessary: true)
                                        as? [NSMutableDictionary])
        attachments[0][SCStreamFrameInfo.status.rawValue] = status.rawValue
        return sample
    }

    private func receiver() -> FrameReceiver {
        FrameReceiver(selection: CGRect(x: 0, y: 0, width: 4, height: 4),
                      screen: CGRect(x: 0, y: 0, width: 8, height: 8), revision: 0)
    }

    func testUnavailableStatusesClearImageAndCache() throws {
        for status in [SCFrameStatus.blank, .suspended, .stopped] {
            let receiver = receiver()
            let first = expectation(description: "initial frame \(status)")
            receiver.onFrame = { image, _ in
                XCTAssertNotNil(image)
                first.fulfill()
            }
            let complete = try sample(status: .complete)
            receiver.queue.async { receiver.process(complete) }
            wait(for: [first], timeout: 3)

            let cleared = expectation(description: "clear output \(status)")
            receiver.onFrame = { image, _ in
                XCTAssertNil(image)
                cleared.fulfill()
            }
            let unavailable = try sample(status: status)
            receiver.queue.async { receiver.process(unavailable) }
            wait(for: [cleared], timeout: 3)

            let moved = expectation(description: "cache stays empty after move \(status)")
            receiver.onFrame = { image, revision in
                XCTAssertNil(image)
                XCTAssertEqual(revision, 1)
                moved.fulfill()
            }
            receiver.update(selection: CGRect(x: 4, y: 4, width: 4, height: 4), revision: 1)
            wait(for: [moved], timeout: 3)
            receiver.invalidate()
        }
    }

    func testIdleKeepsStaticDesktopAvailableForSelectionMove() throws {
        let receiver = receiver()
        let initial = expectation(description: "initial complete frame")
        receiver.onFrame = { image, _ in
            XCTAssertNotNil(image)
            initial.fulfill()
        }
        let complete = try sample(status: .complete)
        receiver.queue.async { receiver.process(complete) }
        wait(for: [initial], timeout: 3)
        let idle = try sample(status: .idle)
        receiver.queue.async { receiver.process(idle) }
        let moved = expectation(description: "recrop static desktop")
        receiver.onFrame = { image, revision in
            XCTAssertNotNil(image)
            XCTAssertEqual(revision, 1)
            moved.fulfill()
        }
        receiver.update(selection: CGRect(x: 4, y: 4, width: 4, height: 4), revision: 1)
        wait(for: [moved], timeout: 3)
        receiver.invalidate()
    }
}
