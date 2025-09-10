import SwiftUI
// import SharedUI   // 若 InlineDropdown 在独立模块

struct RegistrationView: View {
    @ObservedObject var vm: RegistrationViewModel
    @FocusState private var nameFocused: Bool
    
    // 从环境获取 AppEnvironment，以便访问重置功能
    private let appEnv = AppEnvironment.shared

    // 把 categoryId ↔ CategoryItem? 做成绑定，InlineDropdown 才能直接显示所选名称
    private var selectedCategoryBinding: Binding<CategoryItem?> {
        Binding(
            get: { vm.categories.first(where: { $0.id == vm.categoryId }) },
            set: { vm.categoryId = $0?.id ?? "" }
        )
    }

    var body: some View {
        ZStack {
            // 背景：柔和浅色，大面积留白，避免花哨
            Color(.systemGroupedBackground).ignoresSafeArea()

            // 主体内容：居中窄列，适合站立操作
            ScrollView(.vertical, showsIndicators: false) {
                VStack(alignment: .leading, spacing: 28) {
                    Header()

                    // NAME
                    VStack(alignment: .leading, spacing: 12) {
                        FieldTitle("Your full name", required: true)
                        KioskTextField(
                            placeholder: "Type your name",
                            text: $vm.name,
                            isFirstResponder: $nameFocused
                        )
                        .onSubmit { nameFocused = false }
                    }

                    // CATEGORY
                    VStack(alignment: .leading, spacing: 12) {
                        FieldTitle("What is your enquiry about?", required: true)
                        if vm.categories.isEmpty {
                            EmptyHint()
                        } else {
                            InlineDropdown(
                                title: "Category",
                                items: vm.categories,
                                selection: selectedCategoryBinding,
                                name: { $0.name },
                                placeholder: "Choose…",
                                headerHidden: true
                            )
                            .kioskControlStyle()
                        }
                    }

                    Spacer(minLength: 120)
                }
                .padding(.horizontal, 32)
                .padding(.top, 36)
                .frame(maxWidth: 700)   // 窄列，便于快速视线聚焦
                .frame(maxWidth: .infinity, alignment: .center)
            }

            // 底部固定操作条（大按钮，便于触控）
            VStack(spacing: 0) {
                Spacer()
                Divider()
                HStack(spacing: 16) {
                    Button {
                        vm.name = ""
                        if let first = vm.categories.first { vm.categoryId = first.id }
                        // 清空后把焦点回到姓名
                        nameFocused = true
                    } label: {
                        Text("Clear")
                            .font(.system(size: 20, weight: .semibold))
                            .frame(height: 56)
                            .frame(maxWidth: 160)
                    }
                    .buttonStyle(.bordered)
                    .tint(Color.secondary)

                    Button {
                        Task { 
                            await vm.submit()
                            // 提交成功后重新聚焦到名字输入框
                            if vm.lastCreatedCaseId != nil {
                                nameFocused = true
                            }
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
                    .disabled(!vm.canSubmit || vm.categories.isEmpty)
                }
                .padding(.horizontal, 32)
                .padding(.vertical, 16)
                .background(.ultraThinMaterial)
            }
            .scrollBounceBehavior(.basedOnSize) // 基于内容大小决定弹跳
            .scrollDisabled(false) // 允许必要的滚动
            .gesture(
                // 拦截过度拖动
                DragGesture()
                    .onChanged { _ in
                        // 静默拦截
                    }
            )
        }
        .onAppear { nameFocused = true }
        .toolbar {
            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                Button("Done") { nameFocused = false }
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        // 分类变化时，确保当前选择合法（避免显示空）
        .onChange(of: vm.categories) { _, items in
            if !items.contains(where: { $0.id == vm.categoryId }) {
                vm.categoryId = items.first?.id ?? ""
            }
        }
        // 成功与错误反馈（顶部弹条更显眼）
        .overlay(alignment: .top) {
            VStack(spacing: 10) {
                if let _ = vm.lastCreatedCaseId {
                    Banner(text: "Successful", style: .success)
                }
                if let e = vm.errorMessage {
                    Banner(text: e, style: .error)
                }
            }
            .padding(.top, 8)
        }
        .devResetGesture() // 添加开发者重置手势
        .kioskDragBlock() // 禁用拖动手势
    }
}

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
