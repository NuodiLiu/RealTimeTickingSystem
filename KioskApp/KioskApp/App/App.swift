//
//  KioskApp.swift
//  KioskApp
//
//  Created by liunuodi on 9/9/2025.
//

// App.swift
import SwiftUI

@main
struct KioskApp: App {
    private let env = AppEnvironment.shared
    @StateObject private var rootVM: RootViewModel

    init() {
        let environment = AppEnvironment.shared
        environment.gatewayCenter = GatewayCenter()
        environment.signalRService.delegate = environment.gatewayCenter
        _rootVM = StateObject(wrappedValue: RootViewModel(env: environment))
    }

    var body: some Scene {
        WindowGroup {
            RootView(vm: rootVM)
        }
    }
}
