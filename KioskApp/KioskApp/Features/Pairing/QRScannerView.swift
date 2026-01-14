//
//  QRScannerSheet.swift
//  KioskApp
//
//  Created by liunuodi on 9/9/2025.
//

import SwiftUI
import AVFoundation

struct QRScannerView: UIViewRepresentable {
    let onFound: (String) -> Void
    @State private var cameraView: CameraPreviewView?

    func makeUIView(context: Context) -> CameraPreviewView {
        let view = CameraPreviewView()
        view.onCodeScanned = onFound
        view.onError = { error in
            print("QR Scanner Error: \(error)")
        }
        DispatchQueue.main.async {
            self.cameraView = view
        }
        return view
    }

    func updateUIView(_ uiView: CameraPreviewView, context: Context) {
        uiView.onCodeScanned = onFound
    }
    
    static func dismantleUIView(_ uiView: CameraPreviewView, coordinator: ()) {
        // Stop session early to avoid lag when view is removed
        uiView.prepareForRemoval()
    }
}

final class CameraPreviewView: UIView {
    
    // MARK: - Properties
    private let captureSession = AVCaptureSession()
    private var previewLayer: AVCaptureVideoPreviewLayer?
    private let videoOutput = AVCaptureMetadataOutput()
    private var videoInput: AVCaptureDeviceInput?
    private let metadataQueue = DispatchQueue(label: "com.kioskapp.metadata", qos: .userInitiated)
    private var isSessionRunning = false
    private var hasScannedCode = false
    private var setupCompleted = false
    private var isDeallocating = false
    
    var onCodeScanned: ((String) -> Void)?
    var onError: ((String) -> Void)?
    
