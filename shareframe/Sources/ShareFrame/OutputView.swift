import AppKit

@MainActor
final class OutputView: NSView {
    private let imageLayer = CALayer()
    private var imagePixelSize: CGSize?
    private let messageStack = NSStackView()
    private let heading = NSTextField(labelWithString: "One region. One window.")
    private let detail = NSTextField(wrappingLabelWithString: "")
    private let primaryButton = NSButton(title: "Start Capture", target: nil, action: nil)
    private let settingsButton = NSButton(title: "Allow Screen Recording…", target: nil, action: nil)
    var onStart: (() -> Void)?
    var onSettings: (() -> Void)?

    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        wantsLayer = true
        layer?.backgroundColor = NSColor.black.cgColor
        imageLayer.contentsGravity = .topLeft
        imageLayer.magnificationFilter = .nearest
        imageLayer.minificationFilter = .nearest
        layer?.addSublayer(imageLayer)

        let icon = NSImageView(image: NSImage(systemSymbolName: "viewfinder", accessibilityDescription: nil)!)
        icon.contentTintColor = .systemRed
        icon.translatesAutoresizingMaskIntoConstraints = false
        icon.widthAnchor.constraint(equalToConstant: 42).isActive = true
        icon.heightAnchor.constraint(equalToConstant: 42).isActive = true
        icon.imageScaling = .scaleProportionallyUpOrDown
        heading.font = .systemFont(ofSize: 24, weight: .semibold)
        heading.textColor = .white
        heading.alignment = .center
        detail.font = .systemFont(ofSize: 14)
        detail.textColor = NSColor(calibratedWhite: 0.72, alpha: 1)
        detail.alignment = .center
        detail.maximumNumberOfLines = 0
        primaryButton.target = self
        primaryButton.action = #selector(start)
        primaryButton.bezelStyle = .rounded
        primaryButton.keyEquivalent = "\r"
        settingsButton.target = self
        settingsButton.action = #selector(settings)
        settingsButton.bezelStyle = .rounded
        messageStack.orientation = .vertical
        messageStack.alignment = .centerX
        messageStack.spacing = 20
        for view in [icon, heading, detail, primaryButton, settingsButton] { messageStack.addArrangedSubview(view) }
        messageStack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(messageStack)
        NSLayoutConstraint.activate([
            messageStack.centerXAnchor.constraint(equalTo: centerXAnchor),
            messageStack.centerYAnchor.constraint(equalTo: centerYAnchor),
            messageStack.widthAnchor.constraint(lessThanOrEqualTo: widthAnchor, constant: -40),
            detail.widthAnchor.constraint(lessThanOrEqualToConstant: 440)
        ])
        showMessage(title: "One region. One window.",
                    detail: "1. Start capture and allow screen recording.\n2. Move and resize the red frame.\n3. Share this window in your conferencing app:\n“ShareFrame – Screen Share”.",
                    button: "Start Capture")
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func layout() {
        super.layout()
        layoutImage()
    }

    override func viewDidChangeBackingProperties() {
        super.viewDidChangeBackingProperties()
        (window as? ShareWindow)?.refreshCaptureSize()
        layoutImage()
    }

    private func layoutImage() {
        let scale = window?.backingScaleFactor ?? 1
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        imageLayer.contentsScale = scale
        if let pixels = imagePixelSize {
            let size = CGSize(width: pixels.width / scale, height: pixels.height / scale)
            imageLayer.frame = CGRect(x: bounds.minX, y: bounds.maxY - size.height,
                                      width: size.width, height: size.height)
        } else {
            imageLayer.frame = bounds
        }
        CATransaction.commit()
    }

    func show(image: CGImage) {
        let pixels = CGSize(width: image.width, height: image.height)
        imagePixelSize = pixels
        (window as? ShareWindow)?.presentCapture(pixelSize: pixels)
        messageStack.isHidden = true
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        imageLayer.contents = image
        CATransaction.commit()
        layoutImage()
    }

    func clear() {
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        imageLayer.contents = nil
        CATransaction.commit()
    }

    func showMessage(title: String, detail text: String, button: String?, settings: Bool = false) {
        clear()
        imagePixelSize = nil
        (window as? ShareWindow)?.presentMessage()
        heading.stringValue = title
        detail.stringValue = text
        primaryButton.title = button ?? ""
        primaryButton.isHidden = button == nil
        settingsButton.isHidden = !settings
        messageStack.isHidden = false
    }

    @objc private func start() { onStart?() }
    @objc private func settings() { onSettings?() }
}
