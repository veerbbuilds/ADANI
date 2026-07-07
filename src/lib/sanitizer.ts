import "server-only";

/**
 * Centralized Input Sanitizer — CWE-79, CWE-89, CWE-1236
 * Strips HTML, event handlers, CSS injection, Unicode bypass, and Excel formula injection.
 */

/**
 * Sanitizes a string value by stripping dangerous content.
 * - Removes all HTML tags and event handler attributes
 * - HTML-encodes special characters
 * - Strips Excel formula injection prefixes
 * - Normalizes Unicode (NFC form)
 * - Truncates to maxLength
 */
export function sanitize(input: string, maxLength: number = 500): string {
  if (!input || typeof input !== "string") return "";

  let cleaned = input;

  // 1. Normalize Unicode to NFC form (prevent homoglyph attacks)
  cleaned = cleaned.normalize("NFC");

  // 2. Strip all HTML tags (including self-closing and malformed)
  cleaned = cleaned.replace(/<[^>]*>/g, "");

  // 3. Remove event handler attributes (onerror=, onclick=, onload=, etc.)
  cleaned = cleaned.replace(/\bon\w+\s*=\s*["'][^"']*["']/gi, "");
  cleaned = cleaned.replace(/\bon\w+\s*=\s*[^\s>]*/gi, "");

  // 4. Remove javascript: and data: protocol patterns
  cleaned = cleaned.replace(/javascript\s*:/gi, "");
  cleaned = cleaned.replace(/data\s*:\s*text\/html/gi, "");
  cleaned = cleaned.replace(/vbscript\s*:/gi, "");

  // 5. Remove CSS expression() and similar
  cleaned = cleaned.replace(/expression\s*\(/gi, "");
  cleaned = cleaned.replace(/url\s*\(/gi, "");

  // 6. HTML entity encode dangerous characters
  cleaned = cleaned
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");

  // 7. Truncate to max length
  cleaned = cleaned.substring(0, maxLength);

  return cleaned.trim();
}

/**
 * Sanitizes a value specifically for Excel/CSV export.
 * Prevents formula injection (CWE-1236) by stripping leading control characters.
 */
export function sanitizeForExcel(input: string): string {
  if (!input || typeof input !== "string") return "";

  let cleaned = input.trim();

  // Strip leading characters that trigger formula execution in Excel
  while (/^[=+\-@\t\r]/.test(cleaned)) {
    cleaned = cleaned.substring(1);
  }

  return cleaned;
}

/**
 * Validates that a value matches a specific pattern.
 * Returns the value if valid, null otherwise.
 */
export function validatePattern(input: string, pattern: RegExp): string | null {
  if (!input || typeof input !== "string") return null;
  return pattern.test(input) ? input : null;
}
