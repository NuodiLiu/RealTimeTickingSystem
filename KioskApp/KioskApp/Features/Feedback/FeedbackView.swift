import SwiftUI

// MARK: - Constants
private let MAX_FEEDBACK_LENGTH = 800

struct FeedbackView: View {
    @ObservedObject var vm: FeedbackViewModel
    var onDismiss: (() -> Void)? = nil

    @FocusState private var textFocused: Bool
    
    // UNSW 主题色
    private let unswYellow = Color(red: 1.0, green: 0.84, blue: 0.0)
    private let unswDarkBlue = Color(red: 0.0, green: 0.2, blue: 0.4)
    private let unswLightGray = Color(red: 0.95, green: 0.95, blue: 0.95)

    var body: some View {
        ZStack {
            // UNSW 主题背景：渐变从浅黄到白色
            LinearGradient(
                gradient: Gradient(colors: [unswYellow.opacity(0.1), Color.white]),
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()
            
            // UNSW Logo 水印背景
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
            .ignoresSafeArea(.keyboard)
            
            // 主体内容 - 使用固定布局，禁用滚动
            VStack(spacing: 32) {
                // UNSW 顶部标题区域
                UNSWFeedbackHeader()
                
                // 表单卡片
                VStack(alignment: .leading, spacing: 28) {
                    // Rating 字段
                    UNSWFormField(
                        title: "Rate your experience",
                        required: true,
                        content: {
                            StarRatingView(rating: $vm.rating, max: 5, size: 75)
                                .accessibilityLabel("Rating")
                        }
                    )

                    // Comment 字段
                    UNSWFormField(
                        title: "Additional comments (optional)",
                        content: {
                            UNSWTextEditor(
                                placeholder: "Type your comments here…",
                                text: $vm.text,
                                isFirstResponder: $textFocused,
                                minHeight: 120,
                                maxLength: MAX_FEEDBACK_LENGTH
                            )
                            .onSubmit { textFocused = false }

                            // 字符计数显示
                            HStack {
                                Spacer()
                                Text("\(vm.text.count)/\(MAX_FEEDBACK_LENGTH)")
                                    .font(.footnote)
                                    .foregroundStyle(
                                        vm.text.count >= MAX_FEEDBACK_LENGTH ? .red :
                                        vm.text.count >= (MAX_FEEDBACK_LENGTH - 50) ? .orange :
                                        .secondary
                                    )
                            }
                            .padding(.top, 8)
                        }
                    )

                    Spacer(minLength: 120)
                }
                .padding(32)
                .background(
                    Color.clear
                )
                .padding(.horizontal, 24)
                
                Spacer() // 填充剩余空间，推送底部按钮到底部
            }
            .frame(maxWidth: 800)
            .frame(maxWidth: .infinity, alignment: .center)
            .padding(.top, 20)

            // 底部操作按钮区域
            VStack(spacing: 0) {
                Spacer()
                
                // UNSW 风格的操作按钮区域
                VStack(spacing: 0) {
                    // 分割线
                    Rectangle()
                        .fill(unswYellow)
                        .frame(height: 3)
                    
                    HStack(spacing: 20) {
                        // Close 按钮（如果有 onDismiss）
                        if onDismiss != nil {
                            Button {
                                vm.cancel() // 发送取消消息到后端
                                onDismiss?()
                            } label: {
                                HStack(spacing: 8) {
                                    Image(systemName: "xmark.circle")
                                    Text("Close")
                                }
                                .font(.system(size: 22, weight: .semibold))
                                .frame(height: 60)
                                .frame(maxWidth: 180)
                            }
                            .buttonStyle(.bordered)
                            .tint(unswDarkBlue)
                            .controlSize(.large)
                        }

                        // Submit 按钮
                        Button {
                            Task {
                                await vm.submit()
                                if vm.submitted { 
                                    textFocused = false
                                    onDismiss?() 
                                }
                            }
                        } label: {
                            HStack(spacing: 12) {
                                if vm.isSubmitting { 
                                    ProgressView()
                                        .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                        .scaleEffect(0.8)
                                }
                                Text(vm.isSubmitting ? "Submitting..." : "Submit Feedback")
                                    .fontWeight(.bold)
                                if !vm.isSubmitting {
                                    Image(systemName: "arrow.right.circle.fill")
                                }
                            }
                            .font(.system(size: 22))
                            .frame(height: 60)
                            .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(unswYellow)
                        .foregroundColor(unswDarkBlue)
                        .controlSize(.large)
                        .disabled(!vm.canSubmit)
                    }
                    .padding(.horizontal, 32)
                    .padding(.vertical, 20)
                    .background(.ultraThinMaterial)
                }
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .onAppear { vm.onAppear() }
        .toolbar {
            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                Button("Done") { 
                    textFocused = false 
                }
                .foregroundColor(unswYellow)
            }
        }
        // 中心成功提示弹框
        .overlay {
            if vm.submitted {
                UNSWFeedbackSuccessModal()
                    .transition(.asymmetric(
                        insertion: .opacity.combined(with: .scale(scale: 0.8)).combined(with: .move(edge: .top)),
                        removal: .opacity.combined(with: .scale(scale: 0.9))
                    ))
                    .zIndex(1000)
                    .animation(.spring(response: 0.6, dampingFraction: 0.8), value: vm.submitted)
            }
        }
        // 错误提示保持在顶部
        .overlay(alignment: .top) {
            if let e = vm.errorMessage {
                UNSWBanner(text: e, style: .error)
                    .padding(.top, 12)
            }
        }
        // .devResetGesture() // 添加开发者重置手势 - DISABLED
        // 添加点击手势来取消键盘焦点
        .onTapGesture {
            textFocused = false
        }
    }
}

// MARK: - UNSW 主题组件

/// UNSW 风格的反馈页面标题
private struct UNSWFeedbackHeader: View {
    var body: some View {
        VStack(spacing: 32) {
            VStack(spacing: 12) {
                Text("How was your experience?")
                    .font(.system(size: 36, weight: .heavy, design: .rounded))
                    .foregroundColor(Color(red: 0.0, green: 0.2, blue: 0.4))
            
                Text("We’d love to hear your feedback!")
                    .font(.system(size: 20, weight: .medium))
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
            }
        }
        .padding(.horizontal, 24)
        .padding(.top, 40)
    }
}

/// UNSW 风格的表单字段容器
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

/// UNSW 风格的文本编辑器
private struct UNSWTextEditor: View {
    let placeholder: String
    @Binding var text: String
    @FocusState.Binding var isFirstResponder: Bool
    var minHeight: CGFloat = 140
    var maxLength: Int = MAX_FEEDBACK_LENGTH
    
    private let unswYellow = Color(red: 1.0, green: 0.84, blue: 0.0)
    private let unswDarkBlue = Color(red: 0.0, green: 0.2, blue: 0.4)

    init(placeholder: String,
         text: Binding<String>,
         isFirstResponder: FocusState<Bool>.Binding,
         minHeight: CGFloat = 140,
         maxLength: Int = MAX_FEEDBACK_LENGTH) {
        self.placeholder = placeholder
        self._text = text
        self._isFirstResponder = isFirstResponder
        self.minHeight = minHeight
        self.maxLength = maxLength
    }

    var body: some View {
        ZStack(alignment: .topLeading) {
            // Placeholder
            if text.isEmpty {
                Text(placeholder)
                    .foregroundStyle(.secondary)
                    .font(.system(size: 18, weight: .medium))
                    .padding(.top, 18)
                    .padding(.leading, 20)
                    .allowsHitTesting(false)
            }

            TextEditor(text: $text)
                .focused(_isFirstResponder)
                .font(.system(size: 18, weight: .medium))
                .frame(minHeight: minHeight)
                .padding(12)
                .scrollBounceBehavior(.basedOnSize)
                .onChange(of: text) { _, newValue in
                    // 限制字符数
                    if newValue.count > maxLength {
                        text = String(newValue.prefix(maxLength))
                    }
                }
        }
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(Color.white)
                .shadow(color: Color.black.opacity(0.05), radius: 8, x: 0, y: 2)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(
                    text.count >= maxLength ? .orange : (isFirstResponder ? unswYellow : Color(.systemGray4)), 
                    lineWidth: isFirstResponder || text.count >= maxLength ? 3 : 1.5
                )
        )
        .submitLabel(.done)
        .simultaneousGesture(
            TapGesture().onEnded { _ in
                isFirstResponder = true
            }
        )
    }
}

/// UNSW 风格的通知横幅
private struct UNSWBanner: View {
    enum Style { case success, error }
    let text: String
    let style: Style
    
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: style == .success ? "checkmark.circle.fill" : "exclamationmark.triangle.fill")
                .font(.system(size: 18, weight: .bold))
            
            Text(text)
                .font(.system(size: 16, weight: .semibold))
                .lineLimit(3)
            
            Spacer()
        }
        .foregroundColor(.white)
        .padding(.vertical, 16)
        .padding(.horizontal, 20)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(style == .success ? .green : .red)
                .shadow(color: Color.black.opacity(0.2), radius: 12, x: 0, y: 6)
        )
        .padding(.horizontal, 24)
    }
}

