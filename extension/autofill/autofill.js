/**
 * FormFriend — Autofill Engine
 *
 * Updated to support React-controlled radios, checkboxes, and selects.
 */

var FormFriendAutofill = (function () {
  'use strict';

  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  const nativeCheckboxSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'checked')?.set;
  const nativeTextareaValueSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
  const nativeSelectValueSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;

  function dispatchInputEvent(element) {
    element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true, composed: true }));
  }

  function dispatchChangeEvent(element) {
    element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true, composed: true }));
  }

  function dispatchBlurEvent(element) {
    element.dispatchEvent(new Event('blur', { bubbles: true, cancelable: false, composed: true }));
  }

  function dispatchFocusEvent(element) {
    element.dispatchEvent(new Event('focus', { bubbles: true, cancelable: false, composed: true }));
  }

  function fillTextInput(element, value) {
    dispatchFocusEvent(element);
    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(element, value);
    } else {
      element.value = value;
    }
    dispatchInputEvent(element);
    dispatchChangeEvent(element);
    dispatchBlurEvent(element);
  }

  function fillDateInput(element, value) {
    const isoDate = FormFriendNormalize.normalizeDate(value);
    const dateValue = isoDate || value;
    dispatchFocusEvent(element);
    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(element, dateValue);
    } else {
      element.value = dateValue;
    }
    dispatchInputEvent(element);
    dispatchChangeEvent(element);
    dispatchBlurEvent(element);
  }

  function fillTextarea(element, value) {
    dispatchFocusEvent(element);
    if (nativeTextareaValueSetter) {
      nativeTextareaValueSetter.call(element, value);
    } else {
      element.value = value;
    }
    dispatchInputEvent(element);
    dispatchChangeEvent(element);
    dispatchBlurEvent(element);
  }

  function fillSelect(element, value) {
    dispatchFocusEvent(element);
    const normalizedValue = String(value).toLowerCase().trim();
    let matchedOption = null;

    for (const option of element.options) {
      if (option.value.toLowerCase().trim() === normalizedValue) {
        matchedOption = option; break;
      }
    }

    if (!matchedOption) {
      for (const option of element.options) {
        if (option.text.toLowerCase().trim() === normalizedValue) {
          matchedOption = option; break;
        }
      }
    }

    if (!matchedOption) {
      for (const option of element.options) {
        if (option.text.toLowerCase().trim().includes(normalizedValue) ||
            normalizedValue.includes(option.text.toLowerCase().trim())) {
          matchedOption = option; break;
        }
      }
    }

    if (matchedOption) {
      if (nativeSelectValueSetter) {
        nativeSelectValueSetter.call(element, matchedOption.value);
      } else {
        element.value = matchedOption.value;
      }
      dispatchInputEvent(element);
      dispatchChangeEvent(element);
      dispatchBlurEvent(element);
      return true;
    }
    return false;
  }

  function fillCheckbox(element, value) {
    const shouldCheck = (value === true || value === 'true' || value === 'yes' || value === '1' || value === 1);
    if (element.checked !== shouldCheck) {
      dispatchFocusEvent(element);
      if (nativeCheckboxSetter) {
        nativeCheckboxSetter.call(element, shouldCheck);
      } else {
        element.checked = shouldCheck;
      }
      dispatchInputEvent(element);
      dispatchChangeEvent(element);
      dispatchBlurEvent(element);
    }
  }

  function fillRadio(element, value) {
    const name = element.name;
    if (!name) {
      // Fallback if no name attribute exists (rare)
      if (nativeCheckboxSetter) nativeCheckboxSetter.call(element, true);
      else element.checked = true;
      dispatchInputEvent(element);
      dispatchChangeEvent(element);
      return;
    }

    const normalizedValue = String(value).toLowerCase().trim();
    const radios = document.querySelectorAll(`input[type="radio"][name="${name}"]`);

    let matchedRadio = null;
    
    // 1. Exact value match
    for (const radio of radios) {
      if (radio.value.toLowerCase().trim() === normalizedValue) {
        matchedRadio = radio; break;
      }
    }

    // 2. Label text match
    if (!matchedRadio) {
      for (const radio of radios) {
        let labelText = '';
        if (radio.id) {
          const label = document.querySelector(`label[for="${radio.id}"]`);
          if (label) labelText = label.textContent.toLowerCase().trim();
        }
        if (!labelText) {
          const parentLabel = radio.closest('label');
          if (parentLabel) labelText = parentLabel.textContent.toLowerCase().trim();
        }
        
        if (labelText === normalizedValue || labelText.includes(normalizedValue)) {
          matchedRadio = radio; break;
        }
      }
    }

    if (matchedRadio && !matchedRadio.checked) {
      dispatchFocusEvent(matchedRadio);
      if (nativeCheckboxSetter) {
        nativeCheckboxSetter.call(matchedRadio, true);
      } else {
        matchedRadio.checked = true;
      }
      dispatchInputEvent(matchedRadio);
      dispatchChangeEvent(matchedRadio);
      dispatchBlurEvent(matchedRadio);
    }
  }

  function fillField(element, value, inputType) {
    if (!element) return { success: false, error: 'Element is null' };
    if (value === undefined || value === null) return { success: false, error: 'Value is null/undefined' };

    try {
      const tag = element.tagName.toLowerCase();
      const type = inputType || element.type || 'text';

      if (tag === 'textarea') {
        fillTextarea(element, value);
      } else if (tag === 'select') {
        const matched = fillSelect(element, value);
        if (!matched) return { success: false, error: `No matching option for "${value}"` };
      } else if (tag === 'input') {
        switch (type) {
          case 'checkbox': fillCheckbox(element, value); break;
          case 'radio': fillRadio(element, value); break;
          case 'date':
          case 'datetime-local':
          case 'month':
          case 'week': fillDateInput(element, value); break;
          default: fillTextInput(element, value); break;
        }
      } else {
        if (element.isContentEditable) {
          dispatchFocusEvent(element);
          element.textContent = value;
          dispatchInputEvent(element);
          dispatchBlurEvent(element);
        } else {
          return { success: false, error: `Unsupported element: <${tag}>` };
        }
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  function fillResolvedFields(resolvedFields) {
    const results = { filled: [], skipped: [], errors: [] };

    for (const item of resolvedFields) {
      const { fieldId, value, profileField } = item;
      const element = FormFriendFieldRegistry.getElement(fieldId);
      
      if (!element) {
        results.errors.push({ fieldId, error: `DOM element not found` });
        continue;
      }

      if (value === undefined || value === null || value === '') {
        results.skipped.push({ fieldId, reason: 'Empty value' });
        continue;
      }

      const result = fillField(element, value);
      if (result.success) {
        results.filled.push({ fieldId, profileField, value });
      } else {
        results.errors.push({ fieldId, profileField, error: result.error });
      }
    }
    return results;
  }

  function fillForm(mapping, profile, options = {}) {
    const minConfidence = options.minConfidence ?? 0.7;
    const resolvedFields = [];
    
    if (Array.isArray(mapping)) {
      for (const entry of mapping) {
        if (entry.confidence && entry.confidence < minConfidence) continue;
        const value = profile[entry.profileField];
        if (value) {
          resolvedFields.push({ fieldId: entry.fieldId, value, profileField: entry.profileField });
        }
      }
    }
    return fillResolvedFields(resolvedFields);
  }

  return { fillField, fillForm, fillResolvedFields };
})();
