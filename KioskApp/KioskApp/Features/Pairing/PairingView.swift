import SwiftUI

struct PairingView: View {
    @StateObject var vm: PairingViewModel
    
    init(env: AppEnvironment,
         modeStore: DeviceModeStore,
         onPaired: @escaping (DeviceMode?) -> Void) {
        _vm = StateObject(wrappedValue:
                            PairingViewModel(env: env, modeStore: modeStore, onPaired: onPaired)
        )
    }
    
    var body: some View {
        ZStack {
            Color(.systemGroupedBackground).ignoresSafeArea()
            
            VStack(spacing: 28) {
                Text("Select Mode")
                    .font(.system(size: 34, weight: .bold))
                
                // Mode 切换（Registration / Feedback），符合前台大触控
                Picker("", selection: $vm.selectedMode) {
                    Text("Registration").tag(DeviceMode.REGISTRATION)
                    Text("Feedback").tag(DeviceMode.FEEDBACK)
                }
                .pickerStyle(.segmented)
                .font(.system(size: 20))
                .frame(maxWidth: 500)
                
                Text("Choose a working mode, then scan a QR code to pair this device.")
                    .font(.title3)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 600)
                
                Spacer(minLength: 20)
                
                Button {
                    vm.startScan()
                } label: {
                    HStack(spacing: 12) {
                        Image(systemName: "qrcode.viewfinder")
                            .font(.system(size: 24, weight: .semibold))
                        Text(vm.isPairing ? "Pairing…" : "Scan QR to Pair")
                            .fontWeight(.semibold)
                            .font(.system(size: 20))
                    }
                    .frame(height: 56)
                    .frame(maxWidth: 360)
                }
                .buttonStyle(.borderedProminent)
                .tint(.purple)
                .disabled(vm.isPairing)
                
                if let e = vm.errorMessage {
                    Label(e, systemImage: "exclamationmark.triangle.fill")
                        .foregroundStyle(.red)
                        .padding(.top, 8)
                }
                
                Spacer()
            }
            .padding(32)
        }
        .devResetGesture() // 添加开发者重置手势
        // 全屏相机
        .fullScreenCover(isPresented: $vm.isScanning) {
            ZStack {
                Color.black.ignoresSafeArea()
                
                #if targetEnvironment(simulator)
                VStack(spacing: 20) {
                    Image(systemName: "camera.fill")
                        .font(.system(size: 50))
                        .foregroundColor(.white)
                    
                    Text("Camera Not Available in Simulator")
                        .font(.title2)
                        .foregroundColor(.white)
                    
                    Text("For testing, tap the button below to simulate scanning a QR code")
                        .multilineTextAlignment(.center)
                        .foregroundColor(.gray)
                        .padding(.horizontal)
                    
                    VStack(spacing: 10) {
                        Button("Simulate QR Scan (Dev Token)") {
                            // 使用后端预设的开发环境测试令牌
                            let simulatedToken = "test-token-123"
                            print("🧪 Simulating scan with token: \(simulatedToken)")
                            Task { await vm.handleScanned(token: simulatedToken) }
                        }
                        .buttonStyle(.borderedProminent)
                        
                        Button("Simulate QR Scan (Random Token)") {
                            // 生成随机令牌来测试错误处理
                            let randomToken = "pair_\(UUID().uuidString.prefix(8))"
                            print("🧪 Simulating scan with random token: \(randomToken)")
                            Task { await vm.handleScanned(token: randomToken) }
                        }
                        .buttonStyle(.bordered)
                    }
                }
                #else
                QRScannerView { value in
                    Task { await vm.handleScanned(token: value) }
                }
                #endif
                VStack {
                    HStack {
                        Button {
                            vm.isScanning = false
                        } label: {
                            Image(systemName: "xmark.circle.fill")
                                .font(.system(size: 28, weight: .semibold))
                                .symbolRenderingMode(.hierarchical)
                        }
                        .tint(.white)
                        .padding()
                        Spacer()
                    }
                    Spacer()
                    Text("Align the QR code within the frame")
                        .foregroundColor(.white)
                        .font(.headline)
                        .padding(.bottom, 40)
                }
            }
            .ignoresSafeArea()
        }
    }
}
