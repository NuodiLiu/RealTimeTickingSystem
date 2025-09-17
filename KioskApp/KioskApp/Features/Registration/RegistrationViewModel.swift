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

final class RegistrationViewModel: ObservableObject {
    @Published var zID: String = ""
    @Published var name: String = ""
    @Published var categoryId: String = ""
    @Published var noZIDChecked: Bool = false 

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

    @Published private(set) var isSubmitting = false
    @Published private(set) var lastCreatedCaseId: String?
    @Published var errorMessage: String?
    @Published var showZIDValidation: Bool = false 

    private let env: AppEnvironment
    private var validationTimer: Timer?

    init(env: AppEnvironment) {
        self.env = env
        self.categoryId = categories.first?.id ?? ""
        
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
        validationTimer?.invalidate()
        
        let trimmed = input.trimmingCharacters(in: .whitespacesAndNewlines)
        
        if trimmed.count < 3 {
            showZIDValidation = false
            return
        }
        
        // verification status display after 500ms delay
        validationTimer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: false) { [weak self] _ in
            self?.showZIDValidation = true
        }
    }

    // MARK: - class injection offline
    /// 从外部（本地常量 / 缓存）注入分类；可传入一个要预选的 id
    func setCategories(_ items: [CategoryItem], preselect id: String? = nil) {
        categories = items

        //  prioritise incoming external
        if let id, items.contains(where: { $0.id == id }) {
            categoryId = id
            return
        }
        if !items.contains(where: { $0.id == categoryId }) {
            categoryId = items.first?.id ?? ""
        }
    }

    /// preselect first option after injection
    func setCategoriesAndPickFirst(_ items: [CategoryItem]) {
        setCategories(items, preselect: items.first?.id)
    }

    private var normalizedName: String {
        name.trimmingCharacters(in: .whitespacesAndNewlines)
    }
    
    private var normalizedZID: String? {
        let trimmed = zID.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        
        if trimmed.isEmpty {
            return nil
        }
        
        if trimmed.count == 7, trimmed.allSatisfy(\.isNumber) {
            return "z\(trimmed)"
        }
        
        if trimmed.count == 8, trimmed.hasPrefix("z") {
            let digits = String(trimmed.dropFirst())
            if digits.count == 7, digits.allSatisfy(\.isNumber) {
                return trimmed
            }
        }
        
        return trimmed 
    }
    
    private var isValidZID: Bool {
        guard let normalized = normalizedZID else { return true } // 允许为空
        return normalized.count == 8 && 
               normalized.hasPrefix("z") && 
               String(normalized.dropFirst()).allSatisfy(\.isNumber)
    }

    var canSubmit: Bool {
        !normalizedName.isEmpty &&
        !categoryId.isEmpty &&
        (noZIDChecked || isValidZID) && // 如果勾选了"没有zID"或者zID有效
        categories.contains(where: { $0.id == categoryId }) &&
        !isSubmitting
    }
    
    // MARK: - UI 
    var shouldShowZIDError: Bool {
        guard !noZIDChecked else { return false } 
        guard let normalized = normalizedZID else { return false } 
        return showZIDValidation && !normalized.isEmpty && !isValidZID
    }

    // MARK: - submit
    @MainActor
    func submit(clearOnSuccess: Bool = true) async {
        guard canSubmit else {
            errorMessage = "Please check all fields and try again"
            return
        }

        isSubmitting = true
        errorMessage = nil
        lastCreatedCaseId = nil 
        defer { isSubmitting = false }

        do {
            let finalZID = noZIDChecked ? nil : normalizedZID
            _ = try await env.casesAPI.createCase(
                zID: finalZID,
                name: normalizedName,
                categoryId: categoryId
            )
            lastCreatedCaseId = "Successful" 
            
            if clearOnSuccess {
                zID = ""
                name = ""
                noZIDChecked = false 
            }

            DispatchQueue.main.asyncAfter(deadline: .now() + 2.5) {
                self.lastCreatedCaseId = nil
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - clear successful status
    func clearSuccess() {
        lastCreatedCaseId = nil
    }

    // MARK: - convenience methods
    func prefill(zID: String? = nil, name: String?, categoryId: String? = nil) {
        if let z = zID { self.zID = z }
        if let n = name { self.name = n }
        if let cid = categoryId, categories.contains(where: { $0.id == cid }) {
            self.categoryId = cid
        }
    }
}
