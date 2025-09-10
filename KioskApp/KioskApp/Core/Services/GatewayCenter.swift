//
//  GatewayCenter.swift
//  KioskApp
//
//  Created by liunuodi on 9/9/2025.
//

import Foundation
import Combine

/// 负责把 SocketService 的委托回调翻译成 Published 事件，供 VM 订阅。
final class GatewayCenter: ObservableObject, DeviceGatewayDelegate {
    @Published var isConnected: Bool = false
    @Published var showFeedback: FeedbackShowPayload?
    @Published var lockAssigned: LockAssignedPayload?
    @Published var modeChanged: DeviceMode?

    func gatewayDidConnect() { isConnected = true }
    func gatewayDidDisconnect() { isConnected = false }

    func gatewayShowFeedback(_ payload: FeedbackShowPayload, raw: [String : Any]) {
        showFeedback = payload
    }

    func gatewayDismiss() {
        showFeedback = nil
    }

    func gatewayLockAssigned(_ payload: LockAssignedPayload, raw: [String : Any]) {
        lockAssigned = payload
    }

    func gatewayModeChanged(_ mode: DeviceMode) {
        modeChanged = mode
    }
}
