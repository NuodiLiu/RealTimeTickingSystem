import SwiftUI
import WebKit
// import SharedUI   // 若 InlineDropdown 在独立模块

// MARK: - 全局下拉状态管理
enum ActiveDropdown: Hashable {
    case category
    // 可扩展更多下拉项
}

struct RegistrationView: View {
    @ObservedObject var vm: RegistrationViewModel
    @FocusState private var zidFocused: Bool
    @FocusState private var nameFocused: Bool
    @State private var active: ActiveDropdown? = nil
    
    // 从环境获取 AppEnvironment，以便访问重置功能
    private let appEnv = AppEnvironment.shared
    
    // UNSW 主题色
    private let unswYellow = Color(red: 1.0, green: 0.84, blue: 0.0) // UNSW 黄色
    private let unswDarkBlue = Color(red: 0.0, green: 0.2, blue: 0.4) // UNSW 深蓝色
    private let unswLightGray = Color(red: 0.95, green: 0.95, blue: 0.95) // 浅灰背景

    // 把 categoryId ↔ CategoryItem? 做成绑定，InlineDropdown 才能直接显示所选名称
    private var selectedCategoryBinding: Binding<CategoryItem?> {
        Binding(
            get: { vm.categories.first(where: { $0.id == vm.categoryId }) },
            set: { vm.categoryId = $0?.id ?? "" }
        )
    }

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
                UNSWHeader()
                
                // 表单卡片
                VStack(alignment: .leading, spacing: 28) {
                        // ZID 字段
                        UNSWFormField(
                            title: "Student ID (zID)",
                            required: !vm.noZIDChecked, // 当勾选"没有zID"时，不是必填项
                            content: {
                                VStack(alignment: .leading, spacing: 16) {
                                    UNSWTextField(
                                        placeholder: vm.noZIDChecked ? "N/A" : "Please enter your zID",
                                        text: $vm.zID,
                                        isFirstResponder: $zidFocused,
                                        hasError: vm.shouldShowZIDError,
                                        activeDropdown: $active
                                    )
                                    .disabled(vm.noZIDChecked) // 当勾选时禁用输入
                                    .opacity(vm.noZIDChecked ? 0.5 : 1.0) // 当勾选时变灰
                                    .onSubmit { 
                                        zidFocused = false
                                        nameFocused = true
                                    }
                                    .onChange(of: vm.noZIDChecked) { _, newValue in
                                        if newValue {
                                            vm.zID = "" // 勾选时清空zID
                                            zidFocused = false // 失去焦点
                                        }
                                    }
                                    
                                    // "I don't have a zID" 复选框
                                    HStack(spacing: 8) {
                                        Button(action: {
                                            vm.noZIDChecked.toggle()
                                        }) {
                                            HStack(spacing: 8) {
                                                Image(systemName: vm.noZIDChecked ? "checkmark.square.fill" : "square")
                                                    .font(.system(size: 18))
                                                    .foregroundColor(vm.noZIDChecked ? unswDarkBlue : .gray)
                                                Text("I don't have a zID")
                                                    .font(.system(size: 16, weight: .medium))
                                                    .foregroundColor(.gray)
                                            }
                                        }
                                        .buttonStyle(PlainButtonStyle())
                                    }
                                    .padding(.leading, 2)
                                }
                            }
                        )
                        
                        // NAME 字段
                        UNSWFormField(
                            title: "Your Full Name",
                            required: true,
                            content: {
                                UNSWTextField(
                                    placeholder: "Please enter your full name",
                                    text: $vm.name,
                                    isFirstResponder: $nameFocused,
                                    activeDropdown: $active
                                )
                                .onSubmit { nameFocused = false }
                            }
                        )

                        // CATEGORY 字段
                        UNSWFormField(
                            title: "What is your enquiry about?",
                            required: true,
                            content: {
                                if vm.categories.isEmpty {
                                    UNSWEmptyHint()
                                } else {
                                    InlineDropdown(
                                        title: "Category",
                                        items: vm.categories,
                                        selection: selectedCategoryBinding,
                                        name: { $0.name },
                                        placeholder: "Select a category...",
                                        headerHidden: true,
                                        expanded: Binding(
                                            get: { active == .category },
                                            set: { $0 ? (active = .category) : (active = nil) }
                                        )
                                    )
                                    .unswDropdownStyle()
                                    .simultaneousGesture(
                                        TapGesture().onEnded { _ in
                                            // 点击下拉时让所有输入框失去焦点
                                            zidFocused = false
                                            nameFocused = false
                                        }
                                    )
                                }
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
                    // Privacy Policy 勾选框
                    HStack(spacing: 8) {
                        // Checkbox button
                        Button(action: {
                            vm.privacyPolicyAccepted.toggle()
                        }) {
                            Image(systemName: vm.privacyPolicyAccepted ? "checkmark.square.fill" : "square")
                                .font(.system(size: 22))
                                .foregroundColor(vm.privacyPolicyAccepted ? unswDarkBlue : .gray)
                        }
                        .buttonStyle(PlainButtonStyle())
                        
                        // Text with separate link
                        HStack(spacing: 4) {
                            Text("I have read and agree to")
                                .font(.system(size: 16, weight: .medium))
                                .foregroundColor(.primary.opacity(0.6)) // Dark gray
                            
                            Button(action: {
                                vm.openPrivacyPolicy()
                            }) {
                                Text("Privacy Policy")
                                    .font(.system(size: 16, weight: .medium))
                                    .foregroundColor(.secondary) // Secondary color (blue)
                                    .underline()
                            }
                            .buttonStyle(PlainButtonStyle())
                        }
                    }
                    .padding(.horizontal, 32)
                    .padding(.vertical, 16)
                    
                    // 分割线
                    Rectangle()
                        .fill(unswYellow)
                        .frame(height: 3)
                    
                    HStack(spacing: 20) {
                        // Clear 按钮
                        Button {
                            vm.zID = ""
                            vm.name = ""
                            vm.noZIDChecked = false // 重置复选框状态
                            vm.privacyPolicyAccepted = false // 重置隐私政策状态
                            if let first = vm.categories.first { vm.categoryId = first.id }
                            // 不聚焦任何输入框，保持所有输入框失去焦点状态
                            zidFocused = false
                            nameFocused = false
                            // 同时关闭任何展开的下拉
                            active = nil
                        } label: {
                            HStack(spacing: 8) {
                                Image(systemName: "arrow.clockwise")
                                Text("Clear")
                            }
                            .font(.system(size: 22, weight: .semibold))
                            .frame(height: 60)
                            .frame(maxWidth: 180)
                        }
                        .buttonStyle(.bordered)
                        .tint(unswDarkBlue)
                        .controlSize(.large)

                        // Submit 按钮
                        Button {
                            Task { 
                                await vm.submitWithPrivacyCheck()
                                if vm.lastCreatedCaseId != nil {
                                    // 提交成功后不聚焦任何输入框
                                    zidFocused = false
                                    nameFocused = false
                                    // 关闭任何展开的下拉
                                    active = nil
                                }
                            }
                        } label: {
                            HStack(spacing: 12) {
                                if vm.isSubmitting { 
                                    ProgressView()
                                        .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                        .scaleEffect(0.8)
                                }
                                Text(vm.isSubmitting ? "Submitting..." : "Submit Registration")
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
                        .disabled(!vm.canSubmit || vm.categories.isEmpty)
                    }
                    .padding(.horizontal, 32)
                    .padding(.vertical, 20)
                    .background(.ultraThinMaterial)
                }
            }
        }
        .onAppear {
            if vm.categoryId.isEmpty, let first = vm.categories.first {
                vm.categoryId = first.id
            }
        }
        .toolbar {
            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                Button("Done") { 
                    nameFocused = false 
                }
                .foregroundColor(unswYellow)
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .onChange(of: vm.categories) { _, items in
            if !items.contains(where: { $0.id == vm.categoryId }) {
                vm.categoryId = items.first?.id ?? ""
            } else if vm.categoryId.isEmpty, let first = items.first {
                vm.categoryId = first.id
            }
        }
        // 中心成功提示弹框
        .overlay {
            if vm.lastCreatedCaseId != nil {
                UNSWSuccessModal(vm: vm)
                    .transition(.asymmetric(
                        insertion: .opacity.combined(with: .scale(scale: 0.8)).combined(with: .move(edge: .top)),
                        removal: .opacity.combined(with: .scale(scale: 0.9))
                    ))
                    .zIndex(1000)
                    .animation(.spring(response: 0.6, dampingFraction: 0.8), value: vm.lastCreatedCaseId)
                    .ignoresSafeArea(.keyboard)
            }
        }
        // 隐私政策模态框
        .overlay {
            if vm.showPrivacyPolicyModal {
                UNSWPrivacyPolicyModal(vm: vm)
                    .transition(.asymmetric(
                        insertion: .opacity.combined(with: .scale(scale: 0.8)).combined(with: .move(edge: .top)),
                        removal: .opacity.combined(with: .scale(scale: 0.9))
                    ))
                    .zIndex(1001)
                    .animation(.spring(response: 0.6, dampingFraction: 0.8), value: vm.showPrivacyPolicyModal)
                    .ignoresSafeArea(.keyboard)
            }
        }
        // 隐私政策网页
        .overlay {
            if vm.showPrivacyPolicyWebView {
                UNSWPrivacyPolicyWebView(vm: vm)
                    .transition(.asymmetric(
                        insertion: .opacity.combined(with: .scale(scale: 0.8)).combined(with: .move(edge: .bottom)),
                        removal: .opacity.combined(with: .scale(scale: 0.9))
                    ))
                    .zIndex(1002)
                    .animation(.spring(response: 0.6, dampingFraction: 0.8), value: vm.showPrivacyPolicyWebView)
                    .ignoresSafeArea(.keyboard)
            }
        }
        // 错误提示保持在顶部
        .overlay(alignment: .top) {
            if let e = vm.errorMessage {
                UNSWBanner(text: e, style: .error)
                    .padding(.top, 12)
            }
        }
        // .devResetGesture() // DISABLED
        .onTapGesture {
            // 只用于收起键盘焦点和关闭模态框
            zidFocused = false
            nameFocused = false
            vm.showPrivacyPolicyModal = false
            if active != nil {
                withAnimation(.spring(response: 0.25, dampingFraction: 0.9)) {
                    active = nil
                }
            }
        }
    }
}

// MARK: - UNSW 主题组件

/// UNSW 风格的页面标题
private struct UNSWHeader: View {
    var body: some View {
            VStack(spacing: 32) {
                VStack(spacing: 12) {
                    Text("Student Registration")
                        .font(.system(size: 36, weight: .heavy, design: .rounded))
                        .foregroundColor(Color(red: 0.0, green: 0.2, blue: 0.4))
                
                    Text("Please complete this form to join the queue")
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

/// UNSW 风格的文本输入框
private struct UNSWTextField: View {
    let placeholder: String
    @Binding var text: String
    @FocusState.Binding var isFirstResponder: Bool
    let hasError: Bool
    @Binding var activeDropdown: ActiveDropdown? // 新增字段
    
    private let unswYellow = Color(red: 1.0, green: 0.84, blue: 0.0)
    private let unswDarkBlue = Color(red: 0.0, green: 0.2, blue: 0.4)
    
    init(placeholder: String, text: Binding<String>, isFirstResponder: FocusState<Bool>.Binding, hasError: Bool = false, activeDropdown: Binding<ActiveDropdown?>) {
        self.placeholder = placeholder
        self._text = text
        self._isFirstResponder = isFirstResponder
        self.hasError = hasError
        self._activeDropdown = activeDropdown
    }
    
    var body: some View {
        TextField(placeholder, text: $text)
            .focused(_isFirstResponder)
            .textInputAutocapitalization(.words)
            .disableAutocorrection(true)
            .font(.system(size: 18, weight: .medium))
            .padding(.vertical, 18)
            .padding(.horizontal, 20)
            .background(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(Color.white)
                    .shadow(color: Color.black.opacity(0.05), radius: 8, x: 0, y: 2)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(
                        hasError ? Color.red : (isFirstResponder ? unswYellow : Color(.systemGray4)), 
                        lineWidth: hasError ? 3 : (isFirstResponder ? 3 : 1.5)
                    )
            )
            .submitLabel(.done)
            .simultaneousGesture(
                TapGesture().onEnded { _ in
                    isFirstResponder = true
                    // 关闭下拉菜单
                    if activeDropdown != nil {
                        withAnimation(.spring(response: 0.25, dampingFraction: 0.9)) {
                            activeDropdown = nil
                        }
                    }
                }
            )
    }
}

/// UNSW 风格的空状态提示
private struct UNSWEmptyHint: View {
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "info.circle.fill")
                .foregroundColor(Color(red: 1.0, green: 0.84, blue: 0.0))
            Text("No categories available at the moment")
                .font(.system(size: 16, weight: .medium))
        }
        .foregroundColor(.secondary)
        .padding(.vertical, 16)
        .padding(.horizontal, 20)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color(red: 1.0, green: 0.84, blue: 0.0).opacity(0.1))
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

/// 给 InlineDropdown 应用 UNSW 风格
private extension View {
    func unswDropdownStyle() -> some View {
        self
            .font(.system(size: 18, weight: .medium))
            .padding(.vertical, 2)
    }
}

// MARK: - 保留原有组件（向后兼容）

private struct Header: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Front Desk Registration")
                .font(.system(size: 34, weight: .bold))
            Text("Please complete the fields below.")
                .font(.title3)
                .foregroundStyle(.secondary)
        }
    }
}

private struct FieldTitle: View {
    let text: String
    let required: Bool
    init(_ text: String, required: Bool = false) { self.text = text; self.required = required }
    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 6) {
            Text(text)
                .font(.system(size: 22, weight: .semibold))
            if required { Text("*").foregroundStyle(Color.red) }
        }
    }
}

