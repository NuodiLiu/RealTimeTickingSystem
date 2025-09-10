// DeviceModeStore.swift
import Foundation

final class DeviceModeStore {
    private enum Keys { static let mode = "device.currentMode" }
    func save(_ mode: DeviceMode) { UserDefaults.standard.set(mode.rawValue, forKey: Keys.mode) }
    func load() -> DeviceMode? {
        (UserDefaults.standard.string(forKey: Keys.mode)).flatMap(DeviceMode.init(rawValue:))
    }
    func clear() { UserDefaults.standard.removeObject(forKey: Keys.mode) }
}
