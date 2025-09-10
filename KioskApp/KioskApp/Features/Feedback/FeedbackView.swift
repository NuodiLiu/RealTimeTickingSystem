import SwiftUI

struct FeedbackView: View {
    @ObservedObject var vm: FeedbackViewModel
    var onDismiss: (() -> Void)? = nil

    @FocusState private var textFocused: Bool

    var body: some View {
        ZStack {
            Color(.systemGroupedBackground).ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: 28) {
                    // Header
                    VStack(alignment: .leading, spacing: 6) {
                        Text("How was your experience?")
                            .font(.system(size: 34, weight: .bold))
                        Text("Please rate and leave an optional comment.")
                            .font(.title3)
                            .foregroundStyle(.secondary)
                    }

                    // Rating
                    VStack(alignment: .leading, spacing: 12) {
                        FieldTitle("Rate your experience", required: true)
                        StarRatingView(rating: $vm.rating, max: 5, size: 44)
                            .accessibilityLabel("Rating")
                    }

                    // Comment
                    VStack(alignment: .leading, spacing: 12) {
                        FieldTitle("Additional comments (optional)")
                        KioskTextEditor(
                            placeholder: "Type your comments here…",
                            text: $vm.text,
                            isFirstResponder: $textFocused,
                            minHeight: 160
                        )
                        .onSubmit { textFocused = false }

                        // 字数提示（可选）
                        Text("\(vm.text.count) characters")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }

                    Spacer(minLength: 120)
                }
                .padding(.horizontal, 32)
                .padding(.top, 36)
                .frame(maxWidth: 800)
                .frame(maxWidth: .infinity, alignment: .center)
            }
            // 允许下拉收起键盘（不依赖 keyboard toolbar）
            .scrollDismissesKeyboard(.interactively)

            // 底部固定操作条
            VStack(spacing: 0) {
                Spacer()
                Divider()
                HStack(spacing: 16) {
                    if onDismiss != nil {
                        Button("Close") { onDismiss?() }
                            .font(.system(size: 20, weight: .semibold))
                            .frame(height: 56)
                            .frame(maxWidth: 160)
                            .buttonStyle(.bordered)
                            .tint(Color.secondary)
                    }

                    Button {
                        Task {
                            await vm.submit()
                            if vm.submitted { onDismiss?() }
                        }
                    } label: {
                        HStack(spacing: 10) {
                            if vm.isSubmitting { ProgressView() }
                            Text(vm.isSubmitting ? "Submitting…" : "Submit")
                                .fontWeight(.semibold)
                        }
                        .font(.system(size: 20))
                        .frame(height: 56)
                        .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(Color.purple)
                    .disabled(!vm.canSubmit)
                }
                .padding(.horizontal, 32)
                .padding(.vertical, 16)
                .background(.ultraThinMaterial) // 轻磨砂，前台环境也清晰
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .onAppear { vm.onAppear() }
        // 顶部提示：提交成功 / 错误
        .overlay(alignment: .top) {
            VStack(spacing: 10) {
                if vm.submitted {
                    Banner(text: "Thanks for your feedback!", style: .success)
                }
                if let e = vm.errorMessage {
                    Banner(text: e, style: .error)
                }
            }
            .padding(.top, 8)
        }
    }
}

private struct FieldTitle: View {
    let text: String
    let required: Bool
    init(_ text: String, required: Bool = false) { self.text = text; self.required = required }
    var body: some View {
        HStack(spacing: 6) {
            Text(text).font(.system(size: 22, weight: .semibold))
            if required { Text("*").foregroundStyle(Color.red) }
        }
    }
}

/// 带 placeholder 的大号 TextEditor（kiosk 风格）
private struct KioskTextEditor: View {
    let placeholder: String
    @Binding var text: String
    @FocusState.Binding var isFirstResponder: Bool
    var minHeight: CGFloat = 140

    init(placeholder: String,
         text: Binding<String>,
         isFirstResponder: FocusState<Bool>.Binding,
         minHeight: CGFloat = 140) {
        self.placeholder = placeholder
        self._text = text
        self._isFirstResponder = isFirstResponder
        self.minHeight = minHeight
    }

    var body: some View {
        ZStack(alignment: .topLeading) {
            // Placeholder
            if text.isEmpty {
                Text(placeholder)
                    .foregroundStyle(.secondary)
                    .padding(.top, 14)
                    .padding(.leading, 16)
                    .allowsHitTesting(false)
            }

            TextEditor(text: $text)
                .focused(_isFirstResponder)
                .font(.system(size: 20))
                .frame(minHeight: minHeight)
                .padding(8)
        }
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(Color(.systemBackground))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(isFirstResponder ? Color.purple : Color(.quaternaryLabel), lineWidth: isFirstResponder ? 2 : 1)
        )
        .submitLabel(.done)
    }
}

/// 顶部轻量提示
private struct Banner: View {
    enum Style { case success, error }
    let text: String
    let style: Style
    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: style == .success ? "checkmark.circle.fill" : "exclamationmark.triangle.fill")
            Text(text).lineLimit(2)
        }
        .font(.system(size: 16, weight: .medium))
        .foregroundColor(.white)
        .padding(.vertical, 10)
        .padding(.horizontal, 14)
        .background(
            Capsule().fill(style == .success ? Color.green : Color.red)
        )
        .shadow(color: Color.black.opacity(0.15), radius: 8, x: 0, y: 4)
    }
}
