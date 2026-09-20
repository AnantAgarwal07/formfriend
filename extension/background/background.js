/**
 * FormFriend — Background Service Worker (Manifest V3)
 *
 * Handles message passing between popup and content scripts.
 * Manages extension-wide state coordination.
 */

// ---------------------------------------------------------------------------
// Extension state (lives in the service worker; survives across popup opens)
// ---------------------------------------------------------------------------
const extensionState = {
  // Per-tab state: tabId → { status, mapping, mismatches }
  tabs: {}
};

function getTabState(tabId) {
  if (!extensionState.tabs[tabId]) {
    extensionState.tabs[tabId] = {
      status: 'idle', // idle | scanning | mapped | reviewing | filled | mismatch
      mapping: null,
      mismatches: null,
      fieldCount: 0
    };
  }
  return extensionState.tabs[tabId];
}

// ---------------------------------------------------------------------------
// Message router
// ---------------------------------------------------------------------------
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = sender.tab ? sender.tab.id : message.tabId;

  switch (message.type) {

    // --- Content script → Background: status updates -----------------------
    case 'FORM_DETECTED': {
      const state = getTabState(tabId);
      state.status = 'scanning';
      sendResponse({ ok: true });
      break;
    }

    case 'MAPPING_READY': {
      const state = getTabState(tabId);
      state.status = 'mapped';
      state.mapping = message.mapping;
      state.fieldCount = message.mapping ? message.mapping.length : 0;
      sendResponse({ ok: true });
      break;
    }

    case 'FILL_COMPLETE': {
      const state = getTabState(tabId);
      state.status = 'filled';
      sendResponse({ ok: true });
      break;
    }

    case 'MISMATCHES_FOUND': {
      const state = getTabState(tabId);
      state.status = 'mismatch';
      state.mismatches = message.mismatches;
      sendResponse({ ok: true });
      break;
    }

    // --- Content script -> Background: L1 Semantic Cache & API ------------
    case 'RESOLVE_FIELD': {
      // 1. Hash the field metadata to create a cache key
      const rawKey = [message.field.label, message.field.name, message.field.section].join('|');
      
      // We will do a simple hash for local cache
      crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawKey)).then(hashBuffer => {
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        const cacheKey = `L1_CACHE_${hashHex}`;

        // 2. Check chrome.storage.local
        chrome.storage.local.get(cacheKey, async (result) => {
          if (result[cacheKey]) {
            console.log('[FormFriend][L1 Cache] HIT for field:', message.field.label);
            sendResponse({ source: 'L1', mapping: result[cacheKey] });
          } else {
            console.log('[FormFriend][L1 Cache] MISS for field, calling Backend...', message.field.label);
            // 3. Fallback to API (which hits L2/Dynamo)
            try {
              // Ensure FormFriendAPI is accessible in background (needs importScripts in manifest)
              // If not, this logic can just use fetch directly or rely on api.js being loaded
              const apiResponse = await fetch(`https://wp79o986m5.execute-api.ap-south-1.amazonaws.com/intelligence/resolve`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${message.token || ''}`
                },
                body: JSON.stringify({ formFingerprint: 'auto-fingerprint', field: message.field })
              });
              
              if (apiResponse.ok) {
                const data = await apiResponse.json();
                if (data.status === 'resolved') {
                  // 4. Save to L1 Cache
                  chrome.storage.local.set({ [cacheKey]: data });
                }
                sendResponse({ source: 'L2', mapping: data });
              } else {
                sendResponse({ source: 'error', error: 'Backend failed' });
              }
            } catch (err) {
              sendResponse({ source: 'error', error: err.message });
            }
          }
        });
      });
      return true; // Keep message channel open for async response
    }

    // --- Popup → Background: queries --------------------------------------
    case 'GET_TAB_STATE': {
      if (!tabId) {
        // Popup doesn't know tabId; query the active tab
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]) {
            sendResponse(getTabState(tabs[0].id));
          } else {
            sendResponse({ status: 'idle' });
          }
        });
        return true; // async sendResponse
      }
      sendResponse(getTabState(tabId));
      break;
    }

    // --- Popup → Content script: relay commands ----------------------------
    case 'START_SCAN':
    case 'START_FILL':
    case 'START_REVIEW':
    case 'CHECK_MISMATCHES': {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, message, (response) => {
            if (chrome.runtime.lastError) {
              console.warn('[FormFriend] Error communicating with content script:', chrome.runtime.lastError.message);
              sendResponse({ ok: false, error: 'Could not connect to page. Please refresh the page and try again.' });
              return;
            }
            sendResponse(response || { ok: false, error: 'No response from page' });
          });
        } else {
          sendResponse({ ok: false, error: 'No active tab' });
        }
      });
      return true; // async sendResponse
    }

    // --- Reset state -------------------------------------------------------
    case 'RESET_STATE': {
      if (tabId) {
        delete extensionState.tabs[tabId];
      }
      sendResponse({ ok: true });
      break;
    }

    default:
      sendResponse({ ok: false, error: `Unknown message type: ${message.type}` });
  }
});

// Clean up when a tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  delete extensionState.tabs[tabId];
});

// Clean up when a tab navigates to a new page
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    delete extensionState.tabs[tabId];
  }
});

console.log('[FormFriend] Background service worker loaded.');
