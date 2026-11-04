import AppKit
import ScreenCaptureKit
import CoreImage
import CoreMedia

/// SCStream invokes this object exclusively on its serial queue. The full-display
/// frame never reaches the UI: only the cropped CGImage is handed to the main queue.
final class FrameReceiver: NSObject, SCStreamOutput, SCStreamDelegate {
    let queue = DispatchQueue(label: "at.andreas.shareframe.frames", qos: .userInteractive)
    private let context = CIContext(options: [.cacheIntermediates: false])
    private var selection: CGRect
    private let screen: CGRect
    private var revision: UInt64
    private var latestBuffer: CVPixelBuffer?
    private var active = true
    private var deliveryPending = false
    private var needsRender = false
    var onFrame: ((CGImage?, UInt64) -> Void)?
    var onError: ((Error) -> Void)?

    init(selection: CGRect, screen: CGRect, revision: UInt64) {
        self.selection = selection
        self.screen = screen
        self.revision = revision
    }

    func update(selection: CGRect, revision: UInt64) {
        queue.async { [self] in
            self.selection = selection
            self.revision = revision
            needsRender = true
            // A still desktop may not produce another complete frame after a move.
            renderLatest()
        }
    }

    func invalidate() {
        queue.async { [self] in
            active = false
            latestBuffer = nil
            needsRender = false
        }
    }

    func stream(_ stream: SCStream, didOutputSampleBuffer sampleBuffer: CMSampleBuffer,
                of type: SCStreamOutputType) {
        guard type == .screen else { return }
        process(sampleBuffer)
    }

    /// Called on `queue`, including by buffer-level regression tests.
    func process(_ sampleBuffer: CMSampleBuffer) {
        guard active, sampleBuffer.isValid,
              let attachments = CMSampleBufferGetSampleAttachmentsArray(sampleBuffer, createIfNecessary: false)
                as? [[SCStreamFrameInfo: Any]],
              let status = attachments.first?[.status] as? Int,
              let frameStatus = SCFrameStatus(rawValue: status) else { return }
        switch frameStatus {
        case .complete:
            guard let buffer = sampleBuffer.imageBuffer else { return }
            latestBuffer = buffer
        case .blank, .suspended, .stopped:
            // An unavailable display is different from an unchanged desktop.
            // Clear both the output and the cache so moving the selection cannot
            // bring back a frame from before the interruption.
            latestBuffer = nil
        case .idle, .started:
            return
        @unknown default:
            latestBuffer = nil
        }
        needsRender = true
        renderLatest()
    }

    private func renderLatest() {
        // Menus and window drags can hold up the main queue. Keep at most one
        // rendered image in flight instead of accumulating 30 images per second.
        guard active, !deliveryPending, needsRender else { return }
        let image: CGImage?
        if let buffer = latestBuffer {
            let crop = SelectionGeometry.pixelCrop(
                selection: selection, screen: screen,
                pixels: CGSize(width: CVPixelBufferGetWidth(buffer), height: CVPixelBufferGetHeight(buffer))
            )
            guard crop.width > 0, crop.height > 0,
                  let cropped = context.createCGImage(CIImage(cvPixelBuffer: buffer), from: crop) else { return }
            image = cropped
        } else {
            image = nil
        }
        let currentRevision = revision
        needsRender = false
        deliveryPending = true
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            self.onFrame?(image, currentRevision)
            self.queue.async {
                self.deliveryPending = false
                self.renderLatest()
            }
        }
    }

    func stream(_ stream: SCStream, didStopWithError error: Error) {
        DispatchQueue.main.async { [weak self] in self?.onError?(error) }
    }
}

@MainActor
final class CaptureEngine {
    private var stream: SCStream?
    private var receiver: FrameReceiver?
    private var selection = CGRect.zero
    private var epoch: UInt64 = 0
    private(set) var revision: UInt64 = 0
    var onFrame: ((CGImage?) -> Void)?
    var onError: ((Error) -> Void)?

    func update(selection: CGRect) {
        self.selection = selection
        revision &+= 1
        receiver?.update(selection: selection, revision: revision)
    }

    func stop() {
        epoch &+= 1
        revision &+= 1
        receiver?.invalidate()
        receiver = nil
        if let oldStream = stream {
            stream = nil
            Task { try? await oldStream.stopCapture() }
        }
    }

    func start(screen: NSScreen, selection: CGRect) async throws {
        stop()
        self.selection = selection
        let currentEpoch = epoch
        let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true)
        guard epoch == currentEpoch else { return }
        guard let display = content.displays.first(where: { $0.displayID == screen.displayID }) else {
            throw CaptureError.displayUnavailable
        }
        // Exclude the entire application, including the output window, toolbar,
        // and every border panel. This prevents recursive capture even on overlap.
        guard let ownApp = content.applications.first(where: { $0.processID == getpid() }) else {
            throw CaptureError.applicationUnavailable
        }
        let filter = SCContentFilter(display: display, excludingApplications: [ownApp], exceptingWindows: [])
        let configuration = SCStreamConfiguration()
        configuration.width = Int(screen.frame.width * screen.backingScaleFactor)
        configuration.height = Int(screen.frame.height * screen.backingScaleFactor)
        configuration.minimumFrameInterval = CMTime(value: 1, timescale: 30)
        configuration.pixelFormat = kCVPixelFormatType_32BGRA
        configuration.queueDepth = 3
        configuration.showsCursor = true
        configuration.capturesAudio = false
        configuration.colorSpaceName = CGColorSpace.sRGB

        let output = FrameReceiver(selection: self.selection, screen: screen.frame, revision: revision)
        output.onFrame = { [weak self] image, frameRevision in
            guard let self, self.epoch == currentEpoch, self.revision == frameRevision else { return }
            self.onFrame?(image)
        }
        output.onError = { [weak self] error in
            guard let self, self.epoch == currentEpoch else { return }
            self.stop()
            self.onError?(error)
        }
        let newStream = SCStream(filter: filter, configuration: configuration, delegate: output)
        try newStream.addStreamOutput(output, type: .screen, sampleHandlerQueue: output.queue)
        receiver = output
        stream = newStream
        do {
            try await newStream.startCapture()
            // Pause/monitor switches may have happened while permission or start
            // was pending. A superseded stream must never resume by itself.
            if epoch != currentEpoch { try? await newStream.stopCapture() }
        } catch {
            if epoch == currentEpoch { stop() }
            throw error
        }
    }

    enum CaptureError: LocalizedError {
        case displayUnavailable, applicationUnavailable
        var errorDescription: String? {
            switch self {
            case .displayUnavailable: return "Der ausgewählte Bildschirm ist nicht mehr verfügbar."
            case .applicationUnavailable: return "ShareFrame konnte seine eigenen Fenster nicht von der Aufnahme ausschließen. Bitte starte die App erneut."
            }
        }
    }
}

extension NSScreen {
    var displayID: CGDirectDisplayID {
        (deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? NSNumber)?.uint32Value ?? 0
    }
}