/// 大触控区文本框（kiosk风格，下划线或边框都可，这里用边框）
private struct KioskTextField: View {
    let placeholder: String
    @Binding var text: String
    @FocusState.Binding var isFirstResponder: Bool
    init(placeholder: String, text: Binding<String>, isFirstResponder: FocusState<Bool>.Binding) {
        self.placeholder = placeholder
        self._text = text
        self._isFirstResponder = isFirstResponder
    }
    var body: some View {
        TextField(placeholder, text: $text)
            .focused(_isFirstResponder)
            .textInputAutocapitalization(.words)
            .disableAutocorrection(true)
            .font(.system(size: 20))
            .padding(.vertical, 16)
            .padding(.horizontal, 14)
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
/// 空分类提示
private struct EmptyHint: View {
    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "info.circle")
            Text("No categories configured")
        }
        .font(.system(size: 18))
        .foregroundStyle(.secondary)
        .padding(.vertical, 8)
    }
}

/// 轻量顶部提示条（成功/错误）
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

/// 给 InlineDropdown 套一层 kiosk 交互风格（统一触控高度/字体）
private extension View {
    func kioskControlStyle() -> some View {
        self
            .font(.system(size: 20))
            .padding(.vertical, 2) // 由控件内部控制主要高度
    }
}

