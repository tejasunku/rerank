/**
 * Rerank Everything - Content Script
 * This runs on every YouTube page and is the main entry point.
 *
 * The pipeline:
 * 1. SCRAPE  - Find all video cards on the page, extract their data
 * 2. FILTER  - Remove videos that match our block rules
 * 3. RERANK  - Score the remaining videos and reorder them
 * 4. RENDER  - Update the page to reflect our new feed order
 */

console.log("[Rerank Everything] Extension loaded on YouTube");

// ============================================================
// STEP 1: SCRAPER
// TODO: Scraper Team implements this
// Find all video recommendation cards on the YouTube homepage
// and extract: title, channel name, description, thumbnail URL
// ============================================================

function scrapeVideoCards() {
  // TODO: Query the DOM for YouTube video cards
  // Hint: YouTube uses <ytd-rich-item-renderer> for homepage videos
  //       Each card contains a #video-title, #channel-name, etc.

  const cards = [];

  // Example of what a scraped card object should look like:
  // {
  //   element: <the DOM element>,
  //   title: "Video Title Here",
  //   channel: "Channel Name",
  //   description: "...",
  //   thumbnailUrl: "https://...",
  // }

  return cards;
}

// ============================================================
// STEP 2: FILTER
// TODO: Filter/Rerank Team implements this
// Given a list of scraped cards, decide which ones to HIDE
// ============================================================

// These are the default filter rules - students should customize these!
const BLOCK_RULES = {
  // Channels to always hide
  blockedChannels: [
    // "ChannelNameHere",
  ],

  // If a title contains any of these keywords, hide it
  blockedKeywords: [
    // "prank",
    // "drama",
    // "react",
  ],
};

function filterCards(cards) {
  // TODO: Loop through cards and mark each as visible or hidden
  // based on the BLOCK_RULES above

  return cards;
}

// ============================================================
// STEP 3: RERANKER
// TODO: Filter/Rerank Team implements this
// Score the remaining visible videos and sort by score
// ============================================================

const BOOST_RULES = {
  // Keywords in titles that should get boosted to the top
  boostedKeywords: [
    // "tutorial",
    // "explained",
    // "how to",
  ],

  // Channels whose content should always rank higher
  boostedChannels: [
    // "3Blue1Brown",
    // "Fireship",
  ],
};

function rerankCards(cards) {
  // TODO: Assign a score to each card based on BOOST_RULES
  // Sort by score descending (best content first)

  return cards;
}

// ============================================================
// STEP 4: RENDER
// TODO: Extension/UI Team implements this
// Apply the filter and rerank results to the actual page
// ============================================================

function applyChanges(cards) {
  // TODO: For each card:
  //   - If filtered out: hide the DOM element (display: none or add a CSS class)
  //   - If kept: reorder elements in the DOM based on score

  // Hint: You can reorder DOM elements by appending them to their
  // parent in the desired order:
  //   parent.appendChild(child) moves the child to the end
}

// ============================================================
// MAIN: Wire it all together
// ============================================================

function runPipeline() {
  console.log("[Rerank Everything] Running pipeline...");

  const cards = scrapeVideoCards();
  console.log(`[Rerank Everything] Found ${cards.length} video cards`);

  const filtered = filterCards(cards);
  const reranked = rerankCards(filtered);
  applyChanges(reranked);

  console.log("[Rerank Everything] Feed updated!");
}

// YouTube is a Single Page App - the page doesn't fully reload
// when you navigate. We need to re-run our pipeline when the
// page content changes.
//
// MutationObserver watches for DOM changes and re-triggers our pipeline.

let debounceTimer = null;

const observer = new MutationObserver(() => {
  // Debounce: wait for YouTube to finish loading before we act
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(runPipeline, 1000);
});

// Start observing once the page is ready
observer.observe(document.body, {
  childList: true,
  subtree: true,
});

// Also run once immediately
runPipeline();
