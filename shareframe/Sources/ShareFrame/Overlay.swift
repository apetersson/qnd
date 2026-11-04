import AppKit

@MainActor
final class OverlayController {
    private var panels: [NSPanel] = []
    private let toolbar: NSPanel
    private let sizeLabel = NSTextField(labelWithString: "")
    private let pauseButton = NSButton()
    private let screenButton = NSButton()
    private var selection: CGRect = .zero
    private var screenFrame: CGRect = .zero
    private var dragOrigin = CGPoint.zero
    private var originalSelection = CGRect.zero
    private var isVisible = false
    var onChange: ((CGRect) -> Void)?
    var onPause: (() -> Void)?
    var onShowOutput: (() -> Void)?
    var onScreenMenu: ((NSView) -> Void)?

    init() {
        toolbar = Self.panel()
        for index in 0..<5 {
            let panel = Self.panel()
            let view = DragSurface()
            view.resize = index == 4
            view.onBegin = { [weak self] point in
                guard let self else { return }
                self.dragOrigin = point
                self.originalSelection = self.selection
            }
            view.onDrag = { [weak self] point, resize in self?.drag(to: point, resize: resize) }
            panel.contentView = view
            panels.append(panel)
        }
        let background = ToolbarSurface()
        background.onBegin = { [weak self] point in
            guard let self else { return }
            self.dragOrigin = point
            self.originalSelection = self.selection
        }
        background.onDrag = { [weak self] point, _ in self?.drag(to: point, resize: false) }
        toolbar.contentView = background
        let moveIcon = NSImageView(image: NSImage(systemSymbolName: "arrow.up.and.down.and.arrow.left.and.right", accessibilityDescription: "Move Frame")!)
        moveIcon.contentTintColor = .white
        moveIcon.setContentHuggingPriority(.required, for: .horizontal)
        sizeLabel.font = .monospacedDigitSystemFont(ofSize: 11, weight: .medium)
        sizeLabel.textColor = .white
        sizeLabel.toolTip = "Drag this bar or the red border to move the region."
        configure(pauseButton, symbol: "pause.fill", tip: "Pause / Resume Capture", action: #selector(togglePause))
        let outputButton = NSButton()
        configure(outputButton, symbol: "macwindow", tip: "Show Share Window", action: #selector(showOutput))
        configure(screenButton, symbol: "display", tip: "Display and Frame Options", action: #selector(showScreenMenu))
        let stack = NSStackView(views: [moveIcon, sizeLabel, pauseButton, outputButton, screenButton])
        stack.spacing = 10
        stack.alignment = .centerY
        stack.translatesAutoresizingMaskIntoConstraints = false
        background.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: background.leadingAnchor, constant: 12),
            stack.trailingAnchor.constraint(equalTo: background.trailingAnchor, constant: -10),
            stack.centerYAnchor.constraint(equalTo: background.centerYAnchor),
            moveIcon.widthAnchor.constraint(equalToConstant: 14),
            sizeLabel.widthAnchor.constraint(equalToConstant: 112)
        ])
    }

    private func configure(_ button: NSButton, symbol: String, tip: String, action: Selector) {
        button.image = NSImage(systemSymbolName: symbol, accessibilityDescription: tip)
        button.contentTintColor = .white
        button.isBordered = false
        button.target = self
        button.action = action
        button.toolTip = tip
        button.setAccessibilityLabel(tip)
        button.translatesAutoresizingMaskIntoConstraints = false
        button.widthAnchor.constraint(equalToConstant: 24).isActive = true
        button.heightAnchor.constraint(equalToConstant: 24).isActive = true
    }

    private static func panel() -> NSPanel {
        let panel = NSPanel(contentRect: .zero, styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
        panel.isOpaque = false
        panel.backgroundColor = .clear
        panel.hasShadow = false
        panel.level = .floating
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .stationary]
        panel.hidesOnDeactivate = false
        panel.isReleasedWhenClosed = false
        panel.isMovable = false
        panel.animationBehavior = .none
        return panel
    }

