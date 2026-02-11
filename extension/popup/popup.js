/**
 * Rerank Everything - Popup Script
 * Handles the extension popup UI: toggle on/off and display stats
 */

document.addEventListener("DOMContentLoaded", () => {
  const enabledToggle = document.getElementById("enabled");
  const hiddenCountEl = document.getElementById("hidden-count");
  const boostedCountEl = document.getElementById("boosted-count");

  // Load saved state and stats from storage
  chrome.storage.local.get(
    ["enabled", "hiddenCount", "boostedCount"],
    (result) => {
      enabledToggle.checked = result.enabled !== false; // default: on
      hiddenCountEl.textContent = result.hiddenCount || 0;
      boostedCountEl.textContent = result.boostedCount || 0;
    }
  );

  // Save state when the toggle is clicked
  enabledToggle.addEventListener("change", () => {
    chrome.storage.local.set({ enabled: enabledToggle.checked });
  });
});
