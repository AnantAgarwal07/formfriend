/**
 * FormFriend — Content Script Orchestrator
 *
 * Coordinates the entire flow including new safety rules:
 *   scan -> prompt for unknown person -> prompt for missing info -> review grouped -> fill -> mismatch
 */

var FormFriendMain = (function () {
  'use strict';

  let currentMapping = null;
  let currentFields = null;

  function notifyBackground(type, data = {}) {
    try {
      chrome.runtime.sendMessage({ type, ...data });
    } catch (e) {}
  }

  async function doScan() {
    console.log('[FormFriend] Starting scan...');
    notifyBackground('FORM_DETECTED');

    const result = await FormFriendScannerStub.scanAndMap();
    currentFields = result.fields;
    currentMapping = result.mapping;

    notifyBackground('MAPPING_READY', { mapping: currentMapping });
    return { ok: true, fieldCount: currentFields.length, mappedCount: currentMapping.length };
  }

  function formatDobForField(element, isoDate, profile) {
    if (!isoDate) return '';
    let yyyy = '', mm = '', dd = '';
    if (isoDate.includes('-')) {
      const parts = isoDate.split('-');
      if (parts.length === 3) [yyyy, mm, dd] = parts;
    } else if (isoDate.includes('/')) {
      const parts = isoDate.split('/');
      if (parts.length === 3) [dd, mm, yyyy] = parts;
    }

    if (!dd) dd = profile.dob_day || '';
    if (!mm) mm = profile.dob_month || '';
    if (!yyyy) yyyy = profile.dob_year || '';

    if (!element) return `${yyyy}-${mm}-${dd}`;

    const name = (element.getAttribute('name') || '').toLowerCase();
    const id = (element.getAttribute('id') || '').toLowerCase();
    const label = (FormFriendScannerStub.extractLabel(element) || '').toLowerCase();
    const placeholder = (element.getAttribute('placeholder') || '').toLowerCase();
    const combined = `${id} ${name} ${label} ${placeholder}`;

    // Segmented date detection
    if (/\b(day|dd|birth_day|dob_day)\b/.test(combined)) {
      return dd;
    }
    if (/\b(month|mm|birth_month|dob_month)\b/.test(combined)) {
      return mm;
    }
    if (/\b(year|yyyy|birth_year|dob_year)\b/.test(combined)) {
      return yyyy;
    }

    // Native date input MUST receive ISO YYYY-MM-DD
    if (element.type === 'date') {
      return `${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
    }

    // Text inputs: check placeholder for requested format
    if (placeholder.includes('yyyy-mm-dd') || placeholder.includes('yyyy/mm/dd')) {
      return `${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
    }
    if (placeholder.includes('mm/dd/yyyy') || placeholder.includes('mm-dd-yyyy')) {
      return `${String(mm).padStart(2, '0')}/${String(dd).padStart(2, '0')}/${yyyy}`;
    }

    // Standard Indian exam format: DD/MM/YYYY
    return `${String(dd).padStart(2, '0')}/${String(mm).padStart(2, '0')}/${yyyy}`;
  }

  function getProfileValue(profile, profileField, element) {
    if (!profile || !profileField) return undefined;

    // Full name resolution
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

    // Date of birth resolution
    if (
      profileField === 'date_of_birth' ||
      profileField === 'personal.date_of_birth' ||
      profileField === 'dateOfBirth' ||
      profileField === 'dob'
    ) {
      const rawDob = profile['personal.date_of_birth'] || profile.date_of_birth || profile.dob || profile.dateOfBirth;
      if (rawDob) {
        return formatDobForField(element, String(rawDob), profile);
      }
    }

    // Direct hit
    if (profile[profileField] !== undefined && profile[profileField] !== '') {
      return profile[profileField];
    }

    // Cross-schema aliases mapping
    const ALIASES = {
      // Personal
      'first_name': ['firstName', 'personal.first_name'],
      'personal.first_name': ['first_name', 'firstName'],
      'middle_name': ['middleName', 'personal.middle_name'],
      'personal.middle_name': ['middle_name', 'middleName'],
      'last_name': ['lastName', 'personal.last_name'],
      'personal.last_name': ['last_name', 'lastName'],
      'gender': ['personal.gender'],
      'personal.gender': ['gender'],
      'nationality': ['personal.nationality'],
      'personal.nationality': ['nationality'],
      'place_of_birth': ['personal.place_of_birth', 'birth_place'],
      'personal.place_of_birth': ['place_of_birth', 'birth_place'],
      'birth_state': ['personal.birth_state'],
      'personal.birth_state': ['birth_state'],
      'religion': ['personal.religion'],
      'personal.religion': ['religion'],
      'mother_tongue': ['personal.mother_tongue'],
      'personal.mother_tongue': ['mother_tongue'],
      'age': ['personal.age'],
      'personal.age': ['age'],

      // Contact
      'email': ['contact.email'],
      'contact.email': ['email'],
      'alternate_email': ['contact.alternate_email'],
      'contact.alternate_email': ['alternate_email'],
      'phone': ['contact.phone', 'mobile'],
      'contact.phone': ['phone', 'mobile'],
      'alternate_phone': ['contact.alternate_phone', 'alternatePhone'],
      'contact.alternate_phone': ['alternate_phone', 'alternatePhone'],

      // Address
      'address_line_1': ['address.address_line_1', 'address'],
      'address.address_line_1': ['address_line_1', 'address'],
      'address_line_2': ['address.address_line_2'],
      'address.address_line_2': ['address_line_2'],
      'locality': ['address.locality'],
      'address.locality': ['locality'],
      'city': ['address.city'],
      'address.city': ['city'],
      'district': ['address.district'],
      'address.district': ['district'],
      'state': ['address.state'],
      'address.state': ['state'],
      'country': ['address.country'],
      'address.country': ['country'],
      'pincode': ['address.pincode', 'postalCode'],
      'address.pincode': ['pincode', 'postalCode'],

      // Identity
      'identity_document': ['identity.identity_document'],
      'identity.identity_document': ['identity_document'],
      'aadhaar_number': ['identity.aadhaar_number', 'identity.aadhaar', 'aadhaarNumber', 'aadhaar'],
      'identity.aadhaar_number': ['aadhaar_number', 'aadhaarNumber', 'identity.aadhaar', 'aadhaar'],
      'pan_number': ['identity.pan_number', 'identity.pan', 'pan'],
      'identity.pan_number': ['pan_number', 'pan', 'identity.pan'],
      'passport_number': ['identity.passport_number', 'passportNumber', 'passport'],
      'identity.passport_number': ['passport_number', 'passportNumber', 'passport'],
      'registration_number': ['identity.registration_number', 'registration_number'],
      'identity.registration_number': ['registration_number'],
      'candidate_id': ['identity.candidate_id', 'studentId'],
      'identity.candidate_id': ['candidate_id', 'studentId'],

      // Category & Reservation
      'category': ['category.category'],
      'category.category': ['category'],
      'subcategory': ['category.subcategory'],
      'category.subcategory': ['subcategory'],
      'ews': ['category.ews'],
      'category.ews': ['ews'],
      'obc_ncl': ['category.obc_ncl', 'obc_status'],
      'category.obc_ncl': ['obc_ncl', 'obc_status'],
      'pwd': ['category.pwd'],
      'category.pwd': ['pwd'],
      'disability_type': ['category.disability_type'],
      'category.disability_type': ['disability_type'],
      'disability_percentage': ['category.disability_percentage'],
      'category.disability_percentage': ['disability_percentage'],

      // Family
      'father_name': ['family.father_name'],
      'family.father_name': ['father_name'],
      'father_occupation': ['family.father_occupation'],
      'family.father_occupation': ['father_occupation'],
      'father_phone': ['family.father_phone'],
      'family.father_phone': ['father_phone'],
      'mother_name': ['family.mother_name'],
      'family.mother_name': ['mother_name'],
      'mother_occupation': ['family.mother_occupation'],
      'family.mother_occupation': ['mother_occupation'],
      'mother_phone': ['family.mother_phone'],
      'family.mother_phone': ['mother_phone'],
      'guardian_name': ['family.guardian_name'],
      'family.guardian_name': ['guardian_name'],
      'guardian_occupation': ['family.guardian_occupation'],
      'family.guardian_occupation': ['guardian_occupation'],

      // Education
      'highest_qualification': ['education.highest_qualification', 'education'],
      'education.highest_qualification': ['highest_qualification', 'education'],
      'degree': ['education.degree', 'course'],
      'education.degree': ['degree', 'course'],
      'branch': ['education.branch', 'department'],
      'education.branch': ['branch', 'department'],
      'college': ['education.college'],
      'education.college': ['college'],
      'university': ['education.university'],
      'education.university': ['university'],
      'school': ['education.school'],
      'education.school': ['school'],
      'board': ['education.board'],
      'education.board': ['board'],
      'roll_number': ['education.roll_number'],
      'education.roll_number': ['roll_number'],
      'graduation_year': ['education.graduation_year'],
      'education.graduation_year': ['graduation_year'],
      'qualification_status': ['education.qualification_status', 'semester'],
      'education.qualification_status': ['qualification_status', 'semester'],
      'marks': ['education.marks'],
      'education.marks': ['marks'],
      'percentage': ['education.percentage'],
      'education.percentage': ['percentage'],
      'cgpa': ['education.cgpa'],
      'education.cgpa': ['cgpa'],

      // Examination
      'exam_name': ['examination.exam_name'],
      'examination.exam_name': ['exam_name'],
      'exam_paper': ['examination.exam_paper'],
      'examination.exam_paper': ['exam_paper'],
      'exam_subject': ['examination.exam_subject'],
      'examination.exam_subject': ['exam_subject'],
      'exam_medium': ['examination.exam_medium'],
      'examination.exam_medium': ['exam_medium'],
      'exam_centre': ['examination.exam_centre'],
      'examination.exam_centre': ['exam_centre'],
      'exam_session': ['examination.exam_session'],
      'examination.exam_session': ['exam_session'],

      // Bank
      'bank_name': ['financial.bank_name'],
      'financial.bank_name': ['bank_name'],
      'bank_account': ['financial.bank_account'],
      'financial.bank_account': ['bank_account'],
      'ifsc': ['financial.ifsc'],
      'financial.ifsc': ['ifsc']
    };

    const alternatives = ALIASES[profileField] || [];
    for (const alt of alternatives) {
      if (profile[alt] !== undefined && profile[alt] !== '') {
        return profile[alt];
      }
    }

    return undefined;
  }

  async function doReviewAndFill() {
    if (!currentMapping || currentMapping.length === 0) {
      await doScan();
      if (!currentMapping || currentMapping.length === 0) {
        return { ok: false, error: 'No fields could be mapped' };
      }
    }

    const profile = await FormFriendProfile.getProfile();
    if (!profile) {
      return { ok: false, error: 'No profile found. Please create one first.' };
    }

    const resolvedFields = [];
    
    // Resolve each mapped field
    for (const entry of currentMapping) {
      const element = FormFriendFieldRegistry.getElement(entry.fieldId);
      if (!element) continue;
      
      const label = FormFriendScannerStub.extractLabel(element) || entry.profileField;
      let person = entry.person;

      // 1. Unknown Person Flow (rare now that scanner defaults to self)
      if (person === 'unknown') {
        const decision = await FormFriendReviewUI.showUnknownPersonPrompt(label, '');
        if (decision === 'skip') continue;
        person = decision;
        entry.person = person;
      }

      let value = undefined;

      // 2. Profile Value Resolution
      if (person === 'self') {
        value = getProfileValue(profile, entry.profileField, element);

        // Missing Info Flow for Self
        if (!value) {
          // Conditional skip: if candidate is not PwD, do not prompt for disability details
          const isDisability = entry.profileField.includes('disability');
          const isNonPwd = profile['category.pwd'] === 'No' || profile.pwd === 'No' || profile['category.pwd'] === 'no' || profile['category.pwd'] === false;
          if (isDisability && isNonPwd) {
            continue;
          }

          // If field is not marked required on the form and user has no profile data, skip silently
          const isRequired = element.required || element.getAttribute('aria-required') === 'true';
          if (!isRequired) {
            continue;
          }

          const result = await FormFriendReviewUI.showMissingInfoPrompt(label, 'your profile', false);
          if (result.action === 'skip') continue;
          value = result.value;
          if (result.action === 'save' && value) {
            profile[entry.profileField] = value;
            await FormFriendProfile.updateProfile({ [entry.profileField]: value });
          }
        }
      } else {
        // Third-party Information Flow (Father, Mother, Guardian, Emergency Contact)
        // First attempt to resolve from user's saved family profile!
        value = getProfileValue(profile, entry.profileField, element);

        // If not in profile, only prompt if required
        if (!value) {
          const isRequired = element.required || element.getAttribute('aria-required') === 'true';
          if (!isRequired) {
            continue;
          }

          const result = await FormFriendReviewUI.showMissingInfoPrompt(label, `${person}'s information`, true);
          if (result.action === 'skip') continue;
          value = result.value;
          if (result.action === 'save' && value) {
            profile[entry.profileField] = value;
            await FormFriendProfile.updateProfile({ [entry.profileField]: value });
          }
        }
      }

      if (value) {
        resolvedFields.push({
          fieldId: entry.fieldId,
          profileField: entry.profileField,
          person: person,
          value: value,
          label: label
        });
      }
    }

    if (resolvedFields.length === 0) return { ok: false, error: 'No fields to fill' };

    // 3. Grouped Review UI
    const decision = await FormFriendReviewUI.showGrouped(resolvedFields);
    if (decision === 'cancel') return { ok: true, filled: false, reason: 'User cancelled' };

    // 4. Autofill
    const results = FormFriendAutofill.fillResolvedFields(resolvedFields);
    notifyBackground('FILL_COMPLETE');

    setTimeout(() => {
      doMismatchCheck();
    }, 500);

    return { ok: true, filled: true, results };
  }

  async function doMismatchCheck() {
    if (!currentMapping || currentMapping.length === 0) return { ok: false, error: 'No mapping available' };

    const profile = await FormFriendProfile.getProfile();
    if (!profile) return { ok: false, error: 'No profile found' };

    const allResults = FormFriendMismatchDetector.detectMismatches(currentMapping, profile);
    const warnings = FormFriendMismatchDetector.getWarnings(allResults);

    if (warnings.length > 0) {
      notifyBackground('MISMATCHES_FOUND', { mismatches: warnings });
      await FormFriendMismatchUI.show(warnings);
      return { ok: true, mismatches: warnings };
    }

    return { ok: true, mismatches: [] };
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
      case 'START_SCAN':
        doScan().then(sendResponse);
        return true;
      case 'START_REVIEW':
        doReviewAndFill().then(sendResponse);
        return true;
      case 'CHECK_MISMATCHES':
        doMismatchCheck().then(sendResponse);
        return true;
      case 'RESET_STATE':
        currentMapping = null;
        currentFields = null;
        FormFriendFieldRegistry.clearRegistry();
        sendResponse({ ok: true });
        break;
    }
  });

  return {
    scan: doScan,
    reviewAndFill: doReviewAndFill,
    checkMismatches: doMismatchCheck,
    getMapping: () => currentMapping,
    getFields: () => currentFields
  };
})();