    func update(selection: CGRect, screen: CGRect) {
        self.selection = selection
        self.screenFrame = screen
        let r = selection
        let t: CGFloat = 4
        let frames = [
            CGRect(x: r.minX - t, y: r.maxY, width: r.width + 2 * t, height: t),
            CGRect(x: r.minX - t, y: r.minY - t, width: t, height: r.height + t),
            CGRect(x: r.maxX, y: r.minY - t, width: t, height: r.height + t),
            CGRect(x: r.minX - t, y: r.minY - t, width: r.width + 2 * t, height: t),
            CGRect(x: r.maxX - 10, y: r.minY - 6, width: 16, height: 16)
        ]
        for (panel, frame) in zip(panels, frames) { panel.setFrame(frame, display: true) }
        sizeLabel.stringValue = "\(Int(r.width)) × \(Int(r.height)) pt"
        let width: CGFloat = 260
        let height: CGFloat = 34
        var y = r.maxY + 10
        if y + height > screen.maxY { y = r.minY - height - 10 }
        if y < screen.minY { y = min(r.maxY - height - 10, screen.maxY - height) }
        toolbar.setFrame(CGRect(x: min(max(r.minX, screen.minX), screen.maxX - width),
                                y: y, width: width, height: height), display: true)
    }

    func setVisible(_ visible: Bool) {
        isVisible = visible
        for panel in panels + [toolbar] {
            if visible { panel.orderFrontRegardless() } else { panel.orderOut(nil) }
        }
    }

    func setPaused(_ paused: Bool) {
        pauseButton.image = NSImage(systemSymbolName: paused ? "play.fill" : "pause.fill", accessibilityDescription: paused ? "Resume" : "Pause")
        for panel in panels {
            (panel.contentView as? DragSurface)?.paused = paused
            panel.contentView?.needsDisplay = true
        }
    }

    private func drag(to point: CGPoint, resize: Bool) {
        let delta = CGPoint(x: point.x - dragOrigin.x, y: point.y - dragOrigin.y)
        let next: CGRect
        if resize {
            next = SelectionGeometry.resizeBottomRight(originalSelection, delta: delta, screen: screenFrame)
        } else {
            next = SelectionGeometry.clamped(originalSelection.offsetBy(dx: delta.x, dy: delta.y), to: screenFrame)
        }
        onChange?(next)
    }

    @objc private func togglePause() { onPause?() }
    @objc private func showOutput() { onShowOutput?() }
    @objc private func showScreenMenu() { onScreenMenu?(screenButton) }
}

@MainActor
private class DragSurface: NSView {
    var resize = false
    var paused = false
    var onBegin: ((CGPoint) -> Void)?
    var onDrag: ((CGPoint, Bool) -> Void)?

    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }
    override func resetCursorRects() {
        addCursorRect(bounds, cursor: resize ? .crosshair : .openHand)
    }
    override func mouseDown(with event: NSEvent) {
        onBegin?(NSEvent.mouseLocation)
        if !resize { NSCursor.closedHand.push() }
    }
    override func mouseDragged(with event: NSEvent) { onDrag?(NSEvent.mouseLocation, resize) }
    override func mouseUp(with event: NSEvent) {
        onDrag?(NSEvent.mouseLocation, resize)
        if !resize { NSCursor.pop() }
    }
    override func draw(_ dirtyRect: NSRect) {
        (paused ? NSColor.systemOrange : NSColor.systemRed).setFill()
        if resize {
            NSBezierPath(roundedRect: bounds.insetBy(dx: 1, dy: 1), xRadius: 4, yRadius: 4).fill()
            NSColor.white.setStroke()
            let lines = NSBezierPath()
            for offset: CGFloat in [0, 4] {
                lines.move(to: NSPoint(x: 5 + offset, y: 4))
                lines.line(to: NSPoint(x: 12, y: 11 - offset))
            }
            lines.lineWidth = 1
            lines.stroke()
        } else { bounds.fill() }
    }
}

@MainActor
private final class ToolbarSurface: DragSurface {
    override func draw(_ dirtyRect: NSRect) {
        NSColor(calibratedWhite: 0.10, alpha: 0.96).setFill()
        NSBezierPath(roundedRect: bounds, xRadius: 9, yRadius: 9).fill()
    }
}
