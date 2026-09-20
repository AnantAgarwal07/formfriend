/**
 * FormFriend — Value Normalization Utilities
 *
 * Converts values to a canonical form for comparison, so that
 * harmless formatting differences don't trigger false mismatch warnings.
 *
 * All functions are pure and local — no network calls.
 */

// eslint-disable-next-line no-var
var FormFriendNormalize = (function () {
  'use strict';

  /**
   * General text normalization: trim, collapse whitespace, lowercase.
   * @param {string} value
   * @returns {string}
   */
  function normalizeText(value) {
    if (typeof value !== 'string') return '';
    return value.trim().replace(/[_-]/g, ' ').replace(/\s+/g, ' ').toLowerCase();
  }

  /**
   * Name normalization: same as text, but also strips common titles/suffixes.
   * @param {string} value
   * @returns {string}
   */
  function normalizeName(value) {
    if (typeof value !== 'string') return '';
    let name = normalizeText(value);
    // Remove common prefixes
    name = name.replace(/^(mr\.?|mrs\.?|ms\.?|dr\.?|prof\.?)\s+/i, '');
    // Remove trailing periods
    name = name.replace(/\.$/, '');
    return name.trim();
  }

  /**
   * Phone normalization: strip everything except digits.
   * Preserves leading country-code digits.
   * @param {string} value
   * @returns {string}
   */
  function normalizePhone(value) {
    if (typeof value !== 'string') return '';
    // Replace leading '+' with nothing (country code digits remain)
    return value.replace(/[^\d]/g, '');
  }

  /**
   * Email normalization: trim and lowercase.
   * @param {string} value
   * @returns {string}
   */
  function normalizeEmail(value) {
    if (typeof value !== 'string') return '';
    return value.trim().toLowerCase();
  }

  /**
   * Date normalization: attempt to parse various date formats and return
   * a canonical ISO string (YYYY-MM-DD).
   *
   * Supported input formats:
   *   DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, YYYY/MM/DD,
   *   MM/DD/YYYY (ambiguous — we prefer DD/MM/YYYY for Indian locale)
   *
   * @param {string} value
   * @returns {string|null}  ISO date string or null if unparseable.
   */
  function normalizeDate(value) {
    if (typeof value !== 'string' || !value.trim()) return null;

    const v = value.trim();

    // Try YYYY-MM-DD or YYYY/MM/DD first (ISO-like)
    let match = v.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/);
    if (match) {
      const [, year, month, day] = match;
      return formatISO(year, month, day);
    }

    // Try DD/MM/YYYY or DD-MM-YYYY (Indian/European format — preferred)
    match = v.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
    if (match) {
      const [, day, month, year] = match;
      return formatISO(year, month, day);
    }

    // Try parsing as a native Date (last resort)
    const d = new Date(v);
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    return null;
  }

  /**
   * Format year/month/day into YYYY-MM-DD, with zero-padding.
   */
  function formatISO(year, month, day) {
    const y = String(year).padStart(4, '0');
    const m = String(parseInt(month, 10)).padStart(2, '0');
    const d = String(parseInt(day, 10)).padStart(2, '0');
    // Basic validity check
    const mi = parseInt(m, 10);
    const di = parseInt(d, 10);
    if (mi < 1 || mi > 12 || di < 1 || di > 31) return null;
    return `${y}-${m}-${d}`;
  }

  /**
   * Levenshtein distance between two strings.
   * Used for typo detection (e.g. "Agarwal" vs "Aggarwal").
   * @param {string} a
   * @param {string} b
   * @returns {number}
   */
  function levenshteinDistance(a, b) {
    if (typeof a !== 'string') a = '';
    if (typeof b !== 'string') b = '';

    const m = a.length;
    const n = b.length;

    // Optimisation: early exits
    if (m === 0) return n;
    if (n === 0) return m;

    // Single-row DP
    let prev = Array.from({ length: n + 1 }, (_, i) => i);
    let curr = new Array(n + 1);

    for (let i = 1; i <= m; i++) {
      curr[0] = i;
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        curr[j] = Math.min(
          prev[j] + 1,       // deletion
          curr[j - 1] + 1,   // insertion
          prev[j - 1] + cost  // substitution
        );
      }
      [prev, curr] = [curr, prev];
    }
    return prev[n];
  }

  /**
   * Compute similarity ratio between two strings (0..1).
   * 1 = identical, 0 = completely different.
   * @param {string} a
   * @param {string} b
   * @returns {number}
   */
  function similarity(a, b) {
    const na = normalizeText(a);
    const nb = normalizeText(b);
    if (na === nb) return 1;
    const maxLen = Math.max(na.length, nb.length);
    if (maxLen === 0) return 1;
    return 1 - levenshteinDistance(na, nb) / maxLen;
  }

  /**
   * Determine the appropriate normalizer for a given profile field.
   * @param {string} profileField
   * @returns {Function}
   */
  function getNormalizer(profileField) {
    const field = (profileField || '').toLowerCase();
    if (field.includes('name') || field === 'fullname') return normalizeName;
    if (field.includes('email') || field === 'email') return normalizeEmail;
    if (field.includes('phone') || field.includes('mobile') || field === 'phone') return normalizePhone;
    if (field.includes('date') || field.includes('dob') || field === 'dateofbirth') return normalizeDate;
    return normalizeText;
  }

  // Public API
  return {
    normalizeText,
    normalizeName,
    normalizePhone,
    normalizeEmail,
    normalizeDate,
    levenshteinDistance,
    similarity,
    getNormalizer
  };
})();
