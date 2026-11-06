import AppKit

/// Keeps the shared content's backing store at the captured image's pixel size.
/// Large captures deliberately remain large instead of being fitted to a screen.
@MainActor
final class ShareWindow: NSWindow {
    private(set) var capturePixelSize: CGSize?
    private var messageSize = CGSize.zero
    private var messageMinimum = CGSize.zero
    private var wasResizable = false
    private var isUpdatingSize = false
    private var captureScale: CGFloat?

    func presentCapture(pixelSize: CGSize) {
        if capturePixelSize == nil {
            messageSize = contentView?.bounds.size ?? contentLayoutRect.size
            messageMinimum = contentMinSize
            wasResizable = styleMask.contains(.resizable)
            contentMinSize = .zero
            styleMask.remove(.resizable)
            standardWindowButton(.zoomButton)?.isEnabled = false
        }
        capturePixelSize = pixelSize
        refreshCaptureSize()
    }

    func presentMessage() {
        guard capturePixelSize != nil else { return }
        capturePixelSize = nil
        captureScale = nil
        if wasResizable { styleMask.insert(.resizable) }
        contentMinSize = messageMinimum
        standardWindowButton(.zoomButton)?.isEnabled = wasResizable
        setContentSize(messageSize)
    }

    func refreshCaptureSize() {
        guard !isUpdatingSize, let pixels = capturePixelSize else { return }
        isUpdatingSize = true
        defer {
            isUpdatingSize = false
            // A resize can move most of the window onto another display and
            // change its backing scale during setFrame. Reconcile once AppKit
            // finishes that change, even if the captured desktop is static.
            if capturePixelSize != nil, captureScale != backingScaleFactor {
                DispatchQueue.main.async { [weak self] in
                    self?.refreshCaptureSize()
                    self?.contentView?.needsLayout = true
                }
            }
        }

        // Convert using this window's backing store, which can differ from the
        // captured display's scale. A scale transition preserves the center to
        // avoid bouncing between two displays as the point dimensions change.
        let scaleChanged = captureScale != nil && captureScale != backingScaleFactor
        captureScale = backingScaleFactor
        let size = convertFromBacking(CGRect(origin: .zero, size: pixels)).size
        guard contentView?.bounds.size != size else { return }
        var next = frameRect(forContentRect: CGRect(origin: .zero, size: size))
        if scaleChanged {
            next.origin = CGPoint(x: frame.midX - next.width / 2, y: frame.midY - next.height / 2)
        } else {
            next.origin = CGPoint(x: frame.minX, y: frame.maxY - next.height)
        }
        setFrame(next, display: true)
    }

    override func constrainFrameRect(_ frameRect: NSRect, to screen: NSScreen?) -> NSRect {
        // The usual fit-to-display constraint must not silently change the
        // requested capture dimensions, including on a smaller output monitor.
        if capturePixelSize != nil { return frameRect }
        return super.constrainFrameRect(frameRect, to: screen)
    }

    override func zoom(_ sender: Any?) {
        if capturePixelSize == nil { super.zoom(sender) }
    }

    override func toggleFullScreen(_ sender: Any?) {
        // Full screen would impose the monitor's dimensions on the shared image.
    }
}
