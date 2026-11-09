// Raindrop Admin Panel.app — macOS launcher.
// Starts the local server (node server.js) if it is not already running, then opens the panel
// in its own app-style window (Chrome --app if installed, otherwise the default browser).
import AppKit

let PORT = 4517
let URL_STR = "http://127.0.0.1:\(PORT)/"
let ROOT = Bundle.main.object(forInfoDictionaryKey: "PanelRoot") as? String ?? ""

func serverUp() -> Bool {
  guard let url = URL(string: URL_STR) else { return false }
  var req = URLRequest(url: url, timeoutInterval: 0.6)
  req.httpMethod = "HEAD"
  let sem = DispatchSemaphore(value: 0)
  var ok = false
  URLSession.shared.dataTask(with: req) { _, res, _ in ok = (res as? HTTPURLResponse) != nil; sem.signal() }.resume()
  _ = sem.wait(timeout: .now() + 1)
  return ok
}

func nodePath() -> String? {
  for p in ["/opt/homebrew/bin/node", "/usr/local/bin/node"] where FileManager.default.isExecutableFile(atPath: p) { return p }
  let task = Process()
  task.executableURL = URL(fileURLWithPath: "/bin/zsh")
  task.arguments = ["-lc", "command -v node"]
  let pipe = Pipe(); task.standardOutput = pipe
  try? task.run(); task.waitUntilExit()
  let out = String(data: pipe.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
  return out.isEmpty ? nil : out
}

func fail(_ title: String, _ text: String) {
  NSApp.activate(ignoringOtherApps: true)
  let a = NSAlert(); a.messageText = title; a.informativeText = text; a.runModal()
}

func startServer() -> Bool {
  guard FileManager.default.fileExists(atPath: ROOT + "/server.js") else {
    fail("Panel folder not found", "Rebuild the app from the project folder with: npm run app"); return false
  }
  guard let node = nodePath() else { fail("Node.js not found", "Install Node.js 20 or later from nodejs.org, then open the app again."); return false }
  let p = Process()
  p.executableURL = URL(fileURLWithPath: node)
  p.arguments = [ROOT + "/server.js"]
  p.currentDirectoryURL = URL(fileURLWithPath: ROOT)
  let log = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Library/Logs/raindrop-admin-panel.log")
  FileManager.default.createFile(atPath: log.path, contents: nil)
  if let h = try? FileHandle(forWritingTo: log) { p.standardOutput = h; p.standardError = h }
  do { try p.run() } catch { fail("Could not start the panel", error.localizedDescription); return false }
  for _ in 0..<40 { if serverUp() { return true }; usleep(150_000) }
  fail("The panel did not start", "See ~/Library/Logs/raindrop-admin-panel.log. Did you run npm install in the project folder?")
  return false
}

// Chrome must be started by macOS, never as a child of this app. A child process is charged to its
// parent for privacy permissions, so Chrome's camera, microphone and file requests would all appear
// under this app's name, for as long as that Chrome stays open.
func openWindow() {
  guard let u = URL(string: URL_STR) else { return }
  guard let chrome = NSWorkspace.shared.urlForApplication(withBundleIdentifier: "com.google.Chrome") else {
    NSWorkspace.shared.open(u)
    return
  }
  let config = NSWorkspace.OpenConfiguration()
  config.arguments = ["--app=\(URL_STR)", "--window-size=1440,920"]
  config.createsNewApplicationInstance = true // arguments only reach a new instance; Chrome hands the window to any copy already open
  NSWorkspace.shared.openApplication(at: chrome, configuration: config) { _, error in
    if error != nil { DispatchQueue.main.async { NSWorkspace.shared.open(u) } }
  }
}

let app = NSApplication.shared
app.setActivationPolicy(.accessory)
if serverUp() || startServer() { openWindow() }
DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { exit(0) }
app.run()
