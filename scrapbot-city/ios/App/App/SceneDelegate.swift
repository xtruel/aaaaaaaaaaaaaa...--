import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?
    private var backgroundTask: UIBackgroundTaskIdentifier = .invalid

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        // Best effort (iPad windows, the Mac; nil on iPhone): the smallest window the game's layout was measured to fit
        // in Chromium (docs/APPSTORE.md): 744 points wide (an iPad mini in portrait; under 1024 the build bar scrolls
        // sideways), 640 high plus the home indicator. Full screen, iPadOS still gives any iPad's own size.
        windowScene.sizeRestrictions?.minimumSize = CGSize(width: 744, height: 660)

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = CAPBridgeViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    // A few seconds more in the background, so that the game's last writes end (the App plugin's pause event saves
    // the city and its copy in Library/saves through the web view). Ended after 10 s, or when iOS asks.
    func sceneDidEnterBackground(_ scene: UIScene) {
        endBackgroundTask()
        let task = UIApplication.shared.beginBackgroundTask(withName: "Scrapbot City saves") { [weak self] in
            self?.endBackgroundTask()
        }
        backgroundTask = task
        DispatchQueue.main.asyncAfter(deadline: .now() + 10) { [weak self] in
            if self?.backgroundTask == task { self?.endBackgroundTask() }
        }
    }

    func sceneWillEnterForeground(_ scene: UIScene) {
        endBackgroundTask()
    }

    private func endBackgroundTask() {
        guard backgroundTask != .invalid else { return }
        UIApplication.shared.endBackgroundTask(backgroundTask)
        backgroundTask = .invalid
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
