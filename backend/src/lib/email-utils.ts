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
export function normalizeEmail(email: string | null | undefined): string | undefined {
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
export function emailsEqual(
  email1: string | null | undefined,
  email2: string | null | undefined
): boolean {
  const normalized1 = normalizeEmail(email1);
  const normalized2 = normalizeEmail(email2);
  
  // Both null/undefined are considered equal
  if (!normalized1 && !normalized2) return true;
  
  // One null, one not null are not equal
  if (!normalized1 || !normalized2) return false;
  
  return normalized1 === normalized2;
}

/**
 * Validate basic email format
 * Note: This is a simple validation. For production use, consider more robust validation
 * 
 * @param email - Email to validate
 * @returns true if email has basic valid format
 */
export function isValidEmailFormat(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
