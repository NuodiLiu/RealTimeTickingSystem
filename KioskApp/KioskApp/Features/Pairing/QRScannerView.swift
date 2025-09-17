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

    func makeUIView(context: Context) -> CameraPreviewView {
        let view = CameraPreviewView()
        view.onCodeScanned = onFound
        view.onError = { error in
            print("QR Scanner Error: \(error)")
        }
        return view
    }

    func updateUIView(_ uiView: CameraPreviewView, context: Context) {
        uiView.onCodeScanned = onFound
    }
    
    static func dismantleUIView(_ uiView: CameraPreviewView, coordinator: ()) {
        uiView.stopSession()
    }
}

final class CameraPreviewView: UIView {
    
    // MARK: - Properties
    private let captureSession = AVCaptureSession()
    private var previewLayer: AVCaptureVideoPreviewLayer?
    private let videoOutput = AVCaptureMetadataOutput()
    private var isSessionRunning = false
    private var hasScannedCode = false
    private var setupCompleted = false
    
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
        
        let videoInput: AVCaptureDeviceInput
        do {
            videoInput = try AVCaptureDeviceInput(device: videoCaptureDevice)
        } catch {
            print("Failed to create video input: \(error)")
            onError?("Failed to create video input: \(error.localizedDescription)")
            return
        }
        
        captureSession.beginConfiguration()
        
        if captureSession.canAddInput(videoInput) {
            captureSession.addInput(videoInput)
            print("Video input added")
        } else {
            print("Could not add video input")
            onError?("Could not add video input")
            captureSession.commitConfiguration()
            return
        }
        
        if captureSession.canAddOutput(videoOutput) {
            captureSession.addOutput(videoOutput)
            videoOutput.setMetadataObjectsDelegate(self, queue: DispatchQueue.main)
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
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            guard let self = self, !self.isSessionRunning else { return }
            self.captureSession.startRunning()
            DispatchQueue.main.async {
                self.isSessionRunning = true
                print("Capture session started")
            }
        }
    }
    
    func stopSession() {
        guard isSessionRunning else { return }
        
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            self?.captureSession.stopRunning()
            DispatchQueue.main.async {
                self?.isSessionRunning = false
                self?.onCodeScanned = nil
            }
        }
    }
    
    // MARK: - Layout
    override func layoutSubviews() {
        super.layoutSubviews()
        previewLayer?.frame = bounds
    }
    
    // MARK: - Cleanup
    deinit {
        stopSession()
        previewLayer?.removeFromSuperlayer()
    }
}

// MARK: - AVCaptureMetadataOutputObjectsDelegate
extension CameraPreviewView: AVCaptureMetadataOutputObjectsDelegate {
    func metadataOutput(_ output: AVCaptureMetadataOutput, 
                       didOutput metadataObjects: [AVMetadataObject], 
                       from connection: AVCaptureConnection) {
        
        guard !hasScannedCode,
              let metadataObject = metadataObjects.first,
              let readableObject = metadataObject as? AVMetadataMachineReadableCodeObject,
              readableObject.type == .qr,
              let stringValue = readableObject.stringValue else { return }
        
        hasScannedCode = true
        
        stopSession()
        
        onCodeScanned?(stringValue)
    }
}
