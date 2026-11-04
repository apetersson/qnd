import AppKit

@main
struct ShareFrameApp {
    @MainActor static func main() {
        let app = NSApplication.shared
        let delegate = AppController()
        app.delegate = delegate
        app.setActivationPolicy(.regular)
        app.run()
        withExtendedLifetime(delegate) {}
    }
}

@MainActor
final class AppController: NSObject, NSApplicationDelegate, NSWindowDelegate, NSMenuDelegate {
    private enum Phase { case ready, starting, live, paused, failed }
    private let capture = CaptureEngine()
    private let overlay = OverlayController()
    private let output = OutputView(frame: CGRect(x: 0, y: 0, width: 720, height: 450))
    private var window: NSWindow!
    private var statusItem: NSStatusItem!
    private var selectedScreen: NSScreen!
    private var selection = CGRect.zero
    private var phase = Phase.ready
    private var actionID = 0
    private var frameVisible = true
    private var isRunning: Bool { phase == .live || phase == .starting }

    func applicationDidFinishLaunching(_ notification: Notification) {
        installMenu()
        selectedScreen = NSScreen.main ?? NSScreen.screens.first!
        selection = restoredSelection(on: selectedScreen)
        window = NSWindow(contentRect: CGRect(x: 0, y: 0, width: 720, height: 450),
                          styleMask: [.titled, .closable, .miniaturizable, .resizable],
                          backing: .buffered, defer: false)
        window.title = "ShareFrame – Freigabe"
        window.contentMinSize = NSSize(width: 520, height: 380)
        window.backgroundColor = .black
        window.isReleasedWhenClosed = false
        window.delegate = self
        window.contentView = output
        window.setFrameAutosaveName("ShareFrameOutput")
        window.center()
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)

        overlay.update(selection: selection, screen: selectedScreen.frame)
        overlay.onChange = { [weak self] rect in self?.changeSelection(rect) }
        overlay.onPause = { [weak self] in self?.toggleCapture() }
        overlay.onShowOutput = { [weak self] in self?.showOutput() }
        overlay.onScreenMenu = { [weak self] view in self?.showScreenMenu(from: view) }
        output.onStart = { [weak self] in self?.startCapture() }
        output.onSettings = {
            NSWorkspace.shared.open(URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture")!)
        }
        capture.onFrame = { [weak self] image in
            guard let self, self.isRunning else { return }
            if let image { self.output.show(image: image) } else { self.output.clear() }
        }
        capture.onError = { [weak self] error in self?.captureFailed(error) }
        NotificationCenter.default.addObserver(self, selector: #selector(screensChanged),
                                               name: NSApplication.didChangeScreenParametersNotification, object: nil)
        NSWorkspace.shared.notificationCenter.addObserver(self, selector: #selector(willSleep),
                                                          name: NSWorkspace.sessionDidResignActiveNotification, object: nil)
        NSWorkspace.shared.notificationCenter.addObserver(self, selector: #selector(willSleep),
                                                          name: NSWorkspace.willSleepNotification, object: nil)
    }

