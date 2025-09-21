import Foundation
import Security

final class KeychainStore {
    private let service: String
    private let serialQueue = DispatchQueue(label: "com.kioskapp.keychain", qos: .userInitiated)
    
    enum KeychainError: Error { 
        case operation(OSStatus) 
    }
    
    init(service: String) { 
        self.service = service 
    }

    func set(_ value: String, for key: String) throws {
        try serialQueue.sync {
            let data = Data(value.utf8)
            let query: [String: Any] = [
                kSecClass as String: kSecClassGenericPassword,
                kSecAttrService as String: service,
                kSecAttrAccount as String: key
            ]
            
            // First check if the item already exists with the same value
            if let existingValue = try? getUnsafe(key), existingValue == value {
                // Value is already correct, no need to update
                return
            }
            
            // Delete existing item (if any)
            SecItemDelete(query as CFDictionary)
            
            // Add new item with retry mechanism for duplicate errors
            var attrs = query
            attrs[kSecValueData as String] = data
            
            let maxRetries = 3
            var lastStatus: OSStatus = errSecSuccess
            
            for _ in 0..<maxRetries {
                lastStatus = SecItemAdd(attrs as CFDictionary, nil)
                
                if lastStatus == errSecSuccess {
                    return
                } else if lastStatus == errSecDuplicateItem {
                    // Handle duplicate item error - delete and retry
                    SecItemDelete(query as CFDictionary)
                    Thread.sleep(forTimeInterval: 0.01) // Small delay
                    continue
                } else {
                    break
                }
            }
            
            guard lastStatus == errSecSuccess else { 
                throw KeychainError.operation(lastStatus) 
            }
        }
    }

    func get(_ key: String) throws -> String? {
        return try serialQueue.sync {
            return try getUnsafe(key)
        }
    }
    
    private func getUnsafe(_ key: String) throws -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess else { throw KeychainError.operation(status) }
        guard let data = item as? Data, let str = String(data: data, encoding: .utf8) else { return nil }
        return str
    }

    func remove(_ key: String) throws {
        try serialQueue.sync {
            let query: [String: Any] = [
                kSecClass as String: kSecClassGenericPassword,
                kSecAttrService as String: service,
                kSecAttrAccount as String: key
            ]
            let status = SecItemDelete(query as CFDictionary)
            guard status == errSecSuccess || status == errSecItemNotFound else { 
                throw KeychainError.operation(status) 
            }
        }
    }
}
