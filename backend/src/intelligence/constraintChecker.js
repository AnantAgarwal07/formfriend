/**
 * constraintChecker.js
 * Validates semantic cache candidates against hard symbolic rules.
 */

const { CANONICAL_REGISTRY } = require('./deterministicClassifier');

function checkConstraints(candidate, entity, attribute, normalizedField) {
  // If the candidate profile field is not in the canonical registry, it's invalid
  if (!CANONICAL_REGISTRY.has(candidate.profileField)) {
    return false;
  }

  // If we definitively resolved entity but candidate maps to a DIFFERENT definitive entity, reject.
  if (entity !== 'ambiguous' && candidate.entity && candidate.entity !== 'ambiguous') {
    if (entity !== candidate.entity) {
      // exception: student and self overlap conceptually, but let's keep it simple
      if (!((entity === 'self' && candidate.entity === 'student') || (entity === 'student' && candidate.entity === 'self'))) {
         return false;
      }
    }
  }

  // If we definitively resolved attribute but candidate maps to a DIFFERENT definitive attribute, reject.
  if (attribute !== 'ambiguous' && candidate.attribute && candidate.attribute !== 'ambiguous') {
    if (attribute !== candidate.attribute) {
      return false;
    }
  }

  // Could check fieldType constraints (e.g. email field must not map to dob)
  if (normalizedField.fieldType === 'email' && !candidate.profileField.toLowerCase().includes('email')) {
    return false;
  }

  return true;
}

module.exports = {
  checkConstraints
};
