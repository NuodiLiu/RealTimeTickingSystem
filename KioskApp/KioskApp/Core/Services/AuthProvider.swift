//
//  AuthProvider.swift
//  KioskApp
//
//  Created by liunuodi on 9/9/2025.
//

import Foundation


protocol AuthProviding {
    var deviceApiKey: String? { get }
    func storeDevice(credentials: DeviceCredentials) throws
    func clearDevice() throws
}


final class DeviceAuthProvider: AuthProviding {
    private enum Keys { static let deviceId = "device.id"; static let apiKey = "device.apiKey" }
    private let keychain: KeychainStore


    init(keychain: KeychainStore) { self.keychain = keychain }


    var deviceApiKey: String? { try? keychain.get(Keys.apiKey) }


    func storeDevice(credentials: DeviceCredentials) throws {
        try keychain.set(credentials.deviceId, for: Keys.deviceId)
        try keychain.set(credentials.apiKey, for: Keys.apiKey)
    }

    func clearDevice() throws {
        try keychain.remove(Keys.deviceId)
        try keychain.remove(Keys.apiKey)
    }
}
