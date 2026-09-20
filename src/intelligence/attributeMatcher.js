/**
 * attributeMatcher.js
 * Matches normalized text to a known attribute.
 */

const ATTRIBUTE_VOCABULARY = {
  name: ['name', 'full name', 'legal name'],
  firstName: ['first name', 'given name'],
  lastName: ['last name', 'surname', 'family name'],
  email: ['email', 'email address', 'mail', 'electronic mail'],
  phone: ['phone', 'phone number', 'mobile', 'telephone', 'contact number', 'reach me at'],
  dateOfBirth: ['dob', 'date of birth', 'birth date', 'birth information'],
  studentId: ['student id', 'registration number', 'enrollment number', 'admission number'],
  department: ['department', 'branch'],
  semester: ['semester', 'term'],
  college: ['college', 'university', 'institution', 'institution attended']
};

function matchAttribute(normalizedField) {
  const primaryText = [
    normalizedField.label,
    normalizedField.name,
    normalizedField.placeholder,
    normalizedField.id
  ].join(' ');

  // Flatten and sort all keywords by length descending so "first name" matches before "name"
  const allKeywords = [];
  for (const [attribute, keywords] of Object.entries(ATTRIBUTE_VOCABULARY)) {
    for (const keyword of keywords) {
      allKeywords.push({ keyword, attribute });
    }
  }
  allKeywords.sort((a, b) => b.keyword.length - a.keyword.length);

  for (const { keyword, attribute } of allKeywords) {
    if (new RegExp(`\\b${keyword}\\b`).test(primaryText)) {
      return attribute;
    }
  }

  return 'ambiguous';
}

module.exports = { ATTRIBUTE_VOCABULARY, matchAttribute };
