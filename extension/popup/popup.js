/**
 * FormFriend — Popup Script
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'formfriend_profile';

  const views = {
    noProfile:    document.getElementById('state-no-profile'),
    profileReady: document.getElementById('state-profile-ready'),
    scanning:     document.getElementById('state-scanning'),
    mapped:       document.getElementById('state-mapped'),
    filled:       document.getElementById('state-filled'),
    mismatch:     document.getElementById('state-mismatch'),
    profileForm:  document.getElementById('state-profile-form')
  };

  const profileSummaryEl = document.getElementById('profile-summary');
  const fieldCountEl = document.getElementById('field-count');
  const mismatchCountEl = document.getElementById('mismatch-count');
  const profileFormEl = document.getElementById('profile-form');

  let schema = null;
  let STANDARD_FIELDS = []; // Will be populated from schema

  function showView(viewKey) {
    for (const [key, el] of Object.entries(views)) {
      el.hidden = key !== viewKey;
    }
  }

  function getProfile() {
    return new Promise((resolve) => {
      chrome.storage.local.get([STORAGE_KEY], (result) => {
        resolve(result[STORAGE_KEY] || null);
      });
    });
  }

  function saveProfile(profile) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [STORAGE_KEY]: profile }, resolve);
    });
  }

  function deleteProfile() {
    return new Promise((resolve) => {
      chrome.storage.local.remove([STORAGE_KEY], resolve);
    });
  }

  function renderProfileSummary(profile) {
    if (!profile) return;
    const lines = [];
    const fullName = [profile.firstName, profile.middleName, profile.lastName].filter(Boolean).join(' ') || profile['personal.name'] || profile.fullName || '';
    if (fullName) lines.push(`<strong>${fullName}</strong>`);
    const email = profile['contact.email'] || profile.email;
    if (email) lines.push(email);
    const phone = profile['contact.phone'] || profile.phone;
    if (phone) lines.push(phone);
    const college = profile['education.college'] || profile.college;
    if (college) lines.push(college);
    profileSummaryEl.innerHTML = lines.join('<br>');
  }

  async function loadSchema() {
    if (schema) return schema;
    try {
      const res = await fetch('schema.json');
      schema = await res.json();
      
      STANDARD_FIELDS = [
        'firstName', 'middleName', 'lastName',
        'dob_day', 'dob_month', 'dob_year'
      ];
      schema.categories.forEach(cat => {
        cat.classes.forEach(cls => {
          const key = `${cat.id}.${cls.id}`;
          if (
            key !== 'personal.full_name' &&
            key !== 'personal.first_name' &&
            key !== 'personal.middle_name' &&
            key !== 'personal.last_name' &&
            key !== 'personal.name' &&
            key !== 'account.username'
          ) {
            STANDARD_FIELDS.push(key);
          }
        });
      });
      return schema;
    } catch (e) {
      console.error('Failed to load schema', e);
      return { categories: [] };
    }
  }

  function generateDobDropdownHtml() {
    let daysHtml = '<option value="">Day</option>';
    for (let d = 1; d <= 31; d++) {
      const val = String(d).padStart(2, '0');
      daysHtml += `<option value="${val}">${val}</option>`;
    }

    const months = [
      ['01', 'Jan'], ['02', 'Feb'], ['03', 'Mar'], ['04', 'Apr'],
      ['05', 'May'], ['06', 'Jun'], ['07', 'Jul'], ['08', 'Aug'],
      ['09', 'Sep'], ['10', 'Oct'], ['11', 'Nov'], ['12', 'Dec']
    ];
    let monthsHtml = '<option value="">Month</option>';
    months.forEach(([val, name]) => {
      monthsHtml += `<option value="${val}">${val} - ${name}</option>`;
    });

    const currentYear = new Date().getFullYear();
    let yearsHtml = '<option value="">Year</option>';
    for (let y = currentYear; y >= 1950; y--) {
      yearsHtml += `<option value="${y}">${y}</option>`;
    }

    return `
      <div class="ff-form-group">
        <label>Date of Birth</label>
        <div style="display: flex; gap: 6px;">
          <select id="pf-dob-day" name="dob_day" style="flex: 1;">
            ${daysHtml}
          </select>
          <select id="pf-dob-month" name="dob_month" style="flex: 1.5;">
            ${monthsHtml}
          </select>
          <select id="pf-dob-year" name="dob_year" style="flex: 1.5;">
            ${yearsHtml}
          </select>
        </div>
      </div>
    `;
  }

  function renderDynamicForm() {
    const container = document.getElementById('dynamic-schema-form');
    if (!schema || container.innerHTML.trim() !== '') return;

    let html = '';

    schema.categories.forEach((category, catIdx) => {
      if (category.id === 'account' || category.id === 'restricted_fields') return;

      const marginTop = catIdx === 0 ? '0' : '16px';
      html += `<h3 style="margin-top: ${marginTop}; margin-bottom: 8px; text-transform: capitalize;">${category.id.replace(/_/g, ' ')}</h3>`;
      
      category.classes.forEach(cls => {
        const key = `${category.id}.${cls.id}`;

        // Skip full_name and redundant personal.name as we render first, middle, last name
        if (key === 'personal.full_name' || key === 'personal.name') return;

        if (key === 'personal.first_name') {
          html += `
            <div class="ff-form-group">
              <label for="pf-firstName">First Name</label>
              <input type="text" id="pf-firstName" name="firstName" required>
            </div>
          `;
          return;
        }

        if (key === 'personal.middle_name') {
          html += `
            <div class="ff-form-group">
              <label for="pf-middleName">Middle Name</label>
              <input type="text" id="pf-middleName" name="middleName">
            </div>
          `;
          return;
        }

        if (key === 'personal.last_name') {
          html += `
            <div class="ff-form-group">
              <label for="pf-lastName">Last Name</label>
              <input type="text" id="pf-lastName" name="lastName" required>
            </div>
          `;
          return;
        }

        // Custom renderer for Date of Birth
        if (cls.id === 'date_of_birth') {
          html += generateDobDropdownHtml();
          return;
        }

        // Custom renderer for Gender
        if (cls.id === 'gender') {
          html += `
            <div class="ff-form-group">
              <label for="pf-${key}">Gender</label>
              <select id="pf-${key}" name="${key}">
                <option value="">Select Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
          `;
          return;
        }

        // Custom renderer for Category
        if (cls.id === 'category') {
          html += `
            <div class="ff-form-group">
              <label for="pf-${key}">Category</label>
              <select id="pf-${key}" name="${key}">
                <option value="">Select Category</option>
                <option value="General">General</option>
                <option value="EWS">EWS</option>
                <option value="OBC">OBC</option>
                <option value="SC">SC</option>
                <option value="ST">ST</option>
              </select>
            </div>
          `;
          return;
        }

        // Custom renderer for EWS
        if (cls.id === 'ews') {
          html += `
            <div class="ff-form-group">
              <label for="pf-${key}">Economically Weaker Section (EWS)</label>
              <select id="pf-${key}" name="${key}">
                <option value="">Select</option>
                <option value="No">No</option>
                <option value="Yes">Yes</option>
              </select>
            </div>
          `;
          return;
        }

        // Custom renderer for OBC-NCL
        if (cls.id === 'obc_ncl') {
          html += `
            <div class="ff-form-group">
              <label for="pf-${key}">OBC Status</label>
              <select id="pf-${key}" name="${key}">
                <option value="">Select Status</option>
                <option value="Not Applicable">Not Applicable</option>
                <option value="Non-Creamy Layer">Non-Creamy Layer</option>
                <option value="Creamy Layer">Creamy Layer</option>
              </select>
            </div>
          `;
          return;
        }

        // Custom renderer for PwD
        if (cls.id === 'pwd') {
          html += `
            <div class="ff-form-group">
              <label for="pf-${key}">Person with Disability (PwD)</label>
              <select id="pf-${key}" name="${key}">
                <option value="">Select</option>
                <option value="No">No</option>
                <option value="Yes">Yes</option>
              </select>
            </div>
          `;
          return;
        }

        // Custom renderer for Highest Qualification
        if (cls.id === 'highest_qualification') {
          html += `
            <div class="ff-form-group">
              <label for="pf-${key}">Highest Educational Qualification</label>
              <select id="pf-${key}" name="${key}">
                <option value="">Select Qualification</option>
                <option value="10th">10th / Secondary</option>
                <option value="12th">12th / Higher Secondary / Intermediate</option>
                <option value="Diploma">Diploma / Polytechnic</option>
                <option value="Graduation">Bachelor's / Graduation (B.Tech, B.E, B.Sc, B.Com, B.A)</option>
                <option value="Post Graduation">Master's / Post Graduation (M.Tech, M.E, M.Sc, M.Com, MBA)</option>
                <option value="Doctorate">Doctorate / Ph.D</option>
                <option value="Other">Other</option>
              </select>
            </div>
          `;
          return;
        }

        const labelText = cls.id.replace(/_/g, ' ').replace(/^./, str => str.toUpperCase());
        html += `
          <div class="ff-form-group">
            <label for="pf-${key}">${labelText}</label>
            <input type="text" id="pf-${key}" name="${key}" placeholder="${cls.examples ? cls.examples[0] : ''}">
          </div>
        `;
      });
    });

    container.innerHTML = html;
  }

  function populateForm(profile) {
    if (!profile) return;

    // Standard fields
    for (const field of STANDARD_FIELDS) {
      const input = document.querySelector(`[name="${field}"]`);
      if (input && profile[field] !== undefined) {
        if (input.type === 'checkbox') {
          input.checked = profile[field] === true || profile[field] === 'true' || profile[field] === 'yes';
        } else {
          input.value = profile[field];
        }
      }
    }

    // Populate Name fields with fallbacks
    const firstNameInput = document.querySelector('[name="firstName"]');
    const middleNameInput = document.querySelector('[name="middleName"]');
    const lastNameInput = document.querySelector('[name="lastName"]');
    if (firstNameInput && !firstNameInput.value) {
      firstNameInput.value = profile['personal.first_name'] || profile.first_name || '';
    }
    if (middleNameInput && !middleNameInput.value) {
      middleNameInput.value = profile['personal.middle_name'] || profile.middle_name || '';
    }
    if (lastNameInput && !lastNameInput.value) {
      lastNameInput.value = profile['personal.last_name'] || profile.last_name || '';
    }

    // If still no first/last name, try parsing full_name or personal.name
    if (firstNameInput && !firstNameInput.value && (profile.full_name || profile['personal.name'])) {
      const nameStr = (profile.full_name || profile['personal.name']).trim();
      const parts = nameStr.split(/\s+/);
      if (parts.length === 1) {
        firstNameInput.value = parts[0];
      } else if (parts.length === 2) {
        firstNameInput.value = parts[0];
        if (lastNameInput) lastNameInput.value = parts[1];
      } else if (parts.length > 2) {
        firstNameInput.value = parts[0];
        if (middleNameInput) middleNameInput.value = parts.slice(1, -1).join(' ');
        if (lastNameInput) lastNameInput.value = parts[parts.length - 1];
      }
    }

    // Populate Date of Birth dropdowns if not directly filled
    let dob = profile['personal.date_of_birth'] || profile.date_of_birth || profile.dob || profile.dateOfBirth;
    let day = profile.dob_day || '';
    let month = profile.dob_month || '';
    let year = profile.dob_year || '';

    if (dob && (!day || !month || !year)) {
      if (dob.includes('-')) {
        const parts = dob.split('-');
        if (parts.length === 3) {
          year = parts[0];
          month = String(parts[1]).padStart(2, '0');
          day = String(parts[2]).padStart(2, '0');
        }
      } else if (dob.includes('/')) {
        const parts = dob.split('/');
        if (parts.length === 3) {
          day = String(parts[0]).padStart(2, '0');
          month = String(parts[1]).padStart(2, '0');
          year = parts[2];
        }
      }
    }

    const dayEl = document.querySelector('[name="dob_day"]');
    const monthEl = document.querySelector('[name="dob_month"]');
    const yearEl = document.querySelector('[name="dob_year"]');
    if (dayEl && day) dayEl.value = day;
    if (monthEl && month) monthEl.value = month;
    if (yearEl && year) yearEl.value = year;
  }

  function readForm() {
    const profile = {};
    for (const field of STANDARD_FIELDS) {
      const input = document.querySelector(`[name="${field}"]`);
      if (input) {
        if (input.type === 'checkbox') {
          profile[field] = input.checked;
        } else {
          profile[field] = input.value.trim();
        }
      }
    }

    // Combine First, Middle, and Last name into full name aliases
    const combinedName = [profile.firstName, profile.middleName, profile.lastName].filter(Boolean).join(' ');
    profile['full_name'] = combinedName;
    profile['personal.full_name'] = combinedName;
    profile['personal.name'] = combinedName;
    profile['personal.first_name'] = profile.firstName || '';
    profile['personal.middle_name'] = profile.middleName || '';
    profile['personal.last_name'] = profile.lastName || '';

    // Date of birth serialization
    const day = document.querySelector('[name="dob_day"]')?.value;
    const month = document.querySelector('[name="dob_month"]')?.value;
    const year = document.querySelector('[name="dob_year"]')?.value;
    if (day && month && year) {
      const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      profile['personal.date_of_birth'] = iso;
      profile['date_of_birth'] = iso;
      profile['dob'] = iso;
      profile['dob_day'] = String(day).padStart(2, '0');
      profile['dob_month'] = String(month).padStart(2, '0');
      profile['dob_year'] = String(year);
    }

    return profile;
  }

  function clearForm() {
    for (const field of STANDARD_FIELDS) {
      const input = document.querySelector(`[name="${field}"]`);
      if (input) {
        if (input.type === 'checkbox') input.checked = false;
        else input.value = '';
      }
    }
    const firstNameInput = document.querySelector('[name="firstName"]');
    const middleNameInput = document.querySelector('[name="middleName"]');
    const lastNameInput = document.querySelector('[name="lastName"]');
    if (firstNameInput) firstNameInput.value = '';
    if (middleNameInput) middleNameInput.value = '';
    if (lastNameInput) lastNameInput.value = '';

    const dayEl = document.querySelector('[name="dob_day"]');
    const monthEl = document.querySelector('[name="dob_month"]');
    const yearEl = document.querySelector('[name="dob_year"]');
    if (dayEl) dayEl.value = '';
    if (monthEl) monthEl.value = '';
    if (yearEl) yearEl.value = '';
  }

  function sendToContentScript(message) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, (response) => {
        resolve(response || { ok: false });
      });
    });
  }

  async function init() {
    await loadSchema();
    renderDynamicForm();

    const profile = await getProfile();

    if (!profile) {
      showView('noProfile');
      return;
    }

    try {
      const tabState = await sendToContentScript({ type: 'GET_TAB_STATE' });
      switch (tabState.status) {
        case 'scanning':
          showView('scanning');
          return;
        case 'mapped':
          fieldCountEl.textContent = tabState.fieldCount || '?';
          showView('mapped');
          return;
        case 'filled':
          showView('filled');
          return;
        case 'mismatch':
          mismatchCountEl.textContent = tabState.mismatches ? tabState.mismatches.length : '?';
          showView('mismatch');
          return;
      }
    } catch (e) {}

    renderProfileSummary(profile);
    showView('profileReady');
  }

  document.getElementById('btn-create-profile').addEventListener('click', () => {
    clearForm();
    document.getElementById('btn-delete-profile').hidden = true;
    showView('profileForm');
  });

  document.getElementById('btn-edit-profile').addEventListener('click', async () => {
    const profile = await getProfile();
    if (profile) populateForm(profile);
    document.getElementById('btn-delete-profile').hidden = false;
    showView('profileForm');
  });

  document.getElementById('btn-cancel-profile').addEventListener('click', async () => {
    const profile = await getProfile();
    if (profile) {
      renderProfileSummary(profile);
      showView('profileReady');
    } else {
      showView('noProfile');
    }
  });

  profileFormEl.addEventListener('submit', async (e) => {
    e.preventDefault();
    const profile = readForm();
    if (!profile.firstName || !profile.lastName || !profile['contact.email']) {
      alert('First Name, Last Name, and email are required.');
      return;
    }
    await saveProfile(profile);
    renderProfileSummary(profile);
    showView('profileReady');
  });

  document.getElementById('btn-delete-profile').addEventListener('click', async () => {
    if (confirm('Delete your FormFriend profile?')) {
      await deleteProfile();
      clearForm();
      showView('noProfile');
    }
  });

  document.getElementById('btn-scan-form').addEventListener('click', async () => {
    showView('scanning');
    const response = await sendToContentScript({ type: 'START_SCAN' });
    if (response && response.fieldCount) {
      fieldCountEl.textContent = response.fieldCount;
      showView('mapped');
    } else if (response && response.error) {
      alert(response.error);
      showView('profileReady');
    }
  });

  document.getElementById('btn-review-fill').addEventListener('click', async () => {
    const response = await sendToContentScript({ type: 'START_REVIEW' });
    if (response && response.filled) {
      showView('filled');
    }
    window.close();
  });

  document.getElementById('btn-check-mismatches').addEventListener('click', async () => {
    const response = await sendToContentScript({ type: 'CHECK_MISMATCHES' });
    if (response && response.mismatches && response.mismatches.length > 0) {
      mismatchCountEl.textContent = response.mismatches.length;
      showView('mismatch');
    } else {
      alert('No mismatches found! ✓');
    }
  });

  document.getElementById('btn-review-mismatches').addEventListener('click', async () => {
    await sendToContentScript({ type: 'CHECK_MISMATCHES' });
    window.close();
  });

  document.getElementById('btn-reset').addEventListener('click', async () => {
    await sendToContentScript({ type: 'RESET_STATE' });
    const profile = await getProfile();
    if (profile) {
      renderProfileSummary(profile);
      showView('profileReady');
    } else {
      showView('noProfile');
    }
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'STATE_UPDATE') {
      if (message.status === 'filled') showView('filled');
      if (message.status === 'mismatch') {
        mismatchCountEl.textContent = message.count || '?';
        showView('mismatch');
      }
    }
  });

  init();
})();