/// UNSW 风格的成功弹框
private struct UNSWSuccessModal: View {
    let vm: RegistrationViewModel
    private let unswYellow = Color(red: 1.0, green: 0.84, blue: 0.0)
    private let unswDarkBlue = Color(red: 0.0, green: 0.2, blue: 0.4)
    
    var body: some View {
        ZStack {
            // 半透明背景 - 添加点击手势
            Color.black.opacity(0.4)
                .ignoresSafeArea()
                .onTapGesture {
                    vm.clearSuccess()
                }
            
            // 成功提示卡片
            VStack(spacing: 32) {
                // 成功图标
                ZStack {
                    Circle()
                        .fill(unswYellow)
                        .frame(width: 120, height: 120)
                        .shadow(color: unswYellow.opacity(0.3), radius: 20, x: 0, y: 8)
                    
                    Image(systemName: "checkmark")
                        .font(.system(size: 60, weight: .bold))
                        .foregroundColor(unswDarkBlue)
                }
                
                VStack(spacing: 20) {
                    Text("Registration Successful!")
                        .font(.system(size: 32, weight: .heavy, design: .rounded))
                        .foregroundColor(unswDarkBlue)
                        .multilineTextAlignment(.center)
                    
                    Text("Thank you! Please have a seat and we'll call your name shortly.")
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
            .onTapGesture {
                // 阻止点击成功卡片时触发背景的清除手势
            }
        }
    }
}

/// UNSW 风格的隐私政策模态框
private struct UNSWPrivacyPolicyModal: View {
    let vm: RegistrationViewModel
    private let unswYellow = Color(red: 1.0, green: 0.84, blue: 0.0)
    private let unswDarkBlue = Color(red: 0.0, green: 0.2, blue: 0.4)
    
    var body: some View {
        ZStack {
            // 半透明背景
            Color.black.opacity(0.4)
                .ignoresSafeArea()
            
            // 隐私政策提示卡片
            VStack(spacing: 32) {
                // 提示图标
                ZStack {
                    Circle()
                        .fill(unswYellow)
                        .frame(width: 100, height: 100)
                        .shadow(color: unswYellow.opacity(0.3), radius: 20, x: 0, y: 8)
                    
                    Image(systemName: "info.circle")
                        .font(.system(size: 50, weight: .bold))
                        .foregroundColor(unswDarkBlue)
                }
                
                VStack(spacing: 20) {
                    Text("Privacy Policy Agreement Required")
                        .font(.system(size: 28, weight: .heavy, design: .rounded))
                        .foregroundColor(unswDarkBlue)
                        .multilineTextAlignment(.center)
                    
                    VStack(spacing: 8) {
                        HStack(spacing: 4) {
                            Text("Please read and agree to our")
                                .font(.system(size: 18, weight: .medium))
                                .foregroundColor(.secondary)
                            
                            Button(action: {
                                vm.openPrivacyPolicy()
                            }) {
                                Text("Privacy Policy")
                                    .font(.system(size: 18, weight: .medium))
                                    .foregroundColor(.blue)
                                    .underline()
                            }
                            .buttonStyle(PlainButtonStyle())
                        }
                        
                        Text("to continue with your registration.")
                            .font(.system(size: 18, weight: .medium))
                            .foregroundColor(.secondary)
                    }
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
                }
                
                // 按钮区域
                HStack(spacing: 16) {
                    // Disagree 按钮（小灰色）
                    Button("Disagree") {
                        vm.disagreeToPrivacyPolicy()
                    }
                    .font(.system(size: 16, weight: .medium))
                    .foregroundColor(.gray)
                    .padding(.horizontal, 20)
                    .padding(.vertical, 12)
                    .background(
                        RoundedRectangle(cornerRadius: 12)
                            .fill(Color.gray.opacity(0.1))
                    )
                    
                    // Agree 按钮（主要按钮）
                    Button("Agree") {
                        Task {
                            await vm.agreeToPrivacyPolicyAndSubmit()
                        }
                    }
                    .font(.system(size: 18, weight: .bold))
                    .foregroundColor(unswDarkBlue)
                    .padding(.horizontal, 32)
                    .padding(.vertical, 16)
                    .background(
                        RoundedRectangle(cornerRadius: 12)
                            .fill(unswYellow)
                    )
                    .shadow(color: unswYellow.opacity(0.3), radius: 8, x: 0, y: 4)
                }
            }
            .padding(40)
            .background(
                RoundedRectangle(cornerRadius: 24, style: .continuous)
                    .fill(.regularMaterial)
                    .background(
                        RoundedRectangle(cornerRadius: 24, style: .continuous)
                            .fill(Color.white)
                    )
                    .shadow(color: Color.black.opacity(0.15), radius: 30, x: 0, y: 15)
            )
            .frame(maxWidth: 450)
            .padding(.horizontal, 32)
            .onTapGesture {
                // 阻止点击模态框时触发背景关闭
            }
        }
    }
}

/// SwiftUI WebView wrapper
struct WebView: UIViewRepresentable {
    let url: URL
    
    func makeUIView(context: Context) -> WKWebView {
        let webView = WKWebView()
        webView.load(URLRequest(url: url))
        return webView
    }
    
    func updateUIView(_ uiView: WKWebView, context: Context) {
        // Update if needed
    }
}

/// UNSW 风格的隐私政策网页视图
private struct UNSWPrivacyPolicyWebView: View {
    let vm: RegistrationViewModel
    private let unswYellow = Color(red: 1.0, green: 0.84, blue: 0.0)
    private let unswDarkBlue = Color(red: 0.0, green: 0.2, blue: 0.4)
    
    var body: some View {
        ZStack {
            // 全屏背景
            Color.white
                .ignoresSafeArea(.all)
            
            // 网页容器 - 全屏
            VStack(spacing: 0) {
                // 标题栏
                HStack {
                    Text("Privacy Policy")
                        .font(.system(size: 28, weight: .bold))
                        .foregroundColor(unswDarkBlue)
                    
                    Spacer()
                    
                    Button("Close") {
                        vm.closePrivacyPolicyWebView()
                    }
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundColor(unswDarkBlue)
                    .padding(.horizontal, 24)
                    .padding(.vertical, 12)
                    .background(
                        RoundedRectangle(cornerRadius: 10)
                            .fill(unswYellow)
                    )
                    .shadow(color: unswYellow.opacity(0.3), radius: 4, x: 0, y: 2)
                }
                .padding(24)
                .background(Color.white)
                .shadow(color: Color.black.opacity(0.1), radius: 2, x: 0, y: 2)
                
                // WebView - 占据剩余全部空间
                if let url = URL(string: "https://www.unsw.edu.au/privacy") {
                    WebView(url: url)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    ScrollView {
                        VStack(spacing: 24) {
                            Text("Privacy Policy")
                                .font(.system(size: 32, weight: .bold))
                                .foregroundColor(unswDarkBlue)
                            
                            Text("Privacy policy content would be displayed here.")
                                .font(.system(size: 18))
                                .multilineTextAlignment(.center)
                            
                            Text("For demonstration purposes, this would typically load the actual privacy policy from UNSW's website.")
                                .font(.system(size: 14))
                                .foregroundColor(.secondary)
                                .multilineTextAlignment(.center)
                        }
                        .padding(40)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Color.white)
                }
            }
        }
    }
}
