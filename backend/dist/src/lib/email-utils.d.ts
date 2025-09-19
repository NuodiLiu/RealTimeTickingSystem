/**
 * Email normalization utilities
 *
 * Provides consistent email handling across the application,
 * ensuring case-insensitive uniqueness without database-level extensions
 */
/**
 * Normalize email address for consistent storage and lookup
 *
 * @param email - Raw email address from various sources
 * @returns Normalized lowercase email, or undefined if input is falsy
 */
export declare function normalizeEmail(email: string | null | undefined): string | undefined;
/**
 * Check if two emails are equivalent (case-insensitive)
 *
 * @param email1 - First email to compare
 * @param email2 - Second email to compare
 * @returns true if emails are equivalent, false otherwise
 */
export declare function emailsEqual(email1: string | null | undefined, email2: string | null | undefined): boolean;
/**
 * Validate basic email format
 * Note: This is a simple validation. For production use, consider more robust validation
 *
 * @param email - Email to validate
 * @returns true if email has basic valid format
 */
export declare function isValidEmailFormat(email: string): boolean;
//# sourceMappingURL=email-utils.d.ts.map