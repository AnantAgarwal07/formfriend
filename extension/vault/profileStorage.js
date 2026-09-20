/**
 * FormFriend — Profile Storage Module
 *
 * All user PII is stored exclusively in chrome.storage.local.
 * This data NEVER leaves the browser. The backend only receives
 * structural/anonymised form metadata.
 *
 * Profile schema:
 * {
 *   fullName:      string,
 *   email:         string,
 *   phone:         string,
 *   dateOfBirth:   string,
 *   college:       string,
 *   department:    string,
 *   semester:      string
 * }
 */

// eslint-disable-next-line no-var
var FormFriendProfile = (function () {
  'use strict';

  const STORAGE_KEY = 'formfriend_profile';

  /**
   * Save a complete profile (overwrites any existing one).
   * @param {Object} profile
   * @returns {Promise<void>}
   */
  function saveProfile(profile) {
    return new Promise((resolve, reject) => {
      if (!profile || typeof profile !== 'object') {
        return reject(new Error('Invalid profile object'));
      }
      chrome.storage.local.set({ [STORAGE_KEY]: profile }, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Retrieve the stored profile.
   * @returns {Promise<Object|null>}  The profile, or null if none exists.
   */
  function getProfile() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get([STORAGE_KEY], (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(result[STORAGE_KEY] || null);
        }
      });
    });
  }

  /**
   * Merge partial updates into the existing profile.
   * @param {Object} partial  Key/value pairs to update.
   * @returns {Promise<Object>}  The merged profile.
   */
  async function updateProfile(partial) {
    if (!partial || typeof partial !== 'object') {
      throw new Error('Invalid partial profile object');
    }
    const existing = (await getProfile()) || {};
    const merged = { ...existing, ...partial };
    await saveProfile(merged);
    return merged;
  }

  /**
   * Delete the stored profile entirely.
   * @returns {Promise<void>}
   */
  function deleteProfile() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.remove([STORAGE_KEY], () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Check whether a profile exists.
   * @returns {Promise<boolean>}
   */
  async function hasProfile() {
    const profile = await getProfile();
    return profile !== null;
  }

  // Public API
  return {
    saveProfile,
    getProfile,
    updateProfile,
    deleteProfile,
    hasProfile,
    STORAGE_KEY
  };
})();
