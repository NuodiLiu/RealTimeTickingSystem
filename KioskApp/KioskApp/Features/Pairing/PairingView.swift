import SwiftUI

struct PairingView: View {
    @StateObject var vm: PairingViewModel
    
    private let unswYellow = Color(red: 1.0, green: 0.84, blue: 0.0)
    private let unswDarkBlue = Color(red: 0.0, green: 0.2, blue: 0.4)
    private let unswLightGray = Color(red: 0.95, green: 0.95, blue: 0.95)
    
    init(env: AppEnvironment,
         modeStore: DeviceModeStore,
         onPaired: @escaping (DeviceMode?) -> Void) {
        _vm = StateObject(wrappedValue:
                            PairingViewModel(env: env, modeStore: modeStore, onPaired: onPaired)
        )
    }
    
    var body: some View {
        ZStack {
            LinearGradient(
                gradient: Gradient(colors: [unswYellow.opacity(0.1), Color.white]),
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()
            
            VStack {
                Spacer()
                HStack {
                    Spacer()
                    Image(systemName: "graduationcap.fill")
                        .font(.system(size: 200))
                        .foregroundColor(unswYellow.opacity(0.05))
                        .rotationEffect(.degrees(15))
                    Spacer()
                }
                Spacer()
            }
            .ignoresSafeArea()
            
            VStack(spacing: 0) {
                UNSWPairingHeader()
                
                VStack(spacing: 40) {
                    // Mode 选择区域
                    VStack(alignment: .leading, spacing: 20) {
                        Text("Choose Device Mode")
                            .font(.system(size: 24, weight: .bold))
                            .foregroundColor(Color(red: 0.0, green: 0.2, blue: 0.4))
                        
                        UNSWSegmentedPicker(selection: $vm.selectedMode)
                    }
                    
                    Text("Select a working mode above, then scan a QR code to pair this device.")
                        .font(.system(size: 18, weight: .medium))
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: 600)
                        .padding(.horizontal, 20)
                    
                    Spacer(minLength: 40)
                    
                    UNSWPairButton(
                        isPairing: vm.isPairing,
                        cameraPermissionDenied: vm.cameraPermissionDenied,
                        onScanTapped: { vm.startScan() },
                        onSettingsTapped: { vm.openCameraSettings() }
                    )
                    
                    Spacer(minLength: 100)
                }
                .padding(32)
                .frame(maxWidth: 800)
                .frame(maxWidth: .infinity, alignment: .center)
                
                Spacer()
            }
            .padding(.top, 20)
        }
        .onAppear {
            vm.checkCameraPermissionStatus()
        }
        .showToast(message: $vm.errorMessage, style: .error, duration: 4.0)

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
                            let simulatedToken = "test-token-123"
                            print("Simulating scan with token: \(simulatedToken)")
                            Task { await vm.handleScanned(token: simulatedToken) }
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(unswYellow)
                        .foregroundColor(unswDarkBlue)
                    }
                }
                #else
                QRScannerView { value in
                    Task { await vm.handleScanned(token: value) }
                }
                #endif
                
                // 顶部关闭按钮
                Spacer(minLength: 50)
                VStack {
                    HStack {
                        Button {
                            vm.isScanning = false
                        } label: {
                            ZStack {
                                Circle()
                                    .fill(.black.opacity(0.6))
                                    .frame(width: 44, height: 44)
                                Image(systemName: "xmark")
                                    .font(.system(size: 18, weight: .semibold))
                                    .foregroundColor(.white)
                            }
                        }
                        .padding()
                        Spacer()
                    }
                    Spacer()
                    
                    VStack(spacing: 12) {
                        Text("Align the QR code within the frame")
                            .foregroundColor(.white)
                            .font(.headline)
                        
                        Text("Make sure the QR code is clearly visible and well-lit")
                            .foregroundColor(.white.opacity(0.8))
                            .font(.subheadline)
                    }
                    .padding(.bottom, 40)
                }
            }
            .ignoresSafeArea()
        }
    }
}


private struct UNSWPairingHeader: View {
    var body: some View {
        VStack(spacing: 24) {
            Image("UnswCollegeLogo")
                .resizable()
                .aspectRatio(contentMode: .fit)
                .frame(maxWidth: 400, maxHeight: 200)
                .padding(.horizontal, 24)
        }
        .padding(.horizontal, 24)
        .padding(.top, 20)
    }
}

private struct UNSWFormField<Content: View>: View {
    let title: String
    let required: Bool
    let content: () -> Content
    
    init(title: String, required: Bool = false, @ViewBuilder content: @escaping () -> Content) {
        self.title = title
        self.required = required
        self.content = content
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text(title)
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundColor(Color(red: 0.0, green: 0.2, blue: 0.4))
                
                if required {
                    Text("*")
                        .foregroundColor(.red)
                        .font(.system(size: 18, weight: .bold))
                }
            }
            
