/**
 * FormFriend — Mismatch Warning UI
 *
 * Displays a warning overlay when the mismatch detector finds
 * discrepancies between form values and the user's local profile.
 *
 * Shows side-by-side comparison of expected (profile) vs actual (form) values,
 * with severity indicators.
 */

// eslint-disable-next-line no-var
var FormFriendMismatchUI = (function () {
  'use strict';

  let overlayHost = null;

  const SHADOW_CSS = `
    * { box-sizing: border-box; margin: 0; padding: 0; }

    .ff-mismatch-card {
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      width: 460px;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #1a1a2e;
      animation: ff-slideIn 0.25s ease-out;
    }

    @keyframes ff-slideIn {
      from { opacity: 0; transform: translateY(-20px) scale(0.96); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }

    .ff-mismatch-header {
      padding: 20px 24px 16px;
      border-bottom: 1px solid #fce4ec;
      background: #fff8f8;
    }

    .ff-mismatch-header h2 {
      font-size: 18px;
      font-weight: 700;
      color: #c62828;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .ff-mismatch-header .ff-subtitle {
      font-size: 13px;
      color: #666;
      margin-top: 4px;
    }

    .ff-mismatch-list {
      flex: 1;
      overflow-y: auto;
      padding: 12px 24px;
    }

    .ff-mismatch-item {
      padding: 14px 0;
      border-bottom: 1px solid #f0f0f0;
    }

    .ff-mismatch-item:last-child {
      border-bottom: none;
    }

    .ff-mismatch-field-name {
      font-size: 13px;
      font-weight: 700;
      color: #333;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .ff-severity-badge {
      font-size: 10px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .ff-severity-high {
      background: #fce4ec;
      color: #c62828;
    }

    .ff-severity-medium {
      background: #fff3e0;
      color: #ef6c00;
    }

    .ff-severity-low {
      background: #e8f5e9;
      color: #2e7d32;
    }

    .ff-comparison {
      display: grid;
      grid-template-columns: 80px 1fr;
      gap: 4px 12px;
      font-size: 13px;
    }

    .ff-comparison-label {
      color: #888;
      font-weight: 500;
    }

    .ff-comparison-value {
      color: #1a1a2e;
      word-break: break-word;
    }

    .ff-comparison-value.form-value {
      color: #c62828;
      text-decoration: line-through;
      opacity: 0.8;
    }

    .ff-comparison-value.profile-value {
      color: #2e7d32;
      font-weight: 600;
    }

    .ff-mismatch-detail {
      font-size: 11px;
      color: #999;
      margin-top: 6px;
      font-style: italic;
    }

    .ff-actions {
      padding: 16px 24px;
      border-top: 1px solid #eee;
      display: flex;
      gap: 12px;
      justify-content: flex-end;
    }

    .ff-btn {
      padding: 10px 24px;
      border-radius: 8px;
      border: none;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .ff-btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }

    .ff-btn-primary {
      background: #4361ee;
      color: white;
    }

    .ff-btn-primary:hover {
      background: #3a56d4;
    }

    .ff-btn-secondary {
      background: #f0f0f0;
      color: #333;
    }

    .ff-btn-secondary:hover {
      background: #e0e0e0;
    }

    .ff-btn-danger {
      background: #c62828;
      color: white;
    }

    .ff-btn-danger:hover {
      background: #b71c1c;
    }
  `;

  /**
   * Format a profile field key into a human-readable label.
   */
  function formatLabel(key) {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, c => c.toUpperCase())
      .trim();
  }

  /**
   * Map mismatch type to a human-friendly label.
   */
  function typeLabel(type) {
    switch (type) {
      case 'possible_typo': return 'Possible Typo';
      case 'mismatch': return 'Mismatch';
      case 'unknown': return 'Needs Review';
      default: return type;
    }
  }

  /**
   * Show the mismatch warning overlay.
   *
   * @param {Array} mismatches  Output of FormFriendMismatchDetector.getWarnings()
   * @returns {Promise<'dismiss'|'review'>}
   */
  function show(mismatches) {
    return new Promise((resolve) => {
      hide();

      overlayHost = document.createElement('div');
      overlayHost.className = 'ff-overlay-host';
      overlayHost.id = 'ff-mismatch-overlay';

      const shadow = overlayHost.attachShadow({ mode: 'closed' });

      const style = document.createElement('style');
      style.textContent = SHADOW_CSS;
      shadow.appendChild(style);

      const card = document.createElement('div');
      card.className = 'ff-mismatch-card';

      // Header
      const header = document.createElement('div');
      header.className = 'ff-mismatch-header';
      header.innerHTML = `
        <h2>⚠️ ${mismatches.length} Profile Mismatch${mismatches.length !== 1 ? 'es' : ''} Detected</h2>
        <div class="ff-subtitle">The form contains values different from your stored profile</div>
      `;
      card.appendChild(header);

      // Mismatch list
      const list = document.createElement('div');
      list.className = 'ff-mismatch-list';

      for (const m of mismatches) {
        const item = document.createElement('div');
        item.className = 'ff-mismatch-item';

        // Field name + severity badge
        const fieldName = document.createElement('div');
        fieldName.className = 'ff-mismatch-field-name';

        const nameText = document.createElement('span');
        nameText.textContent = formatLabel(m.profileField);
        fieldName.appendChild(nameText);

        const badge = document.createElement('span');
        badge.className = `ff-severity-badge ff-severity-${m.severity}`;
        badge.textContent = typeLabel(m.type);
        fieldName.appendChild(badge);

        item.appendChild(fieldName);

        // Side-by-side comparison
        const comparison = document.createElement('div');
        comparison.className = 'ff-comparison';

        comparison.innerHTML = `
          <span class="ff-comparison-label">Form:</span>
          <span class="ff-comparison-value form-value">${escapeHtml(m.actual)}</span>
          <span class="ff-comparison-label">Profile:</span>
          <span class="ff-comparison-value profile-value">${escapeHtml(m.expected)}</span>
        `;
        item.appendChild(comparison);

        // Detail
        if (m.details) {
          const detail = document.createElement('div');
          detail.className = 'ff-mismatch-detail';
          detail.textContent = m.details;
          item.appendChild(detail);
        }

        list.appendChild(item);
      }

      card.appendChild(list);

      // Actions
      const actions = document.createElement('div');
      actions.className = 'ff-actions';

      const dismissBtn = document.createElement('button');
      dismissBtn.className = 'ff-btn ff-btn-secondary';
      dismissBtn.textContent = 'Dismiss';
      dismissBtn.addEventListener('click', () => {
        hide();
        resolve('dismiss');
      });

      const reviewBtn = document.createElement('button');
      reviewBtn.className = 'ff-btn ff-btn-danger';
      reviewBtn.textContent = 'Review Fields';
      reviewBtn.addEventListener('click', () => {
        hide();
        resolve('review');
      });

      actions.appendChild(dismissBtn);
      actions.appendChild(reviewBtn);
      card.appendChild(actions);

      shadow.appendChild(card);

      overlayHost.addEventListener('click', (e) => {
        if (e.target === overlayHost) {
          hide();
          resolve('dismiss');
        }
      });

      const escHandler = (e) => {
        if (e.key === 'Escape') {
          document.removeEventListener('keydown', escHandler);
          hide();
          resolve('dismiss');
        }
      };
      document.addEventListener('keydown', escHandler);

      document.body.appendChild(overlayHost);
    });
  }

  /**
   * Hide and remove the mismatch overlay.
   */
  function hide() {
    if (overlayHost && overlayHost.parentNode) {
      overlayHost.parentNode.removeChild(overlayHost);
    }
    overlayHost = null;
  }

  /**
   * Escape HTML to prevent XSS when displaying form values.
   */
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  return { show, hide };
})();
