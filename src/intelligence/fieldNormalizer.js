/**
 * fieldNormalizer.js
 * Normalizes form field metadata into a semantic representation.
 */

function normalizeToken(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/['"]s\b/g, '') // remove 's
    .replace(/['"]/g, '') // remove quotes/apostrophes
    .replace(/[^a-z0-9]/g, ' ') // replace punctuation with space
    .replace(/\s+/g, ' ')
    .trim();
}

function extractContextTerms(field) {
  const terms = new Set();
  
  const extract = (str) => {
    if (!str) return;
    const normalized = normalizeToken(str);
    normalized.split(' ').forEach(t => {
      if (t.length > 1) terms.add(t);
    });
  };

  extract(field.section);
  extract(field.fieldset);
  extract(field.legend);
  if (Array.isArray(field.headings)) {
    field.headings.forEach(extract);
  }

  return Array.from(terms);
}

function normalizeField(field) {
  return {
    label: normalizeToken(field.label),
    name: normalizeToken(field.name),
    id: normalizeToken(field.id),
    placeholder: normalizeToken(field.placeholder),
    section: normalizeToken(field.section),
    fieldset: normalizeToken(field.fieldset),
    legend: normalizeToken(field.legend),
    headings: Array.isArray(field.headings) ? field.headings.map(normalizeToken) : [],
    autocomplete: field.autocomplete || '',
    fieldType: field.type || 'text',
    contextTerms: extractContextTerms(field)
  };
}

function generateSafeSemanticText(normalizedField) {
  // A safe textual representation meant for embeddings or vector search
  // Do NOT include user data
  return `${normalizedField.label} ${normalizedField.section} ${normalizedField.fieldset}`.trim();
}

module.exports = {
  normalizeToken,
  extractContextTerms,
  normalizeField,
  generateSafeSemanticText
};
