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
    var signalRToken: String? { get }
    var signalREndpoint: String? { get }
    var appJwt: String? { get }  // App JWT 支持
    func storeDevice(credentials: DeviceCredentials) throws
    func storeSignalRInfo(token: String, endpoint: String) throws
    func storeAppJwt(_ jwt: String) throws
    func clearDevice() throws
}


final class DeviceAuthProvider: AuthProviding {
    private enum Keys { 
        static let deviceId = "device.id"
        static let apiKey = "device.apiKey"
        static let signalRToken = "device.signalRToken"
        static let signalREndpoint = "device.signalREndpoint"
        static let appJwt = "device.appJwt"
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
    var appJwt: String? {
        let jwt = try? keychain.get(Keys.appJwt)
        print("AuthProvider: appJwt requested, found: \(jwt?.prefix(20) ?? "nil")")
        return jwt
    }


    func storeDevice(credentials: DeviceCredentials) throws {
        print("AuthProvider: Storing device credentials")
        print("AuthProvider: Device ID: \(credentials.deviceId)")
        print("AuthProvider: API Key: \(credentials.apiKey.prefix(20))...")
        print("AuthProvider: Mode: \(credentials.mode)")

        try keychain.set(credentials.deviceId, for: Keys.deviceId)
        try keychain.set(credentials.apiKey, for: Keys.apiKey)

        print("AuthProvider: Successfully stored device credentials")
    }

    func storeSignalRInfo(token: String, endpoint: String) throws {
        print("AuthProvider: Storing SignalR credentials")
        print("AuthProvider: SignalR Token: \(token.prefix(20))...")
        print("AuthProvider: SignalR Endpoint: \(endpoint)")
        
        try keychain.set(token, for: Keys.signalRToken)
        try keychain.set(endpoint, for: Keys.signalREndpoint)
        
        print("AuthProvider: Successfully stored SignalR credentials")
    }

    func storeAppJwt(_ jwt: String) throws {
        print("AuthProvider: Storing App JWT")
        print("AuthProvider: App JWT: \(jwt.prefix(20))...")
        
        try keychain.set(jwt, for: Keys.appJwt)
        
        print("AuthProvider: Successfully stored App JWT")
    }

    func clearDevice() throws {
        try keychain.remove(Keys.deviceId)
        try keychain.remove(Keys.apiKey)
        try keychain.remove(Keys.signalRToken)
        try keychain.remove(Keys.signalREndpoint)
        try keychain.remove(Keys.appJwt)
    }
}
