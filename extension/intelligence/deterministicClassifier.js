/**
 * deterministicClassifier.js
 * Combines entity and attribute to find a canonical profile field.
 */

const { matchEntity } = require('./entityMatcher');
const { matchAttribute } = require('./attributeMatcher');

const schema = require('../../schemas/exam-profile-schema.json');

// Canonical mapping registry dynamically populated from the exam schema
const CANONICAL_REGISTRY = new Set();
if (schema && schema.categories) {
  schema.categories.forEach(cat => {
    cat.classes.forEach(cls => {
      CANONICAL_REGISTRY.add(`${cat.id}.${cls.id}`);
    });
  });
}

function getCanonicalField(entity, attribute) {
  if (entity === 'ambiguous' || attribute === 'ambiguous') return null;

  let field = null;

  // Direct mapping logic based on exam schema
  if (attribute === 'name') {
    if (entity === 'father') field = 'family.father_name';
    else if (entity === 'mother') field = 'family.mother_name';
    else if (entity === 'parent' || entity === 'family' || entity === 'spouse') field = null;
    else field = 'personal.full_name';
  } else if (attribute === 'firstName') {
    field = 'personal.first_name';
  } else if (attribute === 'lastName') {
    field = 'personal.last_name';
  } else if (attribute === 'email') {
    if (entity === 'father' || entity === 'mother' || entity === 'parent' || entity === 'family' || entity === 'spouse') field = null;
    else field = 'contact.email';
  } else if (attribute === 'phone') {
    if (entity === 'father') field = 'family.father_phone';
    else if (entity === 'mother') field = 'family.mother_phone';
    else if (entity === 'parent' || entity === 'family' || entity === 'spouse') field = null;
    else field = 'contact.phone';
  } else if (attribute === 'dateOfBirth') {
    if (entity === 'father' || entity === 'mother' || entity === 'parent' || entity === 'family' || entity === 'spouse') field = null;
    else field = 'personal.date_of_birth';
  } else if (attribute === 'department' || attribute === 'college') {
    field = 'education.college';
  }

  if (field && CANONICAL_REGISTRY.has(field)) {
    return field;
  }

  return null;
}

function classify(normalizedField) {
  const entity = matchEntity(normalizedField);
  const attribute = matchAttribute(normalizedField);

  const profileField = getCanonicalField(entity, attribute);

  if (profileField) {
    return {
      status: 'resolved',
      profileField,
      entity,
      attribute,
      confidence: 0.95, // High confidence for deterministic
      method: 'deterministic',
      cache: { layer: 'none', hit: false },
      reasons: ['deterministic entity and attribute match']
    };
  }

  return {
    status: 'ambiguous',
    entity,
    attribute,
    candidates: [],
    confidence: 0.4,
    method: 'deterministic'
  };
}

module.exports = { classify, CANONICAL_REGISTRY };
