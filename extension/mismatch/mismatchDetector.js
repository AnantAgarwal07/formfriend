/**
 * FormFriend — Mismatch Detector
 *
 * Updated to respect field ownership (only detect mismatches for 'self').
 */

var FormFriendMismatchDetector = (function () {
  'use strict';

  const TYPO_SIMILARITY_THRESHOLD = 0.75;
  const MATCH_SIMILARITY_THRESHOLD = 0.95;

  function getFieldCategory(profileField) {
    const f = (profileField || '').toLowerCase();
    if (f.includes('name') || f === 'fullname') return 'name';
    if (f.includes('email')) return 'email';
    if (f.includes('phone') || f.includes('mobile')) return 'phone';
    if (f.includes('date') || f.includes('dob')) return 'date';
    return 'text';
  }

  function compareField(profileValue, formValue, profileField) {
    if (!profileValue) return { type: 'unknown', severity: 'none', details: 'No profile value' };
    if (!formValue) return { type: 'unknown', severity: 'none', details: 'Form field is empty' };

    const pStr = String(profileValue);
    const fStr = String(formValue);

    if (pStr === fStr) return { type: 'match', severity: 'none' };

    const category = getFieldCategory(profileField);
    switch (category) {
      case 'name': return compareName(pStr, fStr);
      case 'email': return compareEmail(pStr, fStr);
      case 'phone': return comparePhone(pStr, fStr);
      case 'date': return compareDate(pStr, fStr);
      default: return compareGenericText(pStr, fStr);
    }
  }

  function compareName(profile, form) {
    const np = FormFriendNormalize.normalizeName(profile);
    const nf = FormFriendNormalize.normalizeName(form);
    if (np === nf) return { type: 'format_difference', severity: 'none', details: 'Case/whitespace difference only' };
    const sim = FormFriendNormalize.similarity(np, nf);
    if (sim >= MATCH_SIMILARITY_THRESHOLD) return { type: 'format_difference', severity: 'low', details: `Similarity: ${(sim * 100).toFixed(0)}%` };
    if (sim >= TYPO_SIMILARITY_THRESHOLD) return { type: 'possible_typo', severity: 'medium', details: `Similarity: ${(sim * 100).toFixed(0)}% — possible typo` };
    return { type: 'mismatch', severity: 'high', details: `Similarity: ${(sim * 100).toFixed(0)}% — names are significantly different` };
  }

  function compareEmail(profile, form) {
    const np = FormFriendNormalize.normalizeEmail(profile);
    const nf = FormFriendNormalize.normalizeEmail(form);
    if (np === nf) return { type: 'format_difference', severity: 'none', details: 'Case difference only' };
    return { type: 'mismatch', severity: 'high', details: 'Email addresses do not match' };
  }

  function comparePhone(profile, form) {
    const np = FormFriendNormalize.normalizePhone(profile);
    const nf = FormFriendNormalize.normalizePhone(form);
    if (np === nf) return { type: 'format_difference', severity: 'none', details: 'Formatting difference only' };
    if (np.endsWith(nf) || nf.endsWith(np)) return { type: 'format_difference', severity: 'low', details: 'Possible country code difference' };
    return { type: 'mismatch', severity: 'high', details: 'Phone numbers do not match' };
  }

  function compareDate(profile, form) {
    const np = FormFriendNormalize.normalizeDate(profile);
    const nf = FormFriendNormalize.normalizeDate(form);
    if (!np || !nf) {
      if (FormFriendNormalize.normalizeText(profile) === FormFriendNormalize.normalizeText(form)) return { type: 'match', severity: 'none' };
      return { type: 'unknown', severity: 'medium', details: 'Could not parse date for comparison' };
    }
    if (np === nf) return { type: 'format_difference', severity: 'none', details: 'Same date, different format' };
    return { type: 'mismatch', severity: 'high', details: 'Dates do not match' };
  }

  function compareGenericText(profile, form) {
    const np = FormFriendNormalize.normalizeText(profile);
    const nf = FormFriendNormalize.normalizeText(form);
    if (np === nf) return { type: 'format_difference', severity: 'none', details: 'Whitespace/case difference only' };
    
    // Substring match for select options (e.g. "general" in "general unreserved", or "b tech" in "bachelor b tech")
    if (np && nf && (np.includes(nf) || nf.includes(np))) {
      return { type: 'format_difference', severity: 'none', details: 'Option abbreviation/label match' };
    }

    const sim = FormFriendNormalize.similarity(np, nf);
    if (sim >= MATCH_SIMILARITY_THRESHOLD) return { type: 'format_difference', severity: 'low', details: `Similarity: ${(sim * 100).toFixed(0)}%` };
    if (sim >= TYPO_SIMILARITY_THRESHOLD) return { type: 'possible_typo', severity: 'medium', details: `Similarity: ${(sim * 100).toFixed(0)}%` };
    return { type: 'mismatch', severity: 'high', details: `Similarity: ${(sim * 100).toFixed(0)}%` };
  }

  function resolveProfileVal(profile, profileField) {
    if (!profile || !profileField) return undefined;
    if (profile[profileField] !== undefined && profile[profileField] !== '') return profile[profileField];

    if (
      profileField === 'full_name' ||
      profileField === 'personal.full_name' ||
      profileField === 'personal.name' ||
      profileField === 'fullName'
    ) {
      const f = profile.firstName || profile['personal.first_name'] || '';
      const m = profile.middleName || profile['personal.middle_name'] || '';
      const l = profile.lastName || profile['personal.last_name'] || '';
      const combined = [f, m, l].filter(Boolean).join(' ');
      return combined || profile.full_name || profile['personal.full_name'] || profile['personal.name'] || profile.fullName || undefined;
    }

    const ALIASES = {
      'first_name': ['firstName', 'personal.first_name'],
      'middle_name': ['middleName', 'personal.middle_name'],
      'last_name': ['lastName', 'personal.last_name'],
      'date_of_birth': ['personal.date_of_birth', 'dob', 'dateOfBirth'],
      'email': ['contact.email'],
      'alternate_email': ['contact.alternate_email'],
      'phone': ['contact.phone', 'mobile'],
      'alternate_phone': ['contact.alternate_phone', 'alternatePhone'],
      'address_line_1': ['address.address_line_1', 'address'],
      'address_line_2': ['address.address_line_2'],
      'locality': ['address.locality'],
      'city': ['address.city'],
      'district': ['address.district'],
      'state': ['address.state'],
      'country': ['address.country'],
      'pincode': ['address.pincode', 'postalCode'],
      'aadhaar_number': ['identity.aadhaar_number', 'aadhaarNumber', 'identity.aadhaar', 'aadhaar'],
      'pan_number': ['identity.pan_number', 'pan', 'identity.pan'],
      'category': ['category.category'],
      'ews': ['category.ews'],
      'obc_ncl': ['category.obc_ncl', 'obc_status'],
      'pwd': ['category.pwd'],
      'highest_qualification': ['education.highest_qualification', 'education'],
      'college': ['education.college'],
      'degree': ['education.degree', 'course'],
      'branch': ['education.branch', 'department'],
      'father_name': ['family.father_name', 'fatherName'],
      'father_occupation': ['family.father_occupation', 'fatherOccupation'],
      'father_phone': ['family.father_phone', 'fatherPhone', 'father_mobile'],
      'mother_name': ['family.mother_name', 'motherName'],
      'mother_occupation': ['family.mother_occupation', 'motherOccupation'],
      'mother_phone': ['family.mother_phone', 'motherPhone', 'mother_mobile'],
      'guardian_name': ['family.guardian_name', 'guardianName']
    };

    const alts = ALIASES[profileField] || [];
    for (const alt of alts) {
      if (profile[alt] !== undefined && profile[alt] !== '') return profile[alt];
    }
    return undefined;
  }

  function detectMismatches(mapping, profile) {
    const results = [];
    if (!Array.isArray(mapping) || !profile) return results;

    for (const entry of mapping) {
      // RULE: Only check mismatches for self data
      if (entry.person && entry.person !== 'self') continue;

      const { fieldId, profileField } = entry;
      const profileValue = resolveProfileVal(profile, profileField);
      if (!profileValue) continue;

      const element = FormFriendFieldRegistry.getElement(fieldId);
      if (!element) continue;

      let formValue = '';
      const tag = element.tagName.toLowerCase();
      if (tag === 'select') {
        const selectedOption = element.options[element.selectedIndex];
        formValue = selectedOption ? (selectedOption.value || selectedOption.text) : element.value;
      } else if (tag === 'input' && element.type === 'checkbox') {
        formValue = element.checked ? 'true' : 'false';
      } else if (tag === 'input' && element.type === 'radio') {
        const checked = document.querySelector(`input[name="${element.name}"]:checked`);
        formValue = checked ? checked.value : '';
      } else {
        formValue = element.value || '';
      }

      if (!formValue) continue;

      const comparison = compareField(profileValue, formValue, profileField);

      results.push({
        fieldId,
        profileField,
        expected: String(profileValue),
        actual: String(formValue),
        ...comparison
      });
    }

    return results;
  }

  function getWarnings(results) {
    return results.filter(r => r.type === 'possible_typo' || r.type === 'mismatch');
  }

  return { compareField, detectMismatches, getWarnings, getFieldCategory };
})();
