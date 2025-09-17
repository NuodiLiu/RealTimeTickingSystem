import SwiftUI

struct ToastView: View {
    let message: String
    let style: ToastStyle
    @Binding var isShowing: Bool
    
    enum ToastStyle {
        case error, warning, info, success
        
        var backgroundColor: Color {
            switch self {
            case .error: return Color.red.opacity(0.9)
            case .warning: return Color.orange.opacity(0.9)
            case .info: return Color.blue.opacity(0.9)
            case .success: return Color.green.opacity(0.9)
            }
        }
        
        var iconName: String {
            switch self {
            case .error: return "exclamationmark.triangle.fill"
            case .warning: return "exclamationmark.triangle.fill"
            case .info: return "info.circle.fill"
            case .success: return "checkmark.circle.fill"
            }
        }
    }
    
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: style.iconName)
                .font(.system(size: 16, weight: .semibold))
            
            Text(message)
                .font(.system(size: 16, weight: .medium))
                .multilineTextAlignment(.center)
        }
        .foregroundColor(.white)
        .padding(.horizontal, 20)
        .padding(.vertical, 14)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(style.backgroundColor)
        )
        .shadow(color: Color.black.opacity(0.15), radius: 8, x: 0, y: 4)
        .padding(.horizontal, 20)
    }
}

struct ToastModifier: ViewModifier {
    @Binding var message: String?
    let style: ToastView.ToastStyle
    let duration: Double
    
    @State private var isShowing = false
    @State private var workItem: DispatchWorkItem?
    
    init(message: Binding<String?>, style: ToastView.ToastStyle, duration: Double = 3.0) {
        self._message = message
        self.style = style
        self.duration = duration
    }
    
    func body(content: Content) -> some View {
        content
            .overlay(alignment: .top) {
                if let msg = message, isShowing {
                    ToastView(message: msg, style: style, isShowing: $isShowing)
                        .padding(.top, 12)
                        .transition(.asymmetric(
                            insertion: .move(edge: .top).combined(with: .opacity),
                            removal: .move(edge: .top).combined(with: .opacity)
                        ))
                        .zIndex(1000)
                        .onTapGesture {
                            dismissToast()
                        }
                }
            }
            .onChange(of: message) { oldValue, newValue in
                if newValue != nil && newValue != oldValue {
                    showToast()
                }
            }
    }
    
    private func showToast() {
        workItem?.cancel()
        
        withAnimation(.spring(response: 0.5, dampingFraction: 0.8)) {
            isShowing = true
        }
        
        let task = DispatchWorkItem {
            withAnimation(.spring(response: 0.5, dampingFraction: 0.8)) {
                isShowing = false
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                    message = nil
                }
            }
        }
        
        workItem = task
        DispatchQueue.main.asyncAfter(deadline: .now() + duration, execute: task)
    }
    
    private func dismissToast() {
        workItem?.cancel()
        withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
            isShowing = false
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            message = nil
        }
    }
}

extension View {
    func showToast(message: Binding<String?>, style: ToastView.ToastStyle, duration: Double = 3.0) -> some View {
        modifier(ToastModifier(message: message, style: style, duration: duration))
    }
}
