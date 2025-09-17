import SwiftUI

enum ActiveDropdown: Hashable {
    case category
}

struct RegistrationView: View {
    @ObservedObject var vm: RegistrationViewModel
    @FocusState private var zidFocused: Bool
    @FocusState private var nameFocused: Bool
    @State private var active: ActiveDropdown? = nil
    
    private let appEnv = AppEnvironment.shared
    
    private let unswYellow = Color(red: 1.0, green: 0.84, blue: 0.0) // UNSW 黄色
    private let unswDarkBlue = Color(red: 0.0, green: 0.2, blue: 0.4) // UNSW 深蓝色
    private let unswLightGray = Color(red: 0.95, green: 0.95, blue: 0.95) // 浅灰背景

    private var selectedCategoryBinding: Binding<CategoryItem?> {
        Binding(
            get: { vm.categories.first(where: { $0.id == vm.categoryId }) },
            set: { vm.categoryId = $0?.id ?? "" }
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
            .ignoresSafeArea(.keyboard)
            
            VStack(spacing: 32) {
                UNSWHeader()
                
                VStack(alignment: .leading, spacing: 28) {
                        UNSWFormField(
                            title: "Student ID (zID)",
                            required: !vm.noZIDChecked, 
                            content: {
                                VStack(alignment: .leading, spacing: 16) {
                                    UNSWTextField(
                                        placeholder: vm.noZIDChecked ? "N/A" : "Please enter your zID",
                                        text: $vm.zID,
                                        isFirstResponder: $zidFocused,
                                        hasError: vm.shouldShowZIDError,
                                        activeDropdown: $active
                                    )
                                    .disabled(vm.noZIDChecked) 
                                    .opacity(vm.noZIDChecked ? 0.5 : 1.0) 
                                    .onSubmit { 
                                        zidFocused = false
                                        nameFocused = true
                                    }
                                    .onChange(of: vm.noZIDChecked) { _, newValue in
                                        if newValue {
                                            vm.zID = "" 
                                            zidFocused = false 
                                        }
                                    }
                                    
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
                                                    .foregroundColor(unswDarkBlue)
                                            }
                                        }
                                        .buttonStyle(PlainButtonStyle())
                                    }
                                }
                            }
                        )
                        
                        // NAME 
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

                        // CATEGORY 
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
                
                Spacer() 
            }
            .frame(maxWidth: 800)
            .frame(maxWidth: .infinity, alignment: .center)
            .padding(.top, 20)

            
            VStack(spacing: 0) {
                Spacer()
                
                VStack(spacing: 0) {
                    Rectangle()
                        .fill(unswYellow)
                        .frame(height: 3)
                    
                    HStack(spacing: 20) {
                        Button {
                            vm.zID = ""
                            vm.name = ""
                            vm.noZIDChecked = false // 重置复选框状态
                            if let first = vm.categories.first { vm.categoryId = first.id }
                            zidFocused = false
                            nameFocused = false
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

                        // Submit 
                        Button {
                            Task { 
                                await vm.submit()
                                if vm.lastCreatedCaseId != nil {
                                    zidFocused = false
                                    nameFocused = false
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
        .overlay(alignment: .top) {
            if let e = vm.errorMessage {
                UNSWBanner(text: e, style: .error)
                    .padding(.top, 12)
            }
        }
        // .devResetGesture() // DISABLED
        .onTapGesture {
            zidFocused = false
            nameFocused = false
            if active != nil {
                withAnimation(.spring(response: 0.25, dampingFraction: 0.9)) {
                    active = nil
                }
            }
        }
    }
}


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

private struct UNSWTextField: View {
    let placeholder: String
    @Binding var text: String
    @FocusState.Binding var isFirstResponder: Bool
    let hasError: Bool
    @Binding var activeDropdown: ActiveDropdown? 
    
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
                    if activeDropdown != nil {
                        withAnimation(.spring(response: 0.25, dampingFraction: 0.9)) {
                            activeDropdown = nil
                        }
                    }
                }
            )
    }
}

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

private extension View {
    func unswDropdownStyle() -> some View {
        self
            .font(.system(size: 18, weight: .medium))
            .padding(.vertical, 2)
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

private extension View {
    func kioskControlStyle() -> some View {
        self
            .font(.system(size: 20))
            .padding(.vertical, 2)
    }
}


private struct UNSWSuccessModal: View {
    let vm: RegistrationViewModel
    private let unswYellow = Color(red: 1.0, green: 0.84, blue: 0.0)
    private let unswDarkBlue = Color(red: 0.0, green: 0.2, blue: 0.4)
    
    var body: some View {
        ZStack {
            Color.black.opacity(0.4)
                .ignoresSafeArea()
                .onTapGesture {
                    vm.clearSuccess()
                }
            
            VStack(spacing: 32) {
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
            }
        }
    }
}
