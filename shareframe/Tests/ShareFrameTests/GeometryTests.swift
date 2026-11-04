import XCTest
@testable import ShareFrame

final class GeometryTests: XCTestCase {
    func testCropOnRetinaMainDisplay() {
        let crop = SelectionGeometry.pixelCrop(
            selection: CGRect(x: 100, y: 200, width: 300, height: 160),
            screen: CGRect(x: 0, y: 0, width: 1440, height: 900),
            pixels: CGSize(width: 2880, height: 1800)
        )
        XCTAssertEqual(crop, CGRect(x: 200, y: 400, width: 600, height: 320))
    }

    func testCropOnDisplayToLeftAndAbovePrimary() {
        let screen = CGRect(x: -1920, y: 900, width: 1920, height: 1080)
        let crop = SelectionGeometry.pixelCrop(
            selection: CGRect(x: -1800, y: 1000, width: 640, height: 480),
            screen: screen, pixels: CGSize(width: 1920, height: 1080)
        )
        XCTAssertEqual(crop, CGRect(x: 120, y: 100, width: 640, height: 480))
    }

    func testCropRoundsInwardWithoutSharingAdjacentPixels() {
        let crop = SelectionGeometry.pixelCrop(
            selection: CGRect(x: 10.2, y: 20.2, width: 240.2, height: 160.2),
            screen: CGRect(x: 0, y: 0, width: 1000, height: 1000),
            pixels: CGSize(width: 1500, height: 1500)
        )
        XCTAssertEqual(crop, CGRect(x: 16, y: 31, width: 359, height: 239))
    }

    func testSelectionCannotCrossDisplayBoundary() {
        let screen = CGRect(x: -1920, y: 0, width: 1920, height: 1080)
        let rect = SelectionGeometry.clamped(CGRect(x: -100, y: 1000, width: 640, height: 480), to: screen)
        XCTAssertEqual(rect, CGRect(x: -640, y: 600, width: 640, height: 480))
    }

    func testOversizedSelectionFitsSmallerDisplay() {
        XCTAssertEqual(
            SelectionGeometry.clamped(CGRect(x: 0, y: 0, width: 2000, height: 1200),
                                      to: CGRect(x: 100, y: -600, width: 800, height: 600)),
            CGRect(x: 100, y: -600, width: 800, height: 600)
        )
    }

    func testResizeKeepsTopLeftAnchoredAndClampsBothEdges() {
        let rect = CGRect(x: 100, y: 200, width: 640, height: 480)
        let screen = CGRect(x: 0, y: 0, width: 1000, height: 800)
        let enlarged = SelectionGeometry.resizeBottomRight(rect, delta: CGPoint(x: 1000, y: -1000), screen: screen)
        XCTAssertEqual(enlarged, CGRect(x: 100, y: 0, width: 900, height: 680))
        let shrunk = SelectionGeometry.resizeBottomRight(rect, delta: CGPoint(x: -1000, y: 1000), screen: screen)
        XCTAssertEqual(shrunk, CGRect(x: 100, y: 520, width: 240, height: 160))
    }

    func testNonIntersectingCropIsEmpty() {
        let crop = SelectionGeometry.pixelCrop(
            selection: CGRect(x: 2000, y: 0, width: 300, height: 200),
            screen: CGRect(x: 0, y: 0, width: 1000, height: 800),
            pixels: CGSize(width: 2000, height: 1600)
        )
        XCTAssertEqual(crop, .zero)
    }
}
