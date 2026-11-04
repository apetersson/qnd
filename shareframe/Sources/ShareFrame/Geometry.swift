import CoreGraphics

/// All selection rectangles use AppKit's global, bottom-left screen coordinates.
enum SelectionGeometry {
    static let minimumSize = CGSize(width: 240, height: 160)

    static func clamped(_ rect: CGRect, to screen: CGRect) -> CGRect {
        let width = min(max(rect.width, minimumSize.width), screen.width)
        let height = min(max(rect.height, minimumSize.height), screen.height)
        return CGRect(
            x: min(max(rect.minX, screen.minX), screen.maxX - width),
            y: min(max(rect.minY, screen.minY), screen.maxY - height),
            width: width, height: height
        )
    }

    static func initial(in screen: CGRect) -> CGRect {
        let size = CGSize(width: min(960, screen.width * 0.65),
                          height: min(540, screen.height * 0.6))
        return clamped(CGRect(x: screen.midX - size.width / 2,
                              y: screen.midY - size.height / 2,
                              width: size.width, height: size.height), to: screen)
    }

    /// Core Image also uses a bottom-left origin. Translate into display-local
    /// coordinates before applying the *actual* buffer scale on each axis.
    static func pixelCrop(selection: CGRect, screen: CGRect, pixels: CGSize) -> CGRect {
        let local = selection.intersection(screen)
        guard !local.isNull, screen.width > 0, screen.height > 0 else { return .zero }
        let sx = pixels.width / screen.width
        let sy = pixels.height / screen.height
        // Round inwards so no pixels outside the marked rectangle can be shared.
        let left = ceil((local.minX - screen.minX) * sx)
        let bottom = ceil((local.minY - screen.minY) * sy)
        let right = floor((local.maxX - screen.minX) * sx)
        let top = floor((local.maxY - screen.minY) * sy)
        return CGRect(x: left, y: bottom, width: max(0, right - left), height: max(0, top - bottom))
    }

    static func resizeBottomRight(_ rect: CGRect, delta: CGPoint, screen: CGRect) -> CGRect {
        let width = min(max(minimumSize.width, rect.width + delta.x), screen.maxX - rect.minX)
        let height = min(max(minimumSize.height, rect.height - delta.y), rect.maxY - screen.minY)
        return CGRect(x: rect.minX, y: rect.maxY - height, width: width, height: height)
    }
}
