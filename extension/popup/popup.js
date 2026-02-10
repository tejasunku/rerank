/**
 * Rerank Everything - Popup Script
 * Handles the extension popup UI
 */

// TODO: Extension/UI Team
// - Load stats from chrome.storage
// - Toggle extension on/off
// - (Stretch) Save/load filter settings

document.addEventListener("DOMContentLoaded", () => {
  const enabledToggle = document.getElementById("enabled");

  // Load saved state
  chrome.storage.local.get(["enabled"], (result) => {
    enabledToggle.checked = result.enabled !== false; // default to on
  });

  // Save state on toggle
  enabledToggle.addEventListener("change", () => {
    chrome.storage.local.set({ enabled: enabledToggle.checked });
  });
});
