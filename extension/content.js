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
// Find all video recommendation cards on the page and extract
// their data: title, channel name, and a reference to the element
// ============================================================

function scrapeVideoCards() {
  const cards = [];

  // YouTube uses different elements depending on the page:
  //   Homepage:     ytd-rich-item-renderer
  //   Search:       ytd-video-renderer
  //   Sidebar:      ytd-compact-video-renderer
  const videoElements = document.querySelectorAll(
    "ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer"
  );

  videoElements.forEach((element) => {
    const titleEl = element.querySelector("#video-title");
    const channelEl = element.querySelector(
      "ytd-channel-name #text, #channel-name #text, ytd-channel-name yt-formatted-string"
    );

    if (titleEl) {
      cards.push({
        element: element,
        title: (titleEl.textContent || "").trim(),
        channel: channelEl ? (channelEl.textContent || "").trim() : "",
        visible: true,
        score: 0,
      });
    }
  });

  return cards;
}

// ============================================================
// STEP 2: FILTER
// Given a list of scraped cards, decide which ones to HIDE
// based on the block rules below
// ============================================================

// *** CUSTOMIZE THESE! ***
// Add channels and keywords you want to filter out.
// Uncomment the examples or add your own.
const BLOCK_RULES = {
  // Channels to always hide (case-insensitive)
  blockedChannels: [
    // "ChannelNameHere",
  ],

  // If a title contains any of these keywords, hide it (case-insensitive)
  blockedKeywords: [
    // "prank",
    // "drama",
    // "clickbait",
    // "you won't believe",
    // "gone wrong",
  ],
};

function filterCards(cards) {
  return cards.map((card) => {
    const titleLower = card.title.toLowerCase();
    const channelLower = card.channel.toLowerCase();

    // Check if the channel is in the blocked list
    const channelBlocked = BLOCK_RULES.blockedChannels.some((ch) =>
      channelLower.includes(ch.toLowerCase())
    );

    // Check if any blocked keyword appears in the title
    const keywordBlocked = BLOCK_RULES.blockedKeywords.some((kw) =>
      titleLower.includes(kw.toLowerCase())
    );

    card.visible = !channelBlocked && !keywordBlocked;
    return card;
  });
}

// ============================================================
// STEP 3: RERANKER
// Score the remaining visible videos so we know which ones
// are the best. Higher score = better content.
// ============================================================

// *** CUSTOMIZE THESE! ***
// Add keywords and channels you want to see MORE of.
const BOOST_RULES = {
  // Keywords in titles that should get boosted (each match = +10 points)
  boostedKeywords: [
    // "tutorial",
    // "explained",
    // "how to",
    // "deep dive",
  ],

  // Channels whose content should always rank higher (+20 points)
  boostedChannels: [
    // "3Blue1Brown",
    // "Fireship",
  ],
};

function rerankCards(cards) {
  return cards
    .map((card) => {
      if (!card.visible) return card;

      let score = 0;
      const titleLower = card.title.toLowerCase();
      const channelLower = card.channel.toLowerCase();

      // Boost by keyword match in title
      BOOST_RULES.boostedKeywords.forEach((kw) => {
        if (titleLower.includes(kw.toLowerCase())) {
          score += 10;
        }
      });

      // Boost by channel match
      BOOST_RULES.boostedChannels.forEach((ch) => {
        if (channelLower.includes(ch.toLowerCase())) {
          score += 20;
        }
      });

      card.score = score;
      return card;
    })
    .sort((a, b) => {
      // Hidden cards go to the end
      if (a.visible !== b.visible) return a.visible ? -1 : 1;
      // Among visible cards, sort by score (highest first)
      return b.score - a.score;
    });
}

// ============================================================
// STEP 4: RENDER
// Apply the filter and rerank results to the actual page.
// - Filtered videos get hidden with a CSS class
// - Boosted videos get a green outline
// ============================================================

function applyChanges(cards) {
  let hiddenCount = 0;
  let boostedCount = 0;

  cards.forEach((card) => {
    if (!card.visible) {
      // Hide filtered-out videos
      card.element.classList.add("rerank-hidden");
      card.element.classList.remove("rerank-boosted");
      hiddenCount++;
    } else {
      // Show kept videos
      card.element.classList.remove("rerank-hidden");

      // Highlight boosted videos with a green outline
      if (card.score > 0) {
        card.element.classList.add("rerank-boosted");
        boostedCount++;
      } else {
        card.element.classList.remove("rerank-boosted");
      }
    }
  });

  // Save stats so the popup can display them
  chrome.storage.local.set({ hiddenCount, boostedCount });

  console.log(
    `[Rerank Everything] Hidden: ${hiddenCount}, Boosted: ${boostedCount}`
  );
}

// ============================================================
// MAIN: Wire it all together
// ============================================================

function runPipeline() {
  // Check if the extension is enabled (toggle in popup)
  chrome.storage.local.get(["enabled"], (result) => {
    if (result.enabled === false) {
      console.log("[Rerank Everything] Extension is disabled");
      // Remove all our CSS classes when disabled
      document.documentElement.classList.remove("rerank-active");
      document
        .querySelectorAll(".rerank-hidden, .rerank-boosted")
        .forEach((el) => {
          el.classList.remove("rerank-hidden", "rerank-boosted");
        });
      return;
    }

    // Light pink background proves the extension is running
    document.documentElement.classList.add("rerank-active");

    console.log("[Rerank Everything] Running pipeline...");

    const cards = scrapeVideoCards();
    console.log(`[Rerank Everything] Found ${cards.length} video cards`);

    if (cards.length === 0) return;

    const filtered = filterCards(cards);
    const reranked = rerankCards(filtered);
    applyChanges(reranked);

    console.log("[Rerank Everything] Feed updated!");
  });
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
  debounceTimer = setTimeout(runPipeline, 1500);
});

// Start observing once the page is ready
observer.observe(document.body, {
  childList: true,
  subtree: true,
});

// Also run once immediately
runPipeline();
