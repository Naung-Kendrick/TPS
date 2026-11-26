/**
 * Escapes LIKE/ILIKE pattern wildcards (\, %, _) for PostgREST `.ilike()`.
 * @param {string} value
 * @returns {string}
 */
export function escapeLike(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[\\%_]/g, '\\$&');
}

/**
 * Sanitizes a user search term before interpolating into a PostgREST `.or()` filter string.
 * Removes filter syntax characters (commas, parentheses, asterisks) and escapes LIKE wildcards.
 * @param {string} value
 * @returns {string}
 */
export function sanitizePostgrestOrValue(value) {
  if (value === null || value === undefined) return '';
  const cleaned = String(value).replace(/[,()*]/g, ' ').trim();
  return escapeLike(cleaned);
}
