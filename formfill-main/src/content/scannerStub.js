/**
 * FormFriend — Enhanced Scanner (drop-in replacement for src/content/scannerStub.js)
 *
 * Goals:
 * - Keep the existing FormFriendScannerStub.scanAndMap() API.
 * - Discover native controls AND common ARIA/custom controls.
 * - Improve label/context extraction.
 * - Keep existing native radio/select behavior compatible with main.js/autofill.js.
 * - For custom controls, collect rich metadata so they can be handled by a later
 *   control-specific filler. This file does NOT itself click custom widgets.
 *
 * Replace the existing scannerStub.js with this file for a discovery test.
 */
var FormFriendScannerStub = (function () {
  'use strict';

  const LABEL_RULES = [
    // Personal
    { patterns: ['full name', 'applicant name', 'candidate name', 'full legal name', 'name of candidate', 'name of applicant', 'your name', 'name'], profileField: 'full_name' },
    { patterns: ['first name', 'given name', 'forename'], profileField: 'first_name' },
    { patterns: ['middle name', 'middle initial'], profileField: 'middle_name' },
    { patterns: ['last name', 'surname', 'family name'], profileField: 'last_name' },
    { patterns: ['date of birth', 'dob', 'birth date', 'birthday', 'born on'], profileField: 'date_of_birth' },
    { patterns: ['age in years', 'how old are you', 'age (years)', 'age'], profileField: 'age' },
    { patterns: ['gender', 'sex', 'gender identity'], profileField: 'gender' },
    { patterns: ['nationality', 'citizenship', 'country of citizenship'], profileField: 'nationality' },
    { patterns: ['place of birth', 'birth place', 'city of birth', 'birth city'], profileField: 'place_of_birth' },
    { patterns: ['state of birth', 'birth state'], profileField: 'birth_state' },
    { patterns: ['religion', 'religious community'], profileField: 'religion' },
    { patterns: ['mother tongue', 'native language', 'first language'], profileField: 'mother_tongue' },

    // Contact
    { patterns: ['alternate email address', 'alternate email', 'secondary email', 'alt email'], profileField: 'alternate_email' },
    { patterns: ['email address', 'email id', 'e-mail', 'electronic mail', 'mail', 'email'], profileField: 'email' },
    { patterns: ['alternate phone number', 'alternate mobile number', 'alternate phone', 'alternate mobile', 'secondary contact number', 'alt phone'], profileField: 'alternate_phone' },
    { patterns: ['phone number', 'mobile number', 'contact number', 'telephone number', 'reach me at', 'mobile', 'telephone', 'phone'], profileField: 'phone' },

    // Address
    { patterns: ['complete address', 'permanent address', 'present address', 'home address', 'residential address', 'address'], profileField: 'address_line_1' },
    { patterns: ['address line 1', 'house number', 'house no', 'flat number', 'building', 'street address', 'street / road'], profileField: 'address_line_1' },
    { patterns: ['address line 2', 'landmark'], profileField: 'address_line_2' },
    { patterns: ['locality / village / area', 'village / town', 'locality', 'village', 'sector', 'area'], profileField: 'locality' },
    { patterns: ['city / town', 'city or town', 'city', 'town'], profileField: 'city' },
    { patterns: ['district name', 'home district', 'district'], profileField: 'district' },
    { patterns: ['state / ut', 'state of residence', 'state / province', 'state', 'province'], profileField: 'state' },
    { patterns: ['country of residence', 'country', 'nation'], profileField: 'country' },
    { patterns: ['pin code', 'pincode', 'postal code', 'zip code', 'zip'], profileField: 'pincode' },

    // Identity
    { patterns: ['identity document type', 'identity document', 'id document type', 'id type', 'identity proof'], profileField: 'identity_document' },
    { patterns: ['aadhaar number', 'aadhaar no', 'aadhar number', 'aadhar no', 'uidai number', 'aadhaar', 'aadhar'], profileField: 'aadhaar_number' },
    { patterns: ['pan number', 'pan card number', 'pan no', 'pan card', 'pan'], profileField: 'pan_number' },
    { patterns: ['passport number', 'passport no', 'passport'], profileField: 'passport_number' },
    { patterns: ['registration / enrollment number', 'registration number', 'registration no', 'enrollment number', 'enrollment no'], profileField: 'registration_number' },
    { patterns: ['candidate id', 'candidate number', 'candidate code', 'user id'], profileField: 'candidate_id' },

    // Category & Reservation
    { patterns: ['caste category', 'reservation category', 'social category', 'category'], profileField: 'category' },
    { patterns: ['sub category', 'category subtype', 'subcategory'], profileField: 'subcategory' },
    { patterns: ['economically weaker section (ews)', 'economically weaker section', 'are you ews', 'ews status', 'ews'], profileField: 'ews' },
    { patterns: ['obc status', 'obc non creamy layer', 'non creamy layer', 'creamy layer status', 'obc-ncl', 'obc ncl', 'obc'], profileField: 'obc_ncl' },
    { patterns: ['person with disability (pwd)', 'person with disability', 'disability status', 'are you pwd', 'pwd status', 'pwd'], profileField: 'pwd' },
    { patterns: ['type of disability', 'nature of disability', 'disability type'], profileField: 'disability_type' },
    { patterns: ['disability percentage', '% disability', 'percentage of disability'], profileField: 'disability_percentage' },

    // Family
    { patterns: ['father\'s name', 'father name', 'name of father', 'father full name'], profileField: 'father_name' },
    { patterns: ['father\'s occupation', 'father occupation', 'father\'s profession'], profileField: 'father_occupation' },
    { patterns: ['father\'s phone number', 'father\'s mobile number', 'father\'s phone', 'father\'s mobile', 'father contact number', 'father phone'], profileField: 'father_phone' },
    { patterns: ['mother\'s name', 'mother name', 'name of mother', 'mother full name'], profileField: 'mother_name' },
    { patterns: ['mother\'s occupation', 'mother occupation', 'mother\'s profession'], profileField: 'mother_occupation' },
    { patterns: ['mother\'s phone number', 'mother\'s mobile number', 'mother\'s phone', 'mother\'s mobile', 'mother contact number', 'mother phone'], profileField: 'mother_phone' },
    { patterns: ['guardian\'s name', 'guardian name', 'legal guardian'], profileField: 'guardian_name' },
    { patterns: ['guardian\'s occupation', 'guardian occupation', 'guardian profession'], profileField: 'guardian_occupation' },

    // Education
    { patterns: ['highest qualification', 'educational qualification', 'qualification'], profileField: 'highest_qualification' },
    { patterns: ['degree / program', 'degree name', 'degree', 'program', 'course'], profileField: 'degree' },
    { patterns: ['branch / specialization', 'specialization', 'stream', 'discipline', 'major', 'branch'], profileField: 'branch' },
    { patterns: ['college / institution', 'college name', 'institute', 'institution', 'institution attended', 'college'], profileField: 'college' },
    { patterns: ['university name', 'affiliating university', 'university'], profileField: 'university' },
    { patterns: ['school name', 'name of school', 'school'], profileField: 'school' },
    { patterns: ['board name', 'examination board', 'education board', 'board'], profileField: 'board' },
    { patterns: ['board roll number', 'exam roll number', 'roll number', 'roll no'], profileField: 'roll_number' },
    { patterns: ['year of graduation / passing', 'year of graduation', 'year of passing', 'graduation year', 'passing year'], profileField: 'graduation_year' },
    { patterns: ['qualification status', 'status of qualification', 'result status'], profileField: 'qualification_status' },
    { patterns: ['marks obtained', 'total marks', 'marks secured', 'marks'], profileField: 'marks' },
    { patterns: ['percentage obtained', 'aggregate percentage', 'percentage'], profileField: 'percentage' },
    { patterns: ['cgpa / gpa', 'cumulative gpa', 'grade point average', 'cgpa', 'gpa'], profileField: 'cgpa' },

    // Examination
    { patterns: ['examination name', 'exam name', 'entrance examination', 'test name'], profileField: 'exam_name' },
    { patterns: ['paper / paper code', 'exam paper', 'paper code', 'test paper'], profileField: 'exam_paper' },
    { patterns: ['exam subject', 'subject choice', 'subject'], profileField: 'exam_subject' },
    { patterns: ['medium of examination', 'exam medium', 'test language'], profileField: 'exam_medium' },
    { patterns: ['examination centre', 'exam centre', 'test centre', 'exam city'], profileField: 'exam_centre' },
    { patterns: ['session / shift', 'exam session', 'shift', 'exam slot'], profileField: 'exam_session' },

    // Bank
    { patterns: ['bank name', 'name of bank'], profileField: 'bank_name' },
    { patterns: ['account number', 'bank account number', 'bank account'], profileField: 'bank_account' },
    { patterns: ['ifsc code', 'bank ifsc', 'ifsc'], profileField: 'ifsc' }
  ];

  const CONSENT_KEYWORDS = [
    'agree', 'terms', 'conditions', 'privacy', 'consent', 'marketing',
    'certify', 'authorize', 'accept', 'acknowledge', 'i understand'
  ];

  const INTERACTIVE_ROLES = new Set([
    'textbox', 'combobox', 'listbox', 'option', 'checkbox', 'radio',
    'switch', 'slider', 'spinbutton', 'button'
  ]);

  const SKIP_TYPES = new Set(['hidden', 'submit', 'button', 'image', 'reset']);

  function normalize(value) {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function safeAttr(element, name) {
    try { return normalize(element.getAttribute(name)); } catch (_) { return ''; }
  }

  function elementType(element) {
    return normalize(element.getAttribute('type') || element.type || '').toLowerCase();
  }

  function getRole(element) {
    return safeAttr(element, 'role').toLowerCase();
  }

  function isVisible(element) {
    if (!(element instanceof Element)) return false;
    if (element.hidden) return false;
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    if (style.opacity === '0' && style.pointerEvents === 'none') return false;
    const rects = element.getClientRects();
    if (rects.length === 0 && element !== document.activeElement) return false;
    return true;
  }

  function isNativeControl(element) {
    const tag = element.tagName.toLowerCase();
    return tag === 'input' || tag === 'select' || tag === 'textarea';
  }

  function isContentEditable(element) {
    return element.isContentEditable === true || safeAttr(element, 'contenteditable').toLowerCase() === 'true';
  }

  function isInteractiveCandidate(element) {
    if (!(element instanceof HTMLElement)) return false;

    const tag = element.tagName.toLowerCase();
    const type = elementType(element);
    const role = getRole(element);

    if (isNativeControl(element)) {
      if (SKIP_TYPES.has(type) || type === 'file') return false;
      return true;
    }

    if (isContentEditable(element)) return true;
    if (role && INTERACTIVE_ROLES.has(role)) return true;

    // Common custom-control signals. These are intentionally conservative.
    if (tag === 'button' && (
      element.hasAttribute('aria-haspopup') ||
      element.hasAttribute('aria-expanded') ||
      element.hasAttribute('aria-pressed')
    )) return true;

    return false;
  }

  function textFromIds(element, attribute) {
    const ids = safeAttr(element, attribute).split(/\s+/).filter(Boolean);
    if (!ids.length) return '';
    return normalize(ids.map(id => document.getElementById(id)?.textContent || '').join(' '));
  }

  function extractLabel(element) {
    // 1. Explicit <label for="...">
    const id = safeAttr(element, 'id');
    if (id) {
      try {
        const escaped = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(id) : id.replace(/(["\\])/g, '\\$1');
        const label = document.querySelector(`label[for="${escaped}"]`);
        if (label) {
          const text = normalize(label.textContent);
          if (text) return text;
        }
      } catch (_) {}
    }

    // 2. aria-labelledby can be strongest for custom/ARIA widgets.
    const labelledBy = textFromIds(element, 'aria-labelledby');
    if (labelledBy) return labelledBy;

    // 3. Explicit aria-label.
    const ariaLabel = safeAttr(element, 'aria-label');
    if (ariaLabel) return ariaLabel;

    // 4. Wrapped <label>.
    const parentLabel = element.closest('label');
    if (parentLabel) {
      const clone = parentLabel.cloneNode(true);
      clone.querySelectorAll('input, select, textarea, button').forEach(node => node.remove());
      const text = normalize(clone.textContent);
      if (text) return text;
    }

    // 5. Placeholder / title / name.
    const placeholder = safeAttr(element, 'placeholder');
    if (placeholder) return placeholder;

    const title = safeAttr(element, 'title');
    if (title) return title;

    const name = safeAttr(element, 'name');
    if (name) return name.replace(/([A-Z])/g, ' $1').replace(/[_-]/g, ' ').trim();

    // 6. For buttons/custom widgets, nearby text is often the visible label.
    const ownText = normalize(element.textContent);
    if (ownText && ownText.length <= 160) return ownText;

    return '';
  }

  function extractGroupLabel(element) {
    const labelledBy = textFromIds(element, 'aria-labelledby');
    if (labelledBy) return labelledBy;

    const fieldset = element.closest('fieldset');
    if (fieldset) {
      const legend = fieldset.querySelector('legend');
      if (legend) return normalize(legend.textContent);
    }

    // Search only ancestors first; don't accidentally grab a heading from a distant container.
    let current = element.parentElement;
    let depth = 0;
    while (current && current !== document.body && depth < 4) {
      const header = current.querySelector(':scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > h5, :scope > h6, :scope > strong, :scope > label:not([for])');
      if (header && !header.contains(element)) {
        const text = normalize(header.textContent);
        if (text) return text;
      }
      current = current.parentElement;
      depth += 1;
    }

    return safeAttr(element, 'name').replace(/([A-Z])/g, ' $1').replace(/[_-]/g, ' ').trim();
  }

  function extractSectionContext(element) {
    const pieces = [];
    let current = element.parentElement;
    let depth = 0;

    while (current && current !== document.body && depth < 6) {
      const heading = current.querySelector(':scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > h5, :scope > h6');
      if (heading && !heading.contains(element)) {
        const text = normalize(heading.textContent);
        if (text && !pieces.includes(text)) pieces.push(text);
      }

      const legend = current.querySelector(':scope > legend');
      if (legend && !legend.contains(element)) {
        const text = normalize(legend.textContent);
        if (text && !pieces.includes(text)) pieces.push(text);
      }

      current = current.parentElement;
      depth += 1;
    }

    return pieces.reverse().slice(0, 3).join(' > ');
  }

  function determinePersonContext(element, labelText, sectionText) {
    const combined = `${sectionText} ${labelText}`.toLowerCase();
    
    // Mother tongue is personal language, NOT person mother
    if (combined.includes('mother tongue') || combined.includes('mother_tongue')) {
      return 'self';
    }

    if (/\bfather\b|\bdad\b|\bpaternal\b/.test(combined)) return 'father';
    if (/\bmother\b|\bmom\b|\bmaternal\b/.test(combined)) return 'mother';
    if (/\bguardian\b/.test(combined)) return 'guardian';
    if (/\bemergency\b/.test(combined)) return 'emergencyContact';
    if (/\bspouse\b|\bhusband\b|\bwife\b/.test(combined)) return 'spouse';
    if (/\bnominee\b/.test(combined)) return 'nominee';
    if (/\bco-?applicant\b/.test(combined)) return 'coApplicant';

    // On standard registration and examination forms, all other fields belong to the applicant (self)
    return 'self';
  }

  function isConsentCheckbox(label, element) {
    const type = elementType(element);
    const role = getRole(element);
    if (type !== 'checkbox' && role !== 'checkbox') return false;
    const txt = label.toLowerCase();
    return CONSENT_KEYWORDS.some(kw => txt.includes(kw));
  }

  function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Pre-compiled patterns sorted by length descending to prevent substring false-matches (e.g. "percentage" matching "age")
  const COMPILED_RULES = [];
  LABEL_RULES.forEach(rule => {
    rule.patterns.forEach(pattern => {
      const p = pattern.toLowerCase().trim();
      COMPILED_RULES.push({
        pattern: p,
        profileField: rule.profileField,
        regex: new RegExp(`(^|[^a-z0-9])${escapeRegExp(p)}([^a-z0-9]|$)`, 'i')
      });
    });
  });
  COMPILED_RULES.sort((a, b) => b.pattern.length - a.pattern.length);

  function matchLabel(label) {
    const normalized = normalize(label).toLowerCase();
    if (!normalized) return null;

    // 1. Exact string match
    for (const item of COMPILED_RULES) {
      if (normalized === item.pattern) {
        return { profileField: item.profileField, confidence: 0.98 };
      }
    }

    // 2. Word boundary match (longest pattern first)
    for (const item of COMPILED_RULES) {
      if (item.regex.test(normalized)) {
        return { profileField: item.profileField, confidence: 0.92 };
      }
    }

    return null;
  }

  function getControlType(element) {
    const tag = element.tagName.toLowerCase();
    const type = elementType(element);
    const role = getRole(element);

    if (tag === 'select') return 'select';
    if (type === 'radio') return 'radio';
    if (type === 'checkbox') return 'checkbox';
    if (tag === 'textarea') return 'textarea';
    if (role === 'checkbox') return 'custom-checkbox';
    if (role === 'radio') return 'custom-radio';
    if (role === 'combobox') return 'custom-combobox';
    if (role === 'listbox') return 'custom-listbox';
    if (role === 'option') return 'custom-option';
    if (role === 'switch') return 'custom-switch';
    if (role === 'slider') return 'custom-slider';
    if (role === 'spinbutton') return 'custom-spinbutton';
    if (isContentEditable(element)) return 'contenteditable';
    if (tag === 'button') return 'button';
    if (role === 'textbox') return 'custom-textbox';
    return type || tag;
  }

  function gatherNativeSelectOptions(element) {
    if (element.tagName.toLowerCase() !== 'select') return null;
    return Array.from(element.options).map(o => ({
      value: String(o.value),
      text: normalize(o.textContent || o.text)
    }));
  }

  function getControlledElementIds(element) {
    return safeAttr(element, 'aria-controls').split(/\s+/).filter(Boolean);
  }

  function gatherCustomOptions(element) {
    const role = getRole(element);
    const result = [];

    const collectOptions = root => {
      if (!root || !root.querySelectorAll) return;
      root.querySelectorAll('[role="option"]').forEach(option => {
        const text = normalize(option.textContent);
        if (!text) return;
        result.push({
          value: safeAttr(option, 'data-value') || safeAttr(option, 'value') || text,
          text,
          selected: safeAttr(option, 'aria-selected').toLowerCase() === 'true'
        });
      });
    };

    if (role === 'combobox' || role === 'listbox') {
      getControlledElementIds(element).forEach(id => collectOptions(document.getElementById(id)));

      // Some libraries render the listbox nearby without aria-controls.
      if (result.length === 0) {
        const nearby = element.parentElement?.querySelector('[role="listbox"]');
        collectOptions(nearby);
      }
    }

    // Standalone listbox itself.
    if (role === 'listbox') collectOptions(element);

    return result.length ? result : null;
  }

  function buildFieldRecord(fieldId, element, label, person, controlType, options, isUnknown, match) {
    const tag = element.tagName.toLowerCase();
    const role = getRole(element);
    const section = extractSectionContext(element);
    const inputType = elementType(element);

    return {
      fieldId,
      element,
      label: label || 'Unknown Field',
      type: inputType || tag,
      tag,
      role,
      name: safeAttr(element, 'name'),
      id: safeAttr(element, 'id'),
      placeholder: safeAttr(element, 'placeholder'),
      ariaLabel: safeAttr(element, 'aria-label'),
      section,
      person,
      controlType,
      options,
      confidence: match?.confidence || 0,
      profileField: match?.profileField || null,
      isUnknown: Boolean(isUnknown),
      isCustomControl: controlType.startsWith('custom-') || controlType === 'contenteditable',
      disabled: element.hasAttribute('disabled') || safeAttr(element, 'aria-disabled').toLowerCase() === 'true',
      required: element.hasAttribute('required') || safeAttr(element, 'aria-required').toLowerCase() === 'true'
    };
  }

  function scanAndMap() {
    FormFriendFieldRegistry.clearRegistry();

    const selector = [
      'input', 'select', 'textarea',
      '[contenteditable="true"]',
      '[role="textbox"]',
      '[role="combobox"]',
      '[role="listbox"]',
      '[role="checkbox"]',
      '[role="radio"]',
      '[role="switch"]',
      '[role="slider"]',
      '[role="spinbutton"]'
    ].join(', ');

    const allElements = Array.from(document.querySelectorAll(selector));
    const elements = allElements.filter(isInteractiveCandidate);

    const fields = [];
    const mapping = [];
    const radioGroups = new Map();
    const seen = new Set();
    let index = 0;

    for (const element of elements) {
      if (seen.has(element)) continue;
      seen.add(element);

      if (!isVisible(element)) continue;
      if (element.disabled || safeAttr(element, 'aria-disabled').toLowerCase() === 'true') continue;

      const id = safeAttr(element, 'id').toLowerCase();
      const name = safeAttr(element, 'name').toLowerCase();
      if (id.includes('captcha') || name.includes('captcha')) continue;
      if (safeAttr(element, 'accept') || elementType(element) === 'file') continue;

      const fieldId = `ff_${index++}`;
      const type = elementType(element);
      const role = getRole(element);
      const tag = element.tagName.toLowerCase();
      const controlType = getControlType(element);
      let label = extractLabel(element);
      const groupLabel = extractGroupLabel(element);
      if (!label && groupLabel) label = groupLabel;
      if (!label) label = role || type || tag;

      if (type === 'radio' || role === 'radio') {
        const groupName = safeAttr(element, 'name') || safeAttr(element, 'data-radio-group') || groupLabel || `group_${fieldId}`;
        if (!radioGroups.has(groupName)) radioGroups.set(groupName, { elements: [], firstId: fieldId, label: groupLabel || label });
        radioGroups.get(groupName).elements.push({ element, fieldId });
        FormFriendFieldRegistry.registerField(fieldId, element);
        fields.push(buildFieldRecord(fieldId, element, label, 'unknown', controlType, null, true, null));
        continue;
      }

      FormFriendFieldRegistry.registerField(fieldId, element);
      const section = extractSectionContext(element);
      const person = determinePersonContext(element, label, section);
      const match = matchLabel(label);
      const options = gatherNativeSelectOptions(element) || gatherCustomOptions(element);
      const record = buildFieldRecord(fieldId, element, label, person, controlType, options, !match, match);
      fields.push(record);

      if (isConsentCheckbox(label, element)) {
        console.log(`[FormFriend] Skipping legal/consent checkbox: "${label}"`);
        continue;
      }

      if (match) {
        let dateFormat = null;
        if (match.profileField === 'dateOfBirth' && tag === 'input') {
          const str = `${safeAttr(element, 'placeholder')} ${name} ${label}`.toLowerCase();
          let part = null;
          if (/\b(dd|day)\b/.test(str)) part = 'dd';
          else if (/\b(mm|month)\b/.test(str)) part = 'mm';
          else if (/\b(yyyy|year)\b/.test(str)) part = 'yyyy';

          if (part) {
            mapping.push({
              fieldId,
              profileField: match.profileField,
              controlType: 'segmented-date',
              datePart: part,
              person,
              confidence: match.confidence,
              label,
              section,
              role
            });
            continue;
          }

          if (type === 'text' && !/dd\/mm\/yyyy|mm\/dd\/yyyy|dd-mm-yyyy|yyyy-mm-dd|ddmmyyyy/.test(str)) {
            dateFormat = 'unknown';
          }
        }

        mapping.push({
          ...record,
          dateFormat
        });
      } else {
        // Unknowns are intentionally preserved for Part 3 / LLM later.
        mapping.push({
          ...record,
          profileField: safeAttr(element, 'name') || label.replace(/\s+/g, '').substring(0, 30) || fieldId,
          isUnknown: true,
          confidence: 0
        });
      }
    }

    for (const group of radioGroups.values()) {
      const firstEl = group.elements[0]?.element;
      if (!firstEl) continue;

      const groupLabel = group.label || extractGroupLabel(firstEl) || safeAttr(firstEl, 'name');
      const match = matchLabel(groupLabel);
      const person = determinePersonContext(firstEl, groupLabel, extractSectionContext(firstEl));
      const options = group.elements.map(({ element }) => {
        let optText = safeAttr(element, 'value');
        const id = safeAttr(element, 'id');
        if (id) {
          try {
            const escaped = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(id) : id.replace(/(["\\])/g, '\\$1');
            const labelEl = document.querySelector(`label[for="${escaped}"]`);
            if (labelEl) optText = normalize(labelEl.textContent) || optText;
          } catch (_) {}
        }
        if (!optText) {
          const parentLabel = element.closest('label');
          if (parentLabel) optText = normalize(parentLabel.textContent);
        }
        return { value: safeAttr(element, 'value'), text: optText };
      });

      const radioFieldId = group.firstId;
      if (match) {
        mapping.push({
          fieldId: radioFieldId,
          profileField: match.profileField,
          controlType: 'radio',
          person,
          confidence: match.confidence,
          options,
          label: groupLabel,
          section: extractSectionContext(firstEl),
          role: 'radio'
        });
      } else {
        mapping.push({
          fieldId: radioFieldId,
          profileField: safeAttr(firstEl, 'name') || groupLabel,
          controlType: 'radio',
          person,
          confidence: 0,
          options,
          label: groupLabel,
          section: extractSectionContext(firstEl),
          role: 'radio',
          isUnknown: true
        });
      }
    }

    console.log('[FormFriend] Enhanced scan:', {
      discovered: fields.length,
      mappings: mapping.length,
      customControls: fields.filter(f => f.isCustomControl).length,
      unknowns: mapping.filter(m => m.isUnknown).length
    });

    return { fields, mapping };
  }

  return {
    scanAndMap,
    extractLabel
  };
})();
