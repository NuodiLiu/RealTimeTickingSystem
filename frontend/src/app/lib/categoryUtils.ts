// Category mapping utility
// Maps category IDs to human-readable names based on the registration system

export interface CategoryItem {
  id: string;
  name: string;
}

export const CATEGORIES: CategoryItem[] = [
  { id: "activities", name: "Activities and Volunteering" },
  { id: "academic_support", name: "Academic Support and Academic Standing" },
  { id: "accommodation", name: "Accommodation Support" },
  { id: "new_student_orientation", name: "New Student Orientation / Getting Set Up, Z-ID account activation" },
  { id: "admissions", name: "Admissions (you have not started your course and want to change your enrolment)" },
  { id: "complaints", name: "Complaints" },
  { id: "domestic_diploma", name: "Domestic Diploma Enquiries" },
  { id: "enrolment", name: "Enrolment (you have started your course and want to change your enrolment)" },
  { id: "exams", name: "Exams, Assessments and Results" },
  { id: "fees", name: "Fees and Refunds" },
  { id: "it_help", name: "IT help" },
  { id: "moodle", name: "Moodle" },
  { id: "student_support", name: "Student Support (Personal issues, health & wellbeing)" },
  { id: "timetable", name: "Timetable" },
  { id: "under_18", name: "Under 18 Student" },
  { id: "other", name: "Other Issues" }
];

/**
 * Get category name by ID
 * @param categoryId - The category ID
 * @returns The human-readable category name, or the ID if not found
 */
export function getCategoryName(categoryId: string): string {
  const category = CATEGORIES.find(cat => cat.id === categoryId);
  return category?.name || categoryId;
}

/**
 * Truncate text and add ellipsis if it exceeds the maximum length
 * @param text - The text to truncate
 * @param maxLength - Maximum number of characters before truncation
 * @returns Truncated text with ellipsis if needed
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength) + '...';
}

/**
 * Get truncated category name for display
 * @param categoryId - The category ID
 * @param maxLength - Maximum number of characters before truncation (default: 23)
 * @returns Truncated category name
 */
export function getTruncatedCategoryName(categoryId: string, maxLength: number = 23): string {
  const fullName = getCategoryName(categoryId);
  return truncateText(fullName, maxLength);
}

/**
 * Get truncated student name for display
 * @param name - The student name
 * @param maxLength - Maximum number of characters before truncation (default: 43)
 * @returns Truncated student name
 */
export function getTruncatedStudentName(name: string, maxLength: number = 43): string {
  return truncateText(name, maxLength);
}