    // MARK: - Initialisation
    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = .black 
        setupCamera()
    }
    
    required init?(coder: NSCoder) {
        super.init(coder: coder)
        backgroundColor = .black
        setupCamera()
    }
    
    // MARK: - Setup
    private func setupCamera() {
        print("📱 Setting up camera...")
        
        checkCameraPermission { [weak self] granted in
            DispatchQueue.main.async {
                if granted {
                    self?.initializeCamera()
                } else {
                    print("Camera permission denied - camera will not be initialized")
                }
            }
        }
    }
    
    private func checkCameraPermission(completion: @escaping (Bool) -> Void) {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            print("Camera permission: Authorized")
            completion(true)
        case .notDetermined:
            print("Camera permission: Requesting...")
            AVCaptureDevice.requestAccess(for: .video) { granted in
                print("Camera permission: \(granted ? "Granted" : "Denied")")
                completion(granted)
            }
        case .denied, .restricted:
            print("Camera permission: Denied/Restricted - will not initialize camera")
            // 权限被拒绝时，不要调用 onError，让上层处理
            completion(false)
        @unknown default:
            print("Camera permission: Unknown")
            completion(false)
        }
    }
    
    private func initializeCamera() {
        print("Initialising camera...")
        
        guard let videoCaptureDevice = AVCaptureDevice.default(for: .video) else {
            print("Failed to get camera device")
            onError?("No camera device found")
            return
        }
        
        print("Camera device found: \(videoCaptureDevice.localizedName)")
        
        let videoInputDevice: AVCaptureDeviceInput
        do {
            videoInputDevice = try AVCaptureDeviceInput(device: videoCaptureDevice)
        } catch {
            print("Failed to create video input: \(error)")
            onError?("Failed to create video input: \(error.localizedDescription)")
            return
        }
        
        self.videoInput = videoInputDevice
        
        captureSession.beginConfiguration()
        
        if captureSession.canAddInput(videoInputDevice) {
            captureSession.addInput(videoInputDevice)
            print("Video input added")
        } else {
            print("Could not add video input")
            onError?("Could not add video input")
            captureSession.commitConfiguration()
            return
        }
        
        if captureSession.canAddOutput(videoOutput) {
            captureSession.addOutput(videoOutput)
            // Delay delegate setup to avoid weak reference issues during initialization
            videoOutput.metadataObjectTypes = [.qr]
            print("Metadata output added")
        } else {
            print("Could not add metadata output")
            onError?("Could not add metadata output")
            captureSession.commitConfiguration()
            return
        }
        
        captureSession.commitConfiguration()
        
        setupCompleted = true
        setupPreviewLayer()
        startSession()
    }
    
    private func setupPreviewLayer() {
        print("Setting up preview layer...")
        let previewLayer = AVCaptureVideoPreviewLayer(session: captureSession)
        previewLayer.frame = bounds
        previewLayer.videoGravity = .resizeAspectFill
        
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.layer.addSublayer(previewLayer)
            self.previewLayer = previewLayer
            print("Preview layer added")
        }
    }
    
    private func startSession() {
        print("Starting capture session...")
        
        // Set delegate only when we're ready to start - this is the critical timing fix
        guard !isDeallocating else {
            print("View is deallocating, skipping session start")
            return
        }
        
        videoOutput.setMetadataObjectsDelegate(self, queue: metadataQueue)
        
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            guard let self = self, !self.isSessionRunning, !self.isDeallocating else { return }
            self.captureSession.startRunning()
            DispatchQueue.main.async {
                self.isSessionRunning = true
                print("Capture session started")
            }
        }
    }
    
    func stopSession() {
        guard !isDeallocating else { return }
        isDeallocating = true
        
        print("Stopping capture session...")
        
        // Clear delegate immediately
        videoOutput.setMetadataObjectsDelegate(nil, queue: nil)
        onCodeScanned = nil
        
        // Stop session asynchronously to avoid blocking
        if captureSession.isRunning {
            DispatchQueue.global(qos: .userInitiated).async { [weak self] in
                self?.captureSession.stopRunning()
                DispatchQueue.main.async {
                    self?.isSessionRunning = false
                    print("Capture session stopped")
                }
            }
        } else {
            isSessionRunning = false
        }
    }
    
    // Called by UIViewRepresentable when view is being removed - gives us time to clean up
    func prepareForRemoval() {
        guard !isDeallocating else { return }
        print("Preparing camera for removal...")
        isDeallocating = true
        
        // Immediately clear delegate to prevent any callbacks
        videoOutput.setMetadataObjectsDelegate(nil, queue: nil)
        onCodeScanned = nil
        
        // Stop session with proper cleanup in background
        let session = self.captureSession
        let input = self.videoInput
        let output = self.videoOutput
        
        DispatchQueue.global(qos: .userInitiated).async {
            // Stop running first
            if session.isRunning {
                session.stopRunning()
            }
            
            // Then remove inputs and outputs to clean up resources
            session.beginConfiguration()
            
            if let input = input {
                session.removeInput(input)
            }
            
            session.removeOutput(output)
            
            session.commitConfiguration()
            
            print("Camera session cleaned up and stopped")
        }
    }
    
    // MARK: - Layout
    override func layoutSubviews() {
        super.layoutSubviews()
        previewLayer?.frame = bounds
    }
    
    // MARK: - Cleanup
    deinit {
        print("CameraPreviewView deinit called")
        isDeallocating = true
        
        // Clear delegate if not already cleared
        videoOutput.setMetadataObjectsDelegate(nil, queue: nil)
        
        // Remove preview layer
        previewLayer?.removeFromSuperlayer()
        
        // Don't stop session synchronously here - it should already be stopped by stopSession()
        // If still running, let the system clean it up to avoid blocking deinit
        
        print("CameraPreviewView deallocated")
    }
}

// MARK: - AVCaptureMetadataOutputObjectsDelegate
extension CameraPreviewView: AVCaptureMetadataOutputObjectsDelegate {
    func metadataOutput(_ output: AVCaptureMetadataOutput, 
                       didOutput metadataObjects: [AVMetadataObject], 
                       from connection: AVCaptureConnection) {
        
        // Extra safety check
        guard !isDeallocating, !hasScannedCode else { return }
        
        guard let metadataObject = metadataObjects.first,
              let readableObject = metadataObject as? AVMetadataMachineReadableCodeObject,
              readableObject.type == .qr,
              let stringValue = readableObject.stringValue else { return }
        
        hasScannedCode = true
        
        // Clear delegate immediately after first scan
        videoOutput.setMetadataObjectsDelegate(nil, queue: nil)
        
        // Save callback before stopping session (which clears it)
        let callback = onCodeScanned
        
        stopSession()
        
        callback?(stringValue)
    }
}
