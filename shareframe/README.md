# ShareFrame

A movable red frame marks the screen region you want to share. The separate **“ShareFrame – Screen Share”** window shows that region live. Share this window in Teams, Zoom, Meet, or any other app that supports window sharing.

A transparent window does not contain the image data of the windows underneath it. ShareFrame therefore uses ScreenCaptureKit and a separate share window. The app excludes itself from capture to prevent its frame, controls, and share window from creating a feedback loop.

## License

ShareFrame is distributed under the [ShareFrame Software License](LICENSE):

- **Free for personal use** unrelated to work for an employer, client, or other organization.
- **Free for organizational use with fewer than 250 people** across the entire company group, including parent companies, subsidiaries, and entities under common control. Count all employees and individual contractors, including agency contractors working for the group. Count each individual once, regardless of working hours or whether they use ShareFrame.
- **A separate paid commercial license is required for 250 or more people**, and for any other use outside the free license grant. There is **no revenue limit**.

For example, a subsidiary with 20 employees in a group of 300 people requires a paid license. A group with 240 employees and 10 contractors also requires a paid license. A group of 249 people qualifies for free use regardless of revenue. Educational, nonprofit, and government organizations follow the same headcount rule.

The model follows [Docker Desktop's distinction](https://docs.docker.com/subscription-billing/desktop-license/) between free personal/small-business use and paid larger-organization use, with ShareFrame's own eligibility rules and license wording. These are custom source-available terms. For a commercial license, [contact the maintainer](https://github.com/apetersson/qnd/issues); pricing and any support are agreed separately.

The build bundles the full license at `ShareFrame.app/Contents/Resources/LICENSE.txt`. Keep it with any original or modified copies you distribute. The full license controls if this summary differs from it. This license applies to ShareFrame, rather than the other projects in this repository.

## Getting started

Requirements: macOS 13 or later, and Xcode / Swift 5.9 or later to build. No external dependencies.

```sh
./build.sh
open build/ShareFrame.app
```

The built app is at `build/ShareFrame.app`. You can also copy it to `/Applications`. The build uses a local ad-hoc signature by default. To keep screen recording permission stable across rebuilds, you can use an existing signing identity:

```sh
SHAREFRAME_SIGN_IDENTITY='Apple Development: …' ./build.sh
```

## Usage

1. Click **Start Capture** and grant macOS screen recording permission. If needed, open System Settings → Privacy & Security → Screen & System Audio Recording, enable ShareFrame, and restart ShareFrame. The setting's name varies by macOS version.
2. Drag a red border or the dark toolbar to move the region. Drag the **bottom-right handle** to resize it. You can interact normally with the apps inside the frame.
3. In your conferencing app, choose **window sharing** and select **“ShareFrame – Screen Share”**. Keep the share window open and move it aside if needed. It is excluded from its own capture.
4. **Pause** in the toolbar or **⌘P** while ShareFrame is active clears the live image and stops capture. **⌘1** brings the share window to the front. **⌘B** shows or hides the frame. These shortcuts work while ShareFrame is active; they are not global hotkeys.
5. Use the display icon or menu bar icon to select another display, center the region, or quit the app. **⌘Q** also quits the app.

The region stays within one display. Retina scaling and displays positioned to the left of or above the primary display are supported. The app pauses when the display configuration changes, the Mac sleeps, or the user session switches, so you can review the region before resuming. If macOS reports a blank display or suspended capture, the previous image is cleared. The last saved region is restored for each display.

## Features and limitations

- Up to 30 frames per second, including the mouse pointer; no audio or microphone capture.
- Local processing. No network connections, recordings, or video files.
- macOS grants screen recording access to the display. ShareFrame processes its frames in memory; only the cropped region reaches the share window.
- Your conferencing app must support sharing a normal macOS window. Test an actual call and minimize behavior in each conferencing app; keep the share window open and unminimized while sharing.
- macOS may black out protected video content.
- The local app is not notarized. Distribution to other Macs would benefit from Developer ID signing and notarization.

## Verification

```sh
swift test
```

Tests cover cropping with Retina scaling and offset displays, display boundaries, and resizing with a fixed top-left corner. Video buffer tests also verify clearing the image when capture is interrupted and reusing an unchanged desktop when the region moves. System permission and sharing in a conferencing app require an additional manual test.

Reference: [Apple: Capturing screen content in macOS](https://developer.apple.com/documentation/screencapturekit/capturing-screen-content-in-macos).
