//
//  AuthProvider.swift
//  KioskApp
//
//  Created by liunuodi on 9/9/2025.
//

import Foundation


protocol AuthProviding {
    var deviceApiKey: String? { get }
    var wsToken: String? { get }
    var wsEndpoint: String? { get }
    func storeDevice(credentials: DeviceCredentials) throws
    func clearDevice() throws
}


final class DeviceAuthProvider: AuthProviding {
    private enum Keys { 
        static let deviceId = "device.id"
        static let apiKey = "device.apiKey"
        static let wsToken = "device.wsToken"
        static let wsEndpoint = "device.wsEndpoint"
    }
    private let keychain: KeychainStore


    init(keychain: KeychainStore) { self.keychain = keychain }


    var deviceApiKey: String? { try? keychain.get(Keys.apiKey) }
    var wsToken: String? { try? keychain.get(Keys.wsToken) }
    var wsEndpoint: String? { try? keychain.get(Keys.wsEndpoint) }


    func storeDevice(credentials: DeviceCredentials) throws {
        try keychain.set(credentials.deviceId, for: Keys.deviceId)
        try keychain.set(credentials.apiKey, for: Keys.apiKey)
        
        // Store WebSocket credentials if available
        if let wsToken = credentials.wsToken {
            try keychain.set(wsToken, for: Keys.wsToken)
        }
        if let wsEndpoint = credentials.wsEndpoint {
            try keychain.set(wsEndpoint, for: Keys.wsEndpoint)
        }
    }

    func clearDevice() throws {
        try keychain.remove(Keys.deviceId)
        try keychain.remove(Keys.apiKey)
        try keychain.remove(Keys.wsToken)
        try keychain.remove(Keys.wsEndpoint)
    }
}
