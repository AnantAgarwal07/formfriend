/**
 * entityMatcher.js
 * Matches normalized text and context to a known entity.
 */

const ENTITY_VOCABULARY = {
  self: ['student', 'applicant', 'candidate', 'user', 'my', 'your', 'myself'],
  father: ['father', 'dad', 'paternal'],
  mother: ['mother', 'mom', 'maternal'],
  spouse: ['spouse', 'husband', 'wife', 'partner'],
  guardian: ['guardian'],
  child: ['child', 'son', 'daughter'],
  parent: ['parent', 'parents', 'family'],
  emergencyContact: ['emergency contact', 'emergency']
};

function matchEntity(normalizedField) {
  const allText = [
    normalizedField.label,
    normalizedField.name,
    normalizedField.id,
    normalizedField.section,
    normalizedField.fieldset,
    normalizedField.legend,
    ...normalizedField.headings
  ].join(' ');

  for (const [entity, keywords] of Object.entries(ENTITY_VOCABULARY)) {
    for (const keyword of keywords) {
      if (new RegExp(`\\b${keyword}\\b`).test(allText)) {
        return entity; // match first strong signal
      }
    }
  }

  return 'self'; // Default to self if no specific entity context is provided
}

module.exports = { ENTITY_VOCABULARY, matchEntity };
