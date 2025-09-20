"use strict";
/**
 * Email normalization utilities
 *
 * Provides consistent email handling across the application,
 * ensuring case-insensitive uniqueness without database-level extensions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeEmail = normalizeEmail;
exports.emailsEqual = emailsEqual;
exports.isValidEmailFormat = isValidEmailFormat;
/**
 * Normalize email address for consistent storage and lookup
 *
 * @param email - Raw email address from various sources
 * @returns Normalized lowercase email, or undefined if input is falsy
 */
function normalizeEmail(email) {
    if (!email || typeof email !== 'string') {
        return undefined;
    }
    // Trim whitespace and convert to lowercase
    const trimmed = email.trim();
    if (!trimmed) {
        return undefined;
    }
    return trimmed.toLowerCase();
}
/**
 * Check if two emails are equivalent (case-insensitive)
 *
 * @param email1 - First email to compare
 * @param email2 - Second email to compare
 * @returns true if emails are equivalent, false otherwise
 */
function emailsEqual(email1, email2) {
    const normalized1 = normalizeEmail(email1);
    const normalized2 = normalizeEmail(email2);
    // Both null/undefined are considered equal
    if (!normalized1 && !normalized2)
        return true;
    // One null, one not null are not equal
    if (!normalized1 || !normalized2)
        return false;
    return normalized1 === normalized2;
}
/**
 * Validate basic email format
 * Note: This is a simple validation. For production use, consider more robust validation
 *
 * @param email - Email to validate
 * @returns true if email has basic valid format
 */
function isValidEmailFormat(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}
//# sourceMappingURL=email-utils.js.map