# Jiko macOS agent

A menu-bar app. It watches which app is in front, syncs that to the backend once a minute, and shows Jiko's messages as native notifications you can reply to inline. No dock icon.

## Run

1. Backend up: `cd backend && npm run localdb && npm run dev` (defaults to `http://localhost:3000`).
2. Open `apple/JikoMacOSAgent/JikoMacOSAgent.xcodeproj` in Xcode 16+, run the `JikoMacOSAgent` scheme.
3. Click the lotus in the menu bar → **Sign in…** → create an account (server field defaults to localhost).
4. Answer the three onboarding questions. That labels your distracting apps, adds one obligation, sets strictness, and turns on `deadline_drift`, `doomscroll`, `nightly_summary`, `deadline_reminder`.
5. Use your Mac. Within a minute the Today tab shows usage; when a rule fires, a notification arrives. Reply to it ("snooze 30", "done", "status") without opening anything.

Command line:

```bash
xcodebuild -project JikoMacOSAgent.xcodeproj -scheme JikoMacOSAgent -destination 'platform=macOS' CODE_SIGN_IDENTITY="-" build
xcodebuild -project JikoMacOSAgent.xcodeproj -scheme JikoMacOSAgent -destination 'platform=macOS' -only-testing:JikoMacOSAgentTests CODE_SIGN_IDENTITY="-" test
```

## How it works

| File | Role |
|---|---|
| `UsageTracker.swift` | `NSWorkspace` activation, sleep/lock/wake notifications → foreground sessions per bundle id. `flush()` closes and reopens the live session so long sessions report every interval. |
| `AppState.swift` | Owns the loops: sync every 60 s (`POST /sync/app-usage`), poll every 15 s (`GET /messages/queued` → notification → ack). Disk outbox in `~/Library/Application Support/Jiko/outbox.json` when the server is unreachable (capped at 500 payloads). |
| `JikoAPI.swift` | `actor` around `URLSession`. Bearer auth, refresh-on-401, tokens in Keychain, base URL in `UserDefaults`. |
| `Notifier.swift` | `UNUserNotificationCenter` with a text-input **Reply** action and a **Snooze 30 min** action. |
| `JikoMenu.swift` | The popover: today in one line, budget, last message, reply box, quick-add box, pause. |
| `Views/MainWindow.swift` | Sign in, Chat, Today, Rules (presets on/off), Apps (labels), Settings (strictness, voice, quiet hours). |
| `Views/OnboardingView.swift` | Three questions in Jiko's voice. |
| `Models.swift` | Codable mirrors of the backend JSON; field names match the API. |

The app is sandboxed with `network.client`. It never reads window titles or keystrokes, only which app is frontmost and for how long.

## Not yet

- Location and health syncs (iOS agent).
- Launch at login (System Settings → General → Login Items works manually).
- Notifications require the app to be signed; running an unsigned build from `xcodebuild` without `CODE_SIGN_IDENTITY="-"` will silently drop them.
