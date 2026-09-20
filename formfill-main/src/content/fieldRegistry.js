/**
 * FormFriend — Field Registry
 *
 * Maps stable FormFriend field IDs (ff_0, ff_1, …) to live DOM elements.
 *
 * Person A's scanner is responsible for:
 *   1. Finding form fields on the page.
 *   2. Assigning each a stable ID (e.g. ff_0).
 *   3. Calling FormFriendFieldRegistry.registerField(id, element).
 *
 * Person B's autofill engine then uses:
 *   FormFriendFieldRegistry.getElement(id)
 * to resolve the mapping back to a real HTMLElement.
 *
 * This decouples field discovery (Person A) from field interaction (Person B).
 */

// eslint-disable-next-line no-var
var FormFriendFieldRegistry = (function () {
  'use strict';

  /** @type {Map<string, HTMLElement>} */
  const registry = new Map();

  /**
   * Register a field ID → HTMLElement mapping.
   * Also sets a data attribute on the element for debugging.
   *
   * @param {string}      fieldId  Stable ID, e.g. "ff_0"
   * @param {HTMLElement}  element  The DOM element
   */
  function registerField(fieldId, element) {
    if (!fieldId || !element) {
      console.warn('[FormFriend][FieldRegistry] Invalid registration:', fieldId, element);
      return;
    }
    registry.set(fieldId, element);
    // Tag the element so it's visible in DevTools
    element.setAttribute('data-ff-id', fieldId);
  }

  /**
   * Resolve a field ID to its DOM element.
   *
   * Falls back to querySelector('[data-ff-id="..."]') in case
   * the in-memory map was cleared (e.g. service worker restart).
   *
   * @param {string} fieldId
   * @returns {HTMLElement|null}
   */
  function getElement(fieldId) {
    // Primary: in-memory map
    let el = registry.get(fieldId) || null;

    // Check the element is still in the DOM
    if (el && !document.contains(el)) {
      registry.delete(fieldId);
      el = null;
    }

    // Fallback: query by data attribute
    if (!el) {
      el = document.querySelector(`[data-ff-id="${fieldId}"]`);
      if (el) {
        registry.set(fieldId, el);
      }
    }

    return el;
  }

  /**
   * Return all registered field entries.
   * @returns {Array<{fieldId: string, element: HTMLElement}>}
   */
  function getAllFields() {
    const fields = [];
    for (const [fieldId, element] of registry) {
      if (document.contains(element)) {
        fields.push({ fieldId, element });
      }
    }
    return fields;
  }

  /**
   * Clear the entire registry.
   */
  function clearRegistry() {
    registry.clear();
  }

  /**
   * Get the number of registered fields.
   * @returns {number}
   */
  function size() {
    return registry.size;
  }

  // Public API
  return {
    registerField,
    getElement,
    getAllFields,
    clearRegistry,
    size
  };
})();