            content()
        }
    }
}

/// UNSW style segmented picker for device modes
private struct UNSWSegmentedPicker: View {
    @Binding var selection: DeviceMode
    private let unswYellow = Color(red: 1.0, green: 0.84, blue: 0.0)
    private let unswDarkBlue = Color(red: 0.0, green: 0.2, blue: 0.4)
    
    var body: some View {
        HStack(spacing: 16) {
            ModeCard(
                mode: .REGISTRATION,
                title: "Registration",
                subtitle: "Student check-in and queue management",
                icon: "person.badge.plus.fill",
                isSelected: selection == .REGISTRATION,
                unswYellow: unswYellow,
                unswDarkBlue: unswDarkBlue
            ) {
                selection = .REGISTRATION
            }
            
            ModeCard(
                mode: .FEEDBACK,
                title: "Feedback",
                subtitle: "Collect student feedback and ratings",
                icon: "star.fill",
                isSelected: selection == .FEEDBACK,
                unswYellow: unswYellow,
                unswDarkBlue: unswDarkBlue
            ) {
                selection = .FEEDBACK
            }
        }
        .frame(maxWidth: 700)
    }
}

private struct ModeCard: View {
    let mode: DeviceMode
    let title: String
    let subtitle: String
    let icon: String
    let isSelected: Bool
    let unswYellow: Color
    let unswDarkBlue: Color
    let onTap: () -> Void
    
    var body: some View {
        Button(action: onTap) {
            VStack(spacing: 16) {
                Image(systemName: icon)
                    .font(.system(size: 36, weight: .semibold))
                    .foregroundColor(isSelected ? unswDarkBlue : .secondary)
                
                VStack(spacing: 6) {
                    Text(title)
                        .font(.system(size: 22, weight: .bold))
                        .foregroundColor(isSelected ? unswDarkBlue : .primary)
                    
                    Text(subtitle)
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                        .lineLimit(2)
                }
            }
            .frame(maxWidth: .infinity)
            .frame(height: 140)
            .padding(.vertical, 20)
            .padding(.horizontal, 16)
            .background(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(isSelected ? unswYellow.opacity(0.15) : Color.white)
                    .shadow(color: Color.black.opacity(isSelected ? 0.13 : 0.07), radius: isSelected ? 12 : 8, x: 0, y: isSelected ? 4 : 2)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(isSelected ? unswYellow : Color.clear, lineWidth: 3)
            )
            .scaleEffect(isSelected ? 1.02 : 1.0)
            .animation(.spring(response: 0.3, dampingFraction: 0.7), value: isSelected)
        }
        .buttonStyle(.plain)
    }
}

private struct UNSWPairButton: View {
    let isPairing: Bool
    let cameraPermissionDenied: Bool
    let onScanTapped: () -> Void
    let onSettingsTapped: () -> Void
    
    private let unswYellow = Color(red: 1.0, green: 0.84, blue: 0.0)
    private let unswDarkBlue = Color(red: 0.0, green: 0.2, blue: 0.4)
    
    var body: some View {
        VStack(spacing: 16) {
            if cameraPermissionDenied {
                VStack(spacing: 12) {
                    Button {
                        onSettingsTapped()
                    } label: {
                        HStack(spacing: 12) {
                            Image(systemName: "gearshape.fill")
                                .font(.system(size: 20, weight: .semibold))
                            Text("Open Camera Settings")
                                .fontWeight(.bold)
                                .font(.system(size: 20))
                        }
                        .frame(height: 60)
                        .frame(maxWidth: 400)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(unswDarkBlue)
                    .foregroundColor(.white)
                    .controlSize(.large)
                    
                    Text("Camera access is required to scan QR codes")
                        .font(.system(size: 16))
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                }
            } else {
                Button {
                    onScanTapped()
                } label: {
                    HStack(spacing: 12) {
                        if isPairing {
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle(tint: unswDarkBlue))
                                .scaleEffect(0.9)
                        } else {
                            Image(systemName: "qrcode.viewfinder")
                                .font(.system(size: 24, weight: .semibold))
                        }
                        Text(isPairing ? "Pairing Device..." : "Scan QR Code to Pair")
                            .fontWeight(.bold)
                            .font(.system(size: 20))
                    }
                    .frame(height: 60)
                    .frame(maxWidth: 400)
                }
                .buttonStyle(.borderedProminent)
                .tint(unswYellow)
                .foregroundColor(unswDarkBlue)
                .controlSize(.large)
                .disabled(isPairing)
            }
        }
    }
}