    private func installMenu() {
        let main = NSMenu()
        let appItem = NSMenuItem()
        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "Über ShareFrame", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Aufnahme pausieren / fortsetzen", action: #selector(toggleCapture), keyEquivalent: "p").target = self
        appMenu.addItem(withTitle: "Freigabefenster anzeigen", action: #selector(showOutput), keyEquivalent: "1").target = self
        appMenu.addItem(withTitle: "Rahmen ein- / ausblenden", action: #selector(toggleFrame), keyEquivalent: "b").target = self
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "ShareFrame beenden", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appItem.submenu = appMenu
        main.addItem(appItem)
        NSApp.mainMenu = main
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        statusItem.button?.image = NSImage(systemSymbolName: "viewfinder", accessibilityDescription: "ShareFrame")
        statusItem.button?.toolTip = "ShareFrame – Bildschirmbereich teilen"
        let menu = NSMenu()
        menu.delegate = self
        statusItem.menu = menu
    }

    func menuNeedsUpdate(_ menu: NSMenu) {
        menu.removeAllItems()
        addItem(to: menu, title: "Freigabefenster anzeigen", action: #selector(showOutput))
        addItem(to: menu, title: isRunning ? "Aufnahme pausieren" : "Aufnahme starten / fortsetzen", action: #selector(toggleCapture))
        addItem(to: menu, title: frameVisible ? "Rahmen ausblenden" : "Rahmen anzeigen", action: #selector(toggleFrame))
        menu.addItem(.separator())
        let label = NSMenuItem(title: "Aufnahmebildschirm", action: nil, keyEquivalent: "")
        label.isEnabled = false
        menu.addItem(label)
        for screen in NSScreen.screens {
            let item = NSMenuItem(title: screen.localizedName, action: #selector(selectScreen(_:)), keyEquivalent: "")
            item.target = self
            item.representedObject = NSNumber(value: screen.displayID)
            item.state = screen.displayID == selectedScreen?.displayID ? .on : .off
            menu.addItem(item)
        }
        menu.addItem(.separator())
        addItem(to: menu, title: "Bereich zentrieren", action: #selector(resetSelection))
        menu.addItem(.separator())
        addItem(to: menu, title: "ShareFrame beenden", action: #selector(quit))
    }

    private func addItem(to menu: NSMenu, title: String, action: Selector) {
        let item = menu.addItem(withTitle: title, action: action, keyEquivalent: "")
        item.target = self
    }

    private func showScreenMenu(from view: NSView) {
        let menu = NSMenu()
        menuNeedsUpdate(menu)
        menu.popUp(positioning: nil, at: NSPoint(x: 0, y: view.bounds.minY), in: view)
    }

    private func changeSelection(_ rect: CGRect) {
        let next = SelectionGeometry.clamped(rect, to: selectedScreen.frame)
        guard next != selection else {
            overlay.update(selection: selection, screen: selectedScreen.frame)
            return
        }
        selection = next
        // Reject queued images from the old geometry before displaying anything new.
        capture.update(selection: selection)
        output.clear()
        overlay.update(selection: selection, screen: selectedScreen.frame)
    }

    private func startCapture() {
        guard !isRunning else { return }
        actionID += 1
        let currentAction = actionID
        phase = .starting
        frameVisible = true
        overlay.setPaused(false)
        overlay.setVisible(true)
        output.showMessage(title: "Bereich wird vorbereitet …",
                           detail: "Erlaube ShareFrame bei Bedarf die Bildschirmaufnahme.\nDanach kannst du dieses Fenster in deiner Konferenz-App teilen.", button: nil)
        Task {
            do {
                guard actionID == currentAction else { return }
                try await capture.start(screen: selectedScreen, selection: selection)
                guard actionID == currentAction else { return }
                phase = .live
                saveSelection()
            } catch {
                guard actionID == currentAction else { return }
                captureFailed(error)
            }
        }
    }

    private func pause() {
        actionID += 1
        capture.stop()
        phase = .paused
        overlay.setPaused(true)
        output.showMessage(title: "Pausiert", detail: "Der Bildschirmbereich wird gerade nicht übertragen.", button: "Fortsetzen")
        saveSelection()
    }

    private func captureFailed(_ error: Error) {
        actionID += 1
        capture.stop()
        phase = .failed
        overlay.setPaused(true)
        let permissionMissing = !CGPreflightScreenCaptureAccess()
        let explanation = permissionMissing
            ? "Erlaube ShareFrame unter Systemeinstellungen → Datenschutz & Sicherheit → Bildschirm- & Systemaudioaufnahme. Starte die App danach bei Bedarf neu."
            : "Die Aufnahme wurde beendet.\n\(error.localizedDescription)"
        output.showMessage(title: permissionMissing ? "Bildschirmaufnahme erlauben" : "Aufnahme unterbrochen",
                           detail: explanation, button: "Erneut versuchen", settings: permissionMissing)
        showOutput()
    }

    @objc private func toggleCapture() { if isRunning { pause() } else { startCapture() } }
    @objc private func showOutput() {
        window.deminiaturize(nil)
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }
    @objc private func toggleFrame() {
        frameVisible.toggle()
        overlay.setVisible(frameVisible && phase != .ready)
    }
    @objc private func selectScreen(_ sender: NSMenuItem) {
        guard let id = (sender.representedObject as? NSNumber)?.uint32Value,
              let screen = NSScreen.screens.first(where: { $0.displayID == id }),
              id != selectedScreen.displayID else { return }
        let resume = isRunning
        pause()
        selectedScreen = screen
        selection = restoredSelection(on: screen)
        changeSelection(selection)
        if resume { startCapture() }
    }
    @objc private func resetSelection() {
        changeSelection(SelectionGeometry.initial(in: selectedScreen.visibleFrame.insetBy(dx: 12, dy: 48)))
    }
    @objc private func screensChanged() {
        // A display-mode change also changes the stream's pixel mapping. Pause so
        // the user explicitly reviews the relocated region before resuming.
        if isRunning { pause() }
        selectedScreen = NSScreen.screens.first(where: { $0.displayID == selectedScreen.displayID })
            ?? NSScreen.screens.first
        guard let selectedScreen else { NSApp.terminate(nil); return }
        changeSelection(selection)
        overlay.update(selection: selection, screen: selectedScreen.frame)
    }
    @objc private func willSleep() { if isRunning { pause() } }
    @objc private func quit() { NSApp.terminate(nil) }

    private func restoredSelection(on screen: NSScreen) -> CGRect {
        let key = "selection.\(screen.displayID)"
        if let saved = UserDefaults.standard.string(forKey: key) {
            let rect = NSRectFromString(saved)
            if rect.width > 0, rect.height > 0 { return SelectionGeometry.clamped(rect, to: screen.frame) }
        }
        return SelectionGeometry.initial(in: screen.visibleFrame.insetBy(dx: 12, dy: 48))
    }
    private func saveSelection() {
        guard let selectedScreen else { return }
        UserDefaults.standard.set(NSStringFromRect(selection), forKey: "selection.\(selectedScreen.displayID)")
    }
    func windowShouldClose(_ sender: NSWindow) -> Bool { NSApp.terminate(nil); return false }
    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        showOutput()
        return true
    }
    func applicationWillTerminate(_ notification: Notification) {
        saveSelection()
        capture.stop()
        overlay.setVisible(false)
    }
}
