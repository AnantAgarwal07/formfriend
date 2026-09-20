/**
 * FormFriend — Backend API Integration (Privacy-Safe)
 *
 * Sends ONLY structural/anonymised form metadata to the backend.
 * NEVER sends actual profile values (name, DOB, phone, email, etc.)
 *
 * The backend returns field mappings, which the autofill engine
 * then resolves against the LOCAL profile.
 */

// eslint-disable-next-line no-var
var FormFriendAPI = (function () {
  'use strict';

  const API_BASE_URL = 'http://localhost:3000';

  // Fields that are NEVER allowed in outgoing requests
  const PII_FIELDS = [
    'fullName', 'name', 'email', 'phone', 'mobile',
    'dateOfBirth', 'dob', 'college', 'department',
    'semester', 'address', 'password', 'value', 'currentValue'
  ];

  /**
   * Privacy guard: strips any PII values that may have accidentally
   * been included in the request payload.
   */
  function sanitizePayload(payload) {
    const sanitized = JSON.parse(JSON.stringify(payload)); 
    for (const key of PII_FIELDS) {
      if (sanitized[key] !== undefined) {
        delete sanitized[key];
      }
    }
    return sanitized;
  }

  /**
   * Send single form field structure to the backend for semantic mapping.
   */
  async function resolveFieldIntelligence(formFingerprint, fieldData) {
    const safeField = sanitizePayload(fieldData);
    const payload = {
      formFingerprint,
      field: safeField
    };

    try {
      // NOTE: For testing, you must store your idToken in chrome.storage.local under 'idToken'
      const { idToken } = await chrome.storage.local.get('idToken');
      
      const response = await fetch(`${API_BASE_URL}/intelligence/resolve`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': idToken ? `Bearer ${idToken}` : ''
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Backend returned ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.warn('[FormFriend][API] Backend unavailable or field resolution failed:', error.message);
      return null;
    }
  }

  /**
   * Check if the backend is reachable.
   * @returns {Promise<boolean>}
   */
  async function isBackendAvailable() {
    try {
      const response = await fetch(`${API_BASE_URL}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000)
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  // Public API
  return {
    resolveFieldIntelligence,
    isBackendAvailable,
    sanitizePayload  // Exported for testing
  };
})();
