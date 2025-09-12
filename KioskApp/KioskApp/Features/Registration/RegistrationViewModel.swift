//
//  RegistrationViewModel.swift
//  KioskApp
//

import Foundation
import Combine

public struct CategoryItem: Identifiable, Hashable, Decodable {
    public let id: String
    public let name: String
}

/// 负责登记表单（姓名、分类）提交流程（不从后端拉分类，分类由外部注入）
final class RegistrationViewModel: ObservableObject {
    // 输入
    @Published var zID: String = ""
    @Published var name: String = ""
    @Published var categoryId: String = ""

    // 数据源（下拉）
    @Published private(set) var categories: [CategoryItem] = [
        CategoryItem(id: "activities", name: "Activities and Volunteering"),
        CategoryItem(id: "academic_support", name: "Academic Support and Academic Standing"),
        CategoryItem(id: "accommodation", name: "Accommodation Support"),
        CategoryItem(id: "new_student_orientation", name: "New Student Orientation / Getting Set Up, Z-ID account activation"),
        CategoryItem(id: "admissions", name: "Admissions (you have not started your course and want to change your enrolment)"),
        CategoryItem(id: "complaints", name: "Complaints"),
        CategoryItem(id: "domestic_diploma", name: "Domestic Diploma Enquiries"),
        CategoryItem(id: "enrolment", name: "Enrolment (you have started your course and want to change your enrolment)"),
        CategoryItem(id: "exams", name: "Exams, Assessments and Results"),
        CategoryItem(id: "fees", name: "Fees and Refunds"),
        CategoryItem(id: "it_help", name: "IT help"),
        CategoryItem(id: "moodle", name: "Moodle"),
        CategoryItem(id: "student_support", name: "Student Support (Personal issues, health & wellbeing)"),
        CategoryItem(id: "timetable", name: "Timetable"),
        CategoryItem(id: "under_18", name: "Under 18 Student"),
        CategoryItem(id: "other", name: "Other Issues")
    ]

    // 状态
    @Published private(set) var isSubmitting = false
    @Published private(set) var lastCreatedCaseId: String?
    @Published var errorMessage: String?
    @Published var showZIDValidation: Bool = false // 是否显示验证状态

    private let env: AppEnvironment
    private var validationTimer: Timer?

    init(env: AppEnvironment) {
        self.env = env
        // 默认选择第一个分类
        self.categoryId = categories.first?.id ?? ""
        
        // 监听 zID 输入变化
        setupZIDValidation()
    }
    
    private func setupZIDValidation() {
        $zID
            .sink { [weak self] newValue in
                self?.handleZIDInput(newValue)
            }
            .store(in: &cancellables)
    }
    
    private var cancellables = Set<AnyCancellable>()
    
    private func handleZIDInput(_ input: String) {
        // 取消之前的定时器
        validationTimer?.invalidate()
        
        let trimmed = input.trimmingCharacters(in: .whitespacesAndNewlines)
        
        // 如果输入少于3个字符，不显示验证
        if trimmed.count < 3 {
            showZIDValidation = false
            return
        }
        
        // 输入3个字符以上时，延迟500ms显示验证状态
        validationTimer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: false) { [weak self] _ in
            self?.showZIDValidation = true
        }
    }

    // MARK: - 分类注入（无网络）
    /// 从外部（本地常量 / 缓存）注入分类；可传入一个要预选的 id
    func setCategories(_ items: [CategoryItem], preselect id: String? = nil) {
        categories = items

        // 优先选择外部传入的 preselect
        if let id, items.contains(where: { $0.id == id }) {
            categoryId = id
            return
        }
        // 若当前选择无效/为空，默认选第一个
        if !items.contains(where: { $0.id == categoryId }) {
            categoryId = items.first?.id ?? ""
        }
    }

    /// 外部可选的便捷方法：注入后立刻预选第一个
    func setCategoriesAndPickFirst(_ items: [CategoryItem]) {
        setCategories(items, preselect: items.first?.id)
    }

    // MARK: - 校验
    private var normalizedName: String {
        name.trimmingCharacters(in: .whitespacesAndNewlines)
    }
    
    private var normalizedZID: String {
        let trimmed = zID.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        
        // 如果输入是7位数字，自动补全z前缀
        if trimmed.count == 7, trimmed.allSatisfy(\.isNumber) {
            return "z\(trimmed)"
        }
        
        // 如果输入是z or Z 开头+7位数字，直接返回
        if trimmed.count == 8, trimmed.hasPrefix("z") {
            let digits = String(trimmed.dropFirst())
            if digits.count == 7, digits.allSatisfy(\.isNumber) {
                return trimmed
            }
        }
        
        return trimmed // 其他情况返回原值，交由canSubmit判断
    }
    
    private var isValidZID: Bool {
        let normalized = normalizedZID
        return normalized.count == 8 && 
               normalized.hasPrefix("z") && 
               String(normalized.dropFirst()).allSatisfy(\.isNumber)
    }

    var canSubmit: Bool {
        !normalizedName.isEmpty &&
        !categoryId.isEmpty &&
        isValidZID &&
        categories.contains(where: { $0.id == categoryId }) &&
        !isSubmitting
    }
    
    // MARK: - UI 验证状态
    /// 是否应该显示红色边框（用户输入了但格式不对）
    var shouldShowZIDError: Bool {
        showZIDValidation && !normalizedZID.isEmpty && !isValidZID
    }

    // MARK: - 提交
    /// 提交后可选择是否清空表单（默认不清空，便于继续提交相似记录）
    @MainActor
    func submit(clearOnSuccess: Bool = true) async {
        // 避免重复点击/竞态
        guard canSubmit else {
            errorMessage = "Please check all fields and try again"
            return
        }

        isSubmitting = true
        errorMessage = nil
        lastCreatedCaseId = nil // 清除之前的成功消息
        defer { isSubmitting = false }

        do {
            _ = try await env.casesAPI.createCase(
                zID: normalizedZID,
                name: normalizedName,
                categoryId: categoryId
            )
            lastCreatedCaseId = "Successful" // 简化成功消息
            
            if clearOnSuccess {
                zID = ""
                name = ""
                // 保留分类选择，便于连续同类录入
            }

            // 2.5秒后自动清除成功提示
            DispatchQueue.main.asyncAfter(deadline: .now() + 2.5) {
                self.lastCreatedCaseId = nil
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - 便捷方法
    /// 外部可预填姓名（如扫码/缓存命中）
    func prefill(zID: String? = nil, name: String?, categoryId: String? = nil) {
        if let z = zID { self.zID = z }
        if let n = name { self.name = n }
        if let cid = categoryId, categories.contains(where: { $0.id == cid }) {
            self.categoryId = cid
        }
    }
}
