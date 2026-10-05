import AuthenticationServices
import Capacitor

/// Shows the system prompt ("bharris.app wants to use accounts.google.com to sign in")
/// and the Google account sheet on top of the app. The sign-in screen stays put.
@objc(GoogleAuthSessionPlugin)
public class GoogleAuthSessionPlugin: CAPPlugin, CAPBridgedPlugin, ASWebAuthenticationPresentationContextProviding {
    public let identifier = "GoogleAuthSessionPlugin"
    public let jsName = "GoogleAuthSession"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
    ]

    static var sessionActive = false

    private var session: ASWebAuthenticationSession?
    private var savedCall: CAPPluginCall?
    private var attemptID: UUID?

    @objc func start(_ call: CAPPluginCall) {
        guard let raw = call.getString("url"), let url = URL(string: raw) else {
            call.reject("Missing sign-in url")
            return
        }
        DispatchQueue.main.async {
            self.begin(call, url: url)
        }
    }

    private func begin(_ call: CAPPluginCall, url: URL) {
        finishPrevious()
        savedCall = call
        let attempt = UUID()
        attemptID = attempt
        GoogleAuthSessionPlugin.sessionActive = true

        let authSession = ASWebAuthenticationSession(url: url, callbackURLScheme: "bharris") { [weak self] callback, error in
            DispatchQueue.main.async {
                guard let self, self.attemptID == attempt else { return }
                if let error = error as? ASWebAuthenticationSessionError, error.code == .canceledLogin {
                    self.fail("Google sign-in was closed.", code: "1001", endSession: false)
                    return
                }
                if let error {
                    self.fail(error.localizedDescription, endSession: false)
                    return
                }
                guard let callback else {
                    self.fail("Google did not return a sign-in token.", endSession: false)
                    return
                }
                self.succeed(url: callback)
            }
        }
        authSession.presentationContextProvider = self
        authSession.prefersEphemeralWebBrowserSession = false
        session = authSession
        if !authSession.start() {
            fail("Could not open Google sign-in.")
        }
    }

    public func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        if let window = bridge?.webView?.window {
            return window
        }
        let scene = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .first { $0.activationState == .foregroundActive }
        return scene?.windows.first { $0.isKeyWindow } ?? ASPresentationAnchor()
    }

    private func succeed(url: URL) {
        let call = savedCall
        cleanup(endSession: false)
        call?.resolve(["url": url.absoluteString])
    }

    private func fail(_ message: String, code: String? = nil, endSession: Bool = true) {
        let call = savedCall
        cleanup(endSession: endSession)
        call?.reject(message, code)
    }

    private func finishPrevious() {
        let call = savedCall
        cleanup(endSession: true)
        call?.reject("Google sign-in was closed.", "1001")
    }

    private func cleanup(endSession: Bool) {
        let current = session
        session = nil
        savedCall = nil
        attemptID = nil
        GoogleAuthSessionPlugin.sessionActive = false
        if endSession {
            current?.cancel()
        }
    }
}

class StudyBridgeViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(GoogleAuthSessionPlugin())
    }
}
