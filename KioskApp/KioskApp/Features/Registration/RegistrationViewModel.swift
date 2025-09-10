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
    @Published var name: String = ""
    @Published var categoryId: String = ""

    // 数据源（下拉）
    @Published private(set) var categories: [CategoryItem] = [
        CategoryItem(id: "general", name: "General"),
        CategoryItem(id: "tech", name: "Technical Support"),
        CategoryItem(id: "id", name: "Feedback"),
        CategoryItem(id: "admin", name: "Administration"),
        CategoryItem(id: "COE", name: "Other")
    ]

    // 状态
    @Published private(set) var isSubmitting = false
    @Published private(set) var lastCreatedCaseId: String?
    @Published var errorMessage: String?

    private let env: AppEnvironment

    init(env: AppEnvironment) {
        self.env = env
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

    var canSubmit: Bool {
        !normalizedName.isEmpty &&
        !categoryId.isEmpty &&
        categories.contains(where: { $0.id == categoryId }) &&
        !isSubmitting
    }

    // MARK: - 提交
    /// 提交后可选择是否清空表单（默认不清空，便于继续提交相似记录）
    @MainActor
    func submit(clearOnSuccess: Bool = true) async {
        // 避免重复点击/竞态
        guard canSubmit else {
            self.errorMessage = "请填写姓名并选择分类"
            return
        }

        isSubmitting = true
        errorMessage = nil
        lastCreatedCaseId = nil // 清除之前的成功消息
        defer { isSubmitting = false }

        do {
            _ = try await env.casesAPI.createCase(
                name: normalizedName,
                categoryId: categoryId
            )
            lastCreatedCaseId = "Successful" // 简化成功消息
            
            if clearOnSuccess {
                name = ""
                // 保留分类选择，便于连续同类录入
            }
            
            // 3秒后自动清除成功提示
            DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) {
                self.lastCreatedCaseId = nil
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - 便捷方法
    /// 外部可预填姓名（如扫码/缓存命中）
    func prefill(name: String?, categoryId: String? = nil) {
        if let n = name { self.name = n }
        if let cid = categoryId, categories.contains(where: { $0.id == cid }) {
            self.categoryId = cid
        }
    }
}
