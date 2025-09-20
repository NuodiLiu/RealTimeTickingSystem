//
//  AuthProvider.swift
//  KioskApp
//
//  Created by liunuodi on 9/9/2025.
//

import Foundation


protocol AuthProviding {
    var deviceId: String? { get }
    var deviceApiKey: String? { get }
    var wsToken: String? { get }
    var wsEndpoint: String? { get }
    var signalRToken: String? { get }
    var signalREndpoint: String? { get }
    func storeDevice(credentials: DeviceCredentials) throws
    func storeSignalRInfo(token: String, endpoint: String) throws
    func clearDevice() throws
}


final class DeviceAuthProvider: AuthProviding {
    private enum Keys { 
        static let deviceId = "device.id"
        static let apiKey = "device.apiKey"
        static let wsToken = "device.wsToken"
        static let wsEndpoint = "device.wsEndpoint"
        static let signalRToken = "device.signalRToken"
        static let signalREndpoint = "device.signalREndpoint"
    }
    private let keychain: KeychainStore


    init(keychain: KeychainStore) { self.keychain = keychain }

    var deviceId: String? { 
        let id = try? keychain.get(Keys.deviceId)
        print("AuthProvider: deviceId requested, found: \(id ?? "nil")")
        return id
    }
    var deviceApiKey: String? { 
        let key = try? keychain.get(Keys.apiKey)
        print("AuthProvider: deviceApiKey requested, found: \(key?.prefix(20) ?? "nil")")
        return key
    }
    var wsToken: String? { 
        let token = try? keychain.get(Keys.wsToken)
        print("AuthProvider: wsToken requested, found: \(token?.prefix(20) ?? "nil")")
        return token
    }
    var wsEndpoint: String? { 
        let endpoint = try? keychain.get(Keys.wsEndpoint)
        print("AuthProvider: wsEndpoint requested, found: \(endpoint ?? "nil")")
        return endpoint
    }
    var signalRToken: String? { 
        let token = try? keychain.get(Keys.signalRToken)
        print("AuthProvider: signalRToken requested, found: \(token?.prefix(20) ?? "nil")")
        return token
    }
    var signalREndpoint: String? { 
        let endpoint = try? keychain.get(Keys.signalREndpoint)
        print("AuthProvider: signalREndpoint requested, found: \(endpoint ?? "nil")")
        return endpoint
    }


    func storeDevice(credentials: DeviceCredentials) throws {
        print("AuthProvider: Storing device credentials")
        print("AuthProvider: Device ID: \(credentials.deviceId)")
        print("AuthProvider: API Key: \(credentials.apiKey.prefix(20))...")
        print("AuthProvider: Mode: \(credentials.mode)")

        try keychain.set(credentials.deviceId, for: Keys.deviceId)
        try keychain.set(credentials.apiKey, for: Keys.apiKey)
        
        // Store WebSocket credentials if available
        if let wsToken = credentials.wsToken {
            try keychain.set(wsToken, for: Keys.wsToken)
            print("AuthProvider: Stored WS Token: \(wsToken.prefix(20))...")
        }
        if let wsEndpoint = credentials.wsEndpoint {
            try keychain.set(wsEndpoint, for: Keys.wsEndpoint)
            print("AuthProvider: Stored WS Endpoint: \(wsEndpoint)")
        }

        print("AuthProvider: Successfully stored all credentials")
    }

    func storeSignalRInfo(token: String, endpoint: String) throws {
        print("AuthProvider: Storing SignalR credentials")
        print("AuthProvider: SignalR Token: \(token.prefix(20))...")
        print("AuthProvider: SignalR Endpoint: \(endpoint)")
        
        try keychain.set(token, for: Keys.signalRToken)
        try keychain.set(endpoint, for: Keys.signalREndpoint)
        
        print("AuthProvider: Successfully stored SignalR credentials")
    }

    func clearDevice() throws {
        try keychain.remove(Keys.deviceId)
        try keychain.remove(Keys.apiKey)
        try keychain.remove(Keys.wsToken)
        try keychain.remove(Keys.wsEndpoint)
        try keychain.remove(Keys.signalRToken)
        try keychain.remove(Keys.signalREndpoint)
    }
}
