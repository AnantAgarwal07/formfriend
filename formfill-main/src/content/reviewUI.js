/**
 * FormFriend — Review-Before-Fill UI and Prompts
 * 
 * Supports interactive prompts and grouped reviews for different person contexts.
 */

var FormFriendReviewUI = (function () {
  'use strict';

  let overlayHost = null;

  const SHADOW_CSS = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    .ff-review-card {
      background: #ffffff; border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      width: 440px; max-height: 85vh;
      display: flex; flex-direction: column; overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #1a1a2e; animation: ff-slideIn 0.25s ease-out;
    }
    @keyframes ff-slideIn {
      from { opacity: 0; transform: translateY(-20px) scale(0.96); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    .ff-header { padding: 20px 24px 16px; border-bottom: 1px solid #eee; }
    .ff-header h2 { font-size: 18px; font-weight: 700; display: flex; align-items: center; gap: 8px; }
    .ff-header .ff-subtitle { font-size: 13px; color: #666; margin-top: 4px; line-height: 1.4; }
    
    .ff-body-scroll { flex: 1; overflow-y: auto; padding: 12px 24px; }
    
    .ff-section-title { font-size: 11px; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin: 16px 0 8px; border-bottom: 1px solid #eee; padding-bottom: 4px; }
    .ff-section-title:first-child { margin-top: 0; }
    
    .ff-field-item { display: flex; align-items: flex-start; gap: 12px; padding: 8px 0; }
    .ff-field-icon { flex-shrink: 0; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; margin-top: 2px; }
    .ff-field-icon.ok { background: #e8f5e9; color: #2e7d32; }
    .ff-field-icon.warn { background: #fff3e0; color: #ef6c00; }
    
    .ff-field-body { flex: 1; min-width: 0; }
    .ff-field-label { font-size: 12px; font-weight: 600; color: #555; }
    .ff-field-value { font-size: 14px; color: #1a1a2e; margin-top: 2px; word-break: break-word; }
    .ff-field-value.needs-review { color: #ef6c00; font-style: italic; font-size: 13px; }
    
    .ff-actions { padding: 16px 24px; border-top: 1px solid #eee; display: flex; gap: 12px; justify-content: flex-end; }
    .ff-btn { padding: 10px 20px; border-radius: 8px; border: none; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.15s ease; }
    .ff-btn:hover { transform: translateY(-1px); }
    .ff-btn-primary { background: #4361ee; color: white; }
    .ff-btn-primary:hover { background: #3a56d4; }
    .ff-btn-secondary { background: #f0f0f0; color: #333; }
    .ff-btn-secondary:hover { background: #e0e0e0; }
    .ff-btn-danger { background: #c62828; color: white; }
    
    /* Prompt specific styles */
    .ff-prompt-input { width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; margin-top: 16px; font-size: 14px; }
    .ff-prompt-input:focus { outline: none; border-color: #4361ee; box-shadow: 0 0 0 3px rgba(67, 97, 238, 0.1); }
    .ff-btn-block { width: 100%; margin-bottom: 8px; justify-content: center; display: flex; }
  `;

  function createHost() {
    hide();
    overlayHost = document.createElement('div');
    overlayHost.className = 'ff-overlay-host';
    const shadow = overlayHost.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = SHADOW_CSS;
    shadow.appendChild(style);
    document.body.appendChild(overlayHost);
    return shadow;
  }

  function hide() {
    if (overlayHost && overlayHost.parentNode) {
      overlayHost.parentNode.removeChild(overlayHost);
    }
    overlayHost = null;
  }

  function formatPersonLabel(person) {
    if (person === 'self') return 'Applicant Information';
    if (person === 'coApplicant') return 'Co-Applicant Information';
    if (person === 'parentGuardian') return 'Parent / Guardian Information';
    if (person === 'emergencyContact') return 'Emergency Contact Information';
    return 'Unknown Information';
  }

  /**
   * Show grouped fields for final review before filling.
   * @param {Array} resolvedFields [{fieldId, label, value, person}]
   */
  function showGrouped(resolvedFields) {
    return new Promise((resolve) => {
      const shadow = createHost();
      const card = document.createElement('div');
      card.className = 'ff-review-card';

      // Group fields
      const groups = {};
      resolvedFields.forEach(f => {
        if (!groups[f.person]) groups[f.person] = [];
        groups[f.person].push(f);
      });

      card.innerHTML = `
        <div class="ff-header">
          <h2><span class="ff-logo">🤝</span> FormFriend</h2>
          <div class="ff-subtitle">Review the information below before filling the form.</div>
        </div>
      `;

      const list = document.createElement('div');
      list.className = 'ff-body-scroll';

      for (const [person, fields] of Object.entries(groups)) {
        const title = document.createElement('div');
        title.className = 'ff-section-title';
        title.textContent = formatPersonLabel(person);
        list.appendChild(title);

        fields.forEach(f => {
          const item = document.createElement('div');
          item.className = 'ff-field-item';
          const hasValue = f.value !== undefined && f.value !== '';
          
          item.innerHTML = `
            <div class="ff-field-icon ${hasValue ? 'ok' : 'warn'}">${hasValue ? '✓' : '⚠'}</div>
            <div class="ff-field-body">
              <div class="ff-field-label">${f.label}</div>
              <div class="ff-field-value ${!hasValue ? 'needs-review' : ''}">${hasValue ? f.value : 'Information needed'}</div>
            </div>
          `;
          list.appendChild(item);
        });
      }
      card.appendChild(list);

      const actions = document.createElement('div');
      actions.className = 'ff-actions';
      
      const btnCancel = document.createElement('button');
      btnCancel.className = 'ff-btn ff-btn-secondary';
      btnCancel.textContent = 'Cancel';
      btnCancel.onclick = () => { hide(); resolve('cancel'); };
      
      const btnFill = document.createElement('button');
      btnFill.className = 'ff-btn ff-btn-primary';
      btnFill.textContent = 'Fill Safe Fields';
      btnFill.onclick = () => { hide(); resolve('fill'); };

      actions.appendChild(btnCancel);
      actions.appendChild(btnFill);
      card.appendChild(actions);
      shadow.appendChild(card);
    });
  }

  /**
   * Ask user for a missing field value.
   * @param {string} fieldLabel 
   * @param {string} personContextName 
   * @param {boolean} useOnceOnly If true, don't show "Save to Profile"
   */
  function showMissingInfoPrompt(fieldLabel, personContextName, useOnceOnly = false) {
    return new Promise((resolve) => {
      const shadow = createHost();
      const card = document.createElement('div');
      card.className = 'ff-review-card';

      card.innerHTML = `
        <div class="ff-header">
          <h2><span class="ff-logo">🤝</span> Missing Information</h2>
          <div class="ff-subtitle">FormFriend doesn't have the <b>${fieldLabel}</b> for ${personContextName} yet.</div>
        </div>
        <div class="ff-body-scroll">
          <input type="text" id="prompt-input" class="ff-prompt-input" placeholder="Enter ${fieldLabel}...">
        </div>
        <div class="ff-actions" style="flex-direction: column; gap: 8px;">
          ${!useOnceOnly ? `<button id="btn-save" class="ff-btn ff-btn-primary ff-btn-block">Save to Profile</button>` : ''}
          <button id="btn-use-once" class="ff-btn ${useOnceOnly ? 'ff-btn-primary' : 'ff-btn-secondary'} ff-btn-block">Use Once</button>
          <button id="btn-skip" class="ff-btn ff-btn-secondary ff-btn-block" style="background: transparent;">Skip this field</button>
        </div>
      `;
      shadow.appendChild(card);

      const input = shadow.getElementById('prompt-input');
      input.focus();

      if (!useOnceOnly) {
        shadow.getElementById('btn-save').onclick = () => {
          hide(); resolve({ action: 'save', value: input.value.trim() });
        };
      }
      shadow.getElementById('btn-use-once').onclick = () => {
        hide(); resolve({ action: 'use_once', value: input.value.trim() });
      };
      shadow.getElementById('btn-skip').onclick = () => {
        hide(); resolve({ action: 'skip', value: '' });
      };
    });
  }

  /**
   * Ask user to clarify who a field belongs to.
   * @param {string} fieldLabel 
   * @param {string} contextText 
   */
  function showUnknownPersonPrompt(fieldLabel, contextText) {
    return new Promise((resolve) => {
      const shadow = createHost();
      const card = document.createElement('div');
      card.className = 'ff-review-card';

      card.innerHTML = `
        <div class="ff-header">
          <h2><span class="ff-logo">⚠️</span> Unsure Information</h2>
          <div class="ff-subtitle">FormFriend is unsure who this information belongs to based on the form context.</div>
        </div>
        <div class="ff-body-scroll">
          <div style="background: #f8f9fa; padding: 12px; border-radius: 8px; margin-bottom: 12px; font-size: 13px;">
            <b>Field:</b> ${fieldLabel}
          </div>
          <p style="font-size: 13px; color: #555;">Who does this belong to?</p>
        </div>
        <div class="ff-actions" style="flex-direction: column; gap: 8px;">
          <button id="btn-self" class="ff-btn ff-btn-primary ff-btn-block">My Information (Applicant)</button>
          <button id="btn-other" class="ff-btn ff-btn-secondary ff-btn-block">Someone Else's Information</button>
          <button id="btn-skip" class="ff-btn ff-btn-secondary ff-btn-block" style="background: transparent;">Skip</button>
        </div>
      `;
      shadow.appendChild(card);

      shadow.getElementById('btn-self').onclick = () => { hide(); resolve('self'); };
      shadow.getElementById('btn-other').onclick = () => { hide(); resolve('other'); };
      shadow.getElementById('btn-skip').onclick = () => { hide(); resolve('skip'); };
    });
  }

  // Legacy fallback
  function show(mapping, profile) {
    // Convert mapping + profile to grouped format
    const fields = mapping.map(m => ({
      fieldId: m.fieldId,
      label: m.profileField,
      value: profile[m.profileField],
      person: m.person || 'self'
    }));
    return showGrouped(fields);
  }

  return { show, showGrouped, showMissingInfoPrompt, showUnknownPersonPrompt, hide };
})();