/// UNSW 风格的反馈成功弹框
private struct UNSWFeedbackSuccessModal: View {
    private let unswYellow = Color(red: 1.0, green: 0.84, blue: 0.0)
    private let unswDarkBlue = Color(red: 0.0, green: 0.2, blue: 0.4)
    
    var body: some View {
        ZStack {
            // 半透明背景
            Color.black.opacity(0.4)
                .ignoresSafeArea()
            
            // 成功提示卡片
            VStack(spacing: 32) {
                // 成功图标
                ZStack {
                    Circle()
                        .fill(unswYellow)
                        .frame(width: 120, height: 120)
                        .shadow(color: unswYellow.opacity(0.3), radius: 20, x: 0, y: 8)
                    
                    Image(systemName: "heart.fill")
                        .font(.system(size: 50, weight: .bold))
                        .foregroundColor(unswDarkBlue)
                }
                
                VStack(spacing: 20) {
                    Text("Thank You!")
                        .font(.system(size: 32, weight: .heavy, design: .rounded))
                        .foregroundColor(unswDarkBlue)
                        .multilineTextAlignment(.center)
                    
                    Text("Your feedback helps us improve our services.")
                        .font(.system(size: 20, weight: .medium))
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                        .lineLimit(3)
                        .fixedSize(horizontal: false, vertical: true)
                }
                
                // UNSW Logo 装饰
                HStack(spacing: 12) {
                    Image(systemName: "graduationcap.fill")
                        .font(.system(size: 24))
                        .foregroundColor(unswYellow)
                    
                    Text("UNSW Student Services")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(unswDarkBlue)
                    
                    Image(systemName: "graduationcap.fill")
                        .font(.system(size: 24))
                        .foregroundColor(unswYellow)
                }
                .opacity(0.8)
            }
            .padding(48)
            .background(
                RoundedRectangle(cornerRadius: 24, style: .continuous)
                    .fill(.regularMaterial)
                    .background(
                        RoundedRectangle(cornerRadius: 24, style: .continuous)
                            .fill(Color.white)
                    )
                    .shadow(color: Color.black.opacity(0.15), radius: 30, x: 0, y: 15)
            )
            .frame(maxWidth: 500)
            .padding(.horizontal, 32)
        }
    }
}

// MARK: - 保留原有组件（向后兼容）

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
