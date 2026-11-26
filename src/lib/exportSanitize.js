/**
 * Neutralizes spreadsheet formula injection (CSV/Excel injection) on export.
 * Strings beginning with '=', '+', '@', '\t', '\r', or '-' (other than a lone '-')
 * are prefixed with a single quote so spreadsheet apps treat them strictly as text.
 *
 * @param {*} value
 * @returns {*}
 */
export function sanitizeSpreadsheetCell(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' || typeof value === 'boolean') return value;

  const str = String(value);
  if (str === '' || str === '-') return str;

  if (/^[=+@\t\r]/.test(str) || /^-/.test(str)) {
    return `'${str}`;
  }
  return str;
}

/**
 * Reverses `sanitizeSpreadsheetCell` prefix during re-import so exported TPS files
 * round-trip cleanly without leaving a stray leading apostrophe.
 *
 * @param {*} value
 * @returns {*}
 */
export function unsanitizeImportedCell(value) {
  if (typeof value !== 'string') return value;
  if (/^'[=+\-@\t\r]/.test(value)) {
    return value.slice(1);
  }
  return value;
}
