import UIKit
import WebKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.backgroundColor = UIColor(red: 0.973, green: 0.980, blue: 0.988, alpha: 1.0)
        window?.rootViewController = CAPBridgeViewController()
        window?.makeKeyAndVisible()

        lockWebViewZoom()
        DispatchQueue.main.async { [weak self] in self?.lockWebViewZoom() }

        if let url = connectionOptions.urlContexts.first?.url {
            deliverGoogleHandoff(url)
        }
        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    /// Safari finishes Google sign-in, then opens lmsstudy:// so the account comes back into the app.
    private func deliverGoogleHandoff(_ url: URL, attempt: Int = 0) {
        guard url.scheme == "lmsstudy" else { return }
        guard let controller = window?.rootViewController as? CAPBridgeViewController,
              let webView = controller.webView else {
            if attempt < 20 {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) { [weak self] in
                    self?.deliverGoogleHandoff(url, attempt: attempt + 1)
                }
            }
            return
        }
        let items = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems ?? []
        let query = ["googleIdToken", "googleCancelled"].compactMap { name -> String? in
            guard let value = items.first(where: { $0.name == name })?.value,
                  let encoded = value.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) else {
                return nil
            }
            return "\(name)=\(encoded)"
        }.joined(separator: "&")
        let local = "capacitor://enthusiastic-cram-genius-flow.base44.app/?\(query)#/account"
        if let localURL = URL(string: local) {
            webView.load(URLRequest(url: localURL))
        }
    }

    /// Stops pinch-zoom and leftover auto-zoom after focusing a text field.
    private func lockWebViewZoom() {
        guard let root = window?.rootViewController else { return }
        findWebView(in: root.view)?.scrollView.pinchGestureRecognizer?.isEnabled = false
        findWebView(in: root.view)?.scrollView.minimumZoomScale = 1
        findWebView(in: root.view)?.scrollView.maximumZoomScale = 1
        findWebView(in: root.view)?.scrollView.bouncesZoom = false
    }

    private func findWebView(in view: UIView) -> WKWebView? {
        if let webView = view as? WKWebView { return webView }
        for child in view.subviews {
            if let found = findWebView(in: child) { return found }
        }
        return nil
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        if let url = URLContexts.first?.url, url.scheme == "lmsstudy" {
            deliverGoogleHandoff(url)
            return
        }
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
