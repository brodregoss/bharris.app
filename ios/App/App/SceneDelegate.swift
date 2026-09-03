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

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
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
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
