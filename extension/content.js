/**
 * Rerank Everything - Content Script
 * This runs on every YouTube page and is the main entry point.
 *
 * The pipeline:
 * 1. SCRAPE  - Find all video cards on the page, extract DOM elements and data
 * 2. FILTER  - Remove videos that match our block rules
 * 3. RERANK  - Score the remaining videos and reorder them
 * 4. RENDER  - Update the page to reflect our new feed order
 */

// ============================================================
// CONFIG
// ============================================================

const DEBUG = false;
const MAX_CARDS = 25;

// Logging helper - only logs when DEBUG is true
function log(...args) {
  if (DEBUG) console.log("[Rerank Everything]", ...args);
}

// State tracking
let isProcessing = false;
let processedVideoIds = new Set();

console.log("[Rerank] Ready. DEBUG=" + DEBUG);

// ============================================================
// SELECTORS - Based on DeArrow's comprehensive YouTube DOM knowledge
// These handle desktop, mobile, and various YouTube layouts
// ============================================================

const VIDEO_CARD_SELECTORS = [
  "ytd-rich-item-renderer",
  "ytd-video-renderer",
  "ytd-compact-video-renderer",
  "ytd-grid-video-renderer",
  "ytd-playlist-video-renderer",
  "ytd-compact-playlist-renderer",
  "ytd-rich-grid-media",
  "ytd-movie-renderer",
  "ytd-compact-movie-renderer",
  "ytd-grid-movie-renderer",
  "ytd-radio-renderer",
  "ytd-compact-radio-renderer",
  "ytd-playlist-renderer",
  "ytd-grid-playlist-renderer",
  "ytd-reel-item-renderer",
  "ytd-structured-description-video-lockup-renderer",
  "yt-lockup-view-model"
].join(", ");

const THUMBNAIL_SELECTORS = [
  "ytd-thumbnail:not([hidden]) img",
  "ytd-playlist-thumbnail yt-image:not(.blurred-image) img",
  "yt-img-shadow.ytd-hero-playlist-thumbnail-renderer img",
  "yt-thumbnail-view-model *:not(.ytThumbnailViewModelBlurredImage) img",
  ".ux-thumb-wrap img",
  "yt-img-shadow img",
  "img.video-thumbnail-img"
];

const TITLE_SELECTORS = [
  "#video-title",
  "#movie-title",
  "#description #title",
  ".yt-lockup-metadata-view-model-wiz__title .yt-core-attributed-string",
  ".yt-lockup-metadata-view-model__title .yt-core-attributed-string",
  ".ShortsLockupViewModelHostMetadataTitle .yt-core-attributed-string",
  ".title",
  ".yt-uix-tile-link",
  ".lohp-video-link"
];

const CHANNEL_SELECTORS = [
  "ytd-channel-name #text",
  "ytd-channel-name yt-formatted-string",
  "#channel-name #text",
  "#channel-name yt-formatted-string",
  ".channel-name",
  ".yt-channel-title",
  "ytd-video-meta-block ytd-channel-name a",
  "yt-formatted-string.ytd-channel-name"
];

// ============================================================
// EXTRACTION FUNCTIONS
// ============================================================

function extractThumbnailImg(cardElement) {
  for (const selector of THUMBNAIL_SELECTORS) {
    const img = cardElement.querySelector(selector);
    if (img && img.src) return img;
  }
  return null;
}

function extractThumbnailContainer(cardElement) {
  const containerSelectors = [
    "ytd-thumbnail",
    "ytd-playlist-thumbnail",
    "yt-thumbnail-view-model",
    ".ux-thumb-wrap",
    ".thumbnail-container"
  ];
  
  for (const selector of containerSelectors) {
    const container = cardElement.querySelector(selector);
    if (container) return container;
  }
  return null;
}

function extractTitleEl(cardElement) {
  for (const selector of TITLE_SELECTORS) {
    const el = cardElement.querySelector(selector);
    if (el && el.textContent) return el;
  }
  return null;
}

function extractChannelName(cardElement) {
  for (const selector of CHANNEL_SELECTORS) {
    const el = cardElement.querySelector(selector);
    if (el && el.textContent) {
      return el.textContent.trim();
    }
  }
  return null;
}

function extractChannelLogo(cardElement) {
  const logoSelectors = [
    "ytd-channel-avatar img",
    "yt-img-shadow.channel-avatar img",
    "ytd-channel-name img",
    "#channel-thumbnail img",
    "a.yt-simple-endpoint img",
    ".channel-avatar img"
  ];
  
  for (const selector of logoSelectors) {
    const img = cardElement.querySelector(selector);
    if (img && img.src) return img;
  }
  return null;
}

function extractVideoLink(cardElement) {
  const linkSelectors = [
    "a#thumbnail",
    "a#video-title",
    "a[href*='watch?v=']",
    "a[href*='shorts/']",
    "a.yt-uix-tile-link",
    "a.yt-simple-endpoint"
  ];
  
  for (const selector of linkSelectors) {
    const link = cardElement.querySelector(selector);
    if (link && link.href) return link;
  }
  return null;
}

function extractVideoId(linkEl) {
  if (!linkEl || !linkEl.href) return null;
  
  const url = linkEl.href;
  const watchMatch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (watchMatch) return watchMatch[1];
  
  const shortsMatch = url.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
  if (shortsMatch) return shortsMatch[1];
  
  return null;
}

function extractViewCount(cardElement) {
  const metadataSelectors = [
    "ytd-video-meta-block #metadata-line",
    "#metadata-line",
    ".metadata-line",
    "ytd-grid-video-renderer #metadata-line"
  ];
  
  for (const selector of metadataSelectors) {
    const el = cardElement.querySelector(selector);
    if (el) {
      const text = el.textContent;
      const viewMatch = text.match(/(\d[\d,.]*\s*(views?|views))/i);
      if (viewMatch) return viewMatch[0];
    }
  }
  return null;
}

// ============================================================
// SCRAPE VIDEO DATA
// Find all video cards and extract their DOM elements and data
// Deduplicates by videoId and limits to MAX_CARDS
// ============================================================

function scrapeVideoData() {
  const seenVideoIds = new Set();
  const cards = [];
  let duplicatesSkipped = 0;
  const videoElements = document.querySelectorAll(VIDEO_CARD_SELECTORS);

  videoElements.forEach((element) => {
    if (cards.length >= MAX_CARDS) return;
    
    const titleEl = extractTitleEl(element);
    if (!titleEl) return;
    
    const thumbnailImg = extractThumbnailImg(element);
    const thumbnailContainer = extractThumbnailContainer(element);
    const channelName = extractChannelName(element);
    const channelLogo = extractChannelLogo(element);
    const linkEl = extractVideoLink(element);
    const videoId = extractVideoId(linkEl);
    const viewCount = extractViewCount(element);

    if (videoId && seenVideoIds.has(videoId)) {
      duplicatesSkipped++;
      return;
    }
    if (videoId) {
      seenVideoIds.add(videoId);
    }

    cards.push({
      dom: {
        card: element,
        thumbnailImg: thumbnailImg,
        thumbnailContainer: thumbnailContainer,
        titleEl: titleEl,
        channelLogo: channelLogo,
        linkEl: linkEl
      },
      data: {
        title: (titleEl.textContent || "").trim(),
        channelName: channelName || "",
        thumbnailSrc: thumbnailImg?.src || null,
        channelLogoSrc: channelLogo?.src || null,
        videoId: videoId,
        viewCount: viewCount
      },
      visible: true,
      score: 0,
      originalIndex: cards.length
    });
  });

  log("Duplicates skipped:", duplicatesSkipped);
  log("Unique cards extracted:", cards.length, "(max:", MAX_CARDS + ")");

  return cards;
}

// ============================================================
// FIND CONTAINER
// YouTube uses different container layouts for different pages
// ============================================================

function findContainer(card) {
  let container = card.dom.card.parentElement;
  
  while (container) {
    const tagName = container.tagName.toLowerCase();
    
    if (
      tagName === "ytd-rich-grid-renderer" ||
      tagName === "ytd-item-section-renderer" ||
      tagName === "ytd-section-list-renderer" ||
      tagName === "ytd-watch-next-secondary-results-renderer" ||
      tagName === "ytd-shelf-renderer" ||
      tagName === "ytd-expanded-shelf-contents-renderer" ||
      tagName === "ytd-grid-renderer" ||
      tagName === "ytd-playlist-panel-renderer" ||
      tagName.startsWith("ytd-") && container.getAttribute("role") === "main"
    ) {
      return container;
    }
    
    if (tagName === "body") break;
    container = container.parentElement;
  }
  
  return card.dom.card.parentElement;
}

// ============================================================
// STEP 2: FILTER
// Decide which videos to hide based on block rules
// ============================================================

const BLOCK_RULES = {
  blockedChannels: [],
  blockedKeywords: []
};

function filterCards(cards) {
  return cards.map((card) => {
    const titleLower = card.data.title.toLowerCase();
    const channelLower = card.data.channelName.toLowerCase();

    const channelBlocked = BLOCK_RULES.blockedChannels.some((ch) =>
      channelLower.includes(ch.toLowerCase())
    );

    const keywordBlocked = BLOCK_RULES.blockedKeywords.some((kw) =>
      titleLower.includes(kw.toLowerCase())
    );

    card.visible = !channelBlocked && !keywordBlocked;
    return card;
  });
}

// ============================================================
// STEP 3: RERANKER
// Score videos and sort them (scoring logic to be implemented later)
// ============================================================

const BOOST_RULES = {
  boostedKeywords: [],
  boostedChannels: []
};

function rerankCards(cards) {
  return cards
    .map((card) => {
      if (!card.visible) return card;

      let score = 0;
      const titleLower = card.data.title.toLowerCase();
      const channelLower = card.data.channelName.toLowerCase();

      BOOST_RULES.boostedKeywords.forEach((kw) => {
        if (titleLower.includes(kw.toLowerCase())) {
          score += 10;
        }
      });

      BOOST_RULES.boostedChannels.forEach((ch) => {
        if (channelLower.includes(ch.toLowerCase())) {
          score += 20;
        }
      });

      card.score = score;
      return card;
    })
    .sort((a, b) => {
      if (a.visible !== b.visible) return a.visible ? -1 : 1;
      return b.score - a.score;
    });
}

// ============================================================
// STEP 4: REORDER VIDEOS
// Move DOM nodes to reflect the new order
// ============================================================

function reorderVideos(cards) {
  if (cards.length === 0) return;

  const containerGroups = new Map();
  
  cards.forEach((card) => {
    const container = findContainer(card);
    if (!container) return;
    
    const key = container.tagName + "_" + container.className;
    if (!containerGroups.has(key)) {
      containerGroups.set(key, { container, cards: [] });
    }
    containerGroups.get(key).cards.push(card);
  });

  containerGroups.forEach((group) => {
    const { container, cards: groupCards } = group;
    
    const visibleCards = groupCards.filter((c) => c.visible);
    const hiddenCards = groupCards.filter((c) => !c.visible);

    visibleCards.forEach((card) => {
      card.dom.card.classList.remove("rerank-hidden");
      if (card.score > 0) {
        card.dom.card.classList.add("rerank-boosted");
      } else {
        card.dom.card.classList.remove("rerank-boosted");
      }
    });

    hiddenCards.forEach((card) => {
      card.dom.card.classList.add("rerank-hidden");
      card.dom.card.classList.remove("rerank-boosted");
    });

    visibleCards.forEach((card) => {
      container.appendChild(card.dom.card);
    });

    hiddenCards.forEach((card) => {
      container.appendChild(card.dom.card);
    });
  });

  const hiddenCount = cards.filter((c) => !c.visible).length;
  const boostedCount = cards.filter((c) => c.visible && c.score > 0).length;

  chrome.storage.local.set({
    hiddenCount: hiddenCount,
    boostedCount: boostedCount
  });

  log("Hidden:", hiddenCount, "Boosted:", boostedCount);
}

// ============================================================
// DEBUG HELPER - Print extracted data for inspection
// ============================================================

function debugLogCards(cards) {
  if (!DEBUG) return;
  console.log("[Rerank Everything] Extracted Video Cards:");
  cards.slice(0, 5).forEach((card, i) => {
    console.log("  Card " + i + ":");
    console.log("    Title: " + card.data.title);
    console.log("    Channel: " + card.data.channelName);
    console.log("    Video ID: " + card.data.videoId);
    console.log("    Thumbnail: " + (card.data.thumbnailSrc ? "YES" : "NO"));
    console.log("    Channel Logo: " + (card.data.channelLogoSrc ? "YES" : "NO"));
  });
}

// ============================================================
// MAIN PIPELINE
// ============================================================

function runPipeline() {
  if (isProcessing) return;
  
  chrome.storage.local.get(["enabled"], (result) => {
    if (result.enabled === false) {
      log("Extension is disabled");
      document.documentElement.classList.remove("rerank-active");
      document.querySelectorAll(".rerank-hidden, .rerank-boosted").forEach((el) => {
        el.classList.remove("rerank-hidden", "rerank-boosted");
      });
      processedVideoIds.clear();
      return;
    }

    document.documentElement.classList.add("rerank-active");
    isProcessing = true;

    log("Running pipeline...");

    const videoData = scrapeVideoData();

    if (videoData.length === 0) {
      isProcessing = false;
      return;
    }

    // Check if we have any NEW videos
    let hasNewVideos = false;
    videoData.forEach(card => {
      if (card.data.videoId && !processedVideoIds.has(card.data.videoId)) {
        hasNewVideos = true;
      }
    });

    // If no new videos, skip processing
    if (!hasNewVideos && processedVideoIds.size > 0) {
      log("No new videos, skipping");
      isProcessing = false;
      return;
    }

    // Track all seen video IDs
    videoData.forEach(card => {
      if (card.data.videoId) processedVideoIds.add(card.data.videoId);
    });
    
    debugLogCards(videoData);

    const filtered = filterCards(videoData);
    const reranked = rerankCards(filtered);
    reorderVideos(reranked);

    log("Feed updated! Total unique videos:", processedVideoIds.size);
    isProcessing = false;
  });
}

let debounceTimer = null;

const observer = new MutationObserver(function() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(runPipeline, 1500);
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

runPipeline();

// ============================================================
// TESTING INTERFACE - Uses window.postMessage for communication
// Usage in console:
//   window.postMessage({ type: 'RERANK_TEST', command: 'shuffle' }, '*')
//   window.postMessage({ type: 'RERANK_TEST', command: 'list' }, '*')
// Or paste the helper function below into console first
// ============================================================

window.addEventListener("message", function(event) {
  if (event.source !== window) return;
  if (!event.data || event.data.type !== "RERANK_TEST") return;

  const { command, arg } = event.data;

  switch (command) {
    case "shuffle": {
      isProcessing = true;
      console.log("[Rerank] Shuffling videos...");
      const cards = scrapeVideoData();
      for (let i = cards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [cards[i], cards[j]] = [cards[j], cards[i]];
      }
      cards.forEach((card, i) => { card.score = cards.length - i; });
      reorderVideos(cards);
      console.log("[Rerank] Shuffled " + cards.length + " videos!");
      isProcessing = false;
      break;
    }

    case "reverse": {
      isProcessing = true;
      console.log("[Rerank] Reversing video order...");
      const cards = scrapeVideoData();
      cards.forEach((card, i) => { card.score = cards.length - i; });
      cards.reverse();
      reorderVideos(cards);
      console.log("[Rerank] Reversed " + cards.length + " videos!");
      isProcessing = false;
      break;
    }

    case "boostChannel": {
      isProcessing = true;
      console.log("[Rerank] Boosting channel: " + arg);
      const cards = scrapeVideoData();
      cards.forEach((card) => {
        if (card.data.channelName.toLowerCase().includes(arg.toLowerCase())) {
          card.score = 1000;
          console.log("  Boosted: " + card.data.title + " by " + card.data.channelName);
        } else {
          card.score = 0;
        }
      });
      reorderVideos(cards.filter(c => c.score > 0).concat(cards.filter(c => c.score === 0)));
      isProcessing = false;
      break;
    }

    case "boostKeyword": {
      isProcessing = true;
      console.log("[Rerank] Boosting keyword: " + arg);
      const cards = scrapeVideoData();
      cards.forEach((card) => {
        if (card.data.title.toLowerCase().includes(arg.toLowerCase())) {
          card.score = 1000;
          console.log("  Boosted: " + card.data.title);
        } else {
          card.score = 0;
        }
      });
      reorderVideos(cards.filter(c => c.score > 0).concat(cards.filter(c => c.score === 0)));
      isProcessing = false;
      break;
    }

    case "hideKeyword": {
      isProcessing = true;
      console.log("[Rerank] Hiding keyword: " + arg);
      const cards = scrapeVideoData();
      let hidden = 0;
      cards.forEach((card) => {
        if (card.data.title.toLowerCase().includes(arg.toLowerCase())) {
          card.visible = false;
          hidden++;
        }
      });
      reorderVideos(cards);
      console.log("[Rerank] Hidden " + hidden + " videos");
      isProcessing = false;
      break;
    }

    case "reset": {
      isProcessing = true;
      console.log("[Rerank] Resetting order...");
      const cards = scrapeVideoData();
      cards.sort((a, b) => a.originalIndex - b.originalIndex);
      cards.forEach(c => { c.visible = true; c.score = 0; });
      reorderVideos(cards);
      console.log("[Rerank] Reset " + cards.length + " videos!");
      isProcessing = false;
      break;
    }

    case "list": {
      const cards = scrapeVideoData();
      console.log("[Rerank] Listing " + cards.length + " videos:");
      cards.forEach((card, i) => {
        console.log((i + 1) + ". [" + card.data.videoId + "] " + card.data.title + " - " + card.data.channelName);
      });
      break;
    }

    case "run": {
      processedVideoIds.clear();
      runPipeline();
      console.log("[Rerank] Pipeline re-run");
      break;
    }

    case "status": {
      console.log("[Rerank] Status:");
      console.log("  - Unique videos seen:", processedVideoIds.size);
      console.log("  - MAX_CARDS:", MAX_CARDS);
      console.log("  - DEBUG:", DEBUG);
      console.log("  - Processing:", isProcessing);
      break;
    }

    case "help": {
      console.log(`
[Rerank] Test Commands:
  rt.shuffle()           - Randomly shuffle videos
  rt.reverse()           - Reverse current order
  rt.boostChannel(name)  - Boost videos from a channel
  rt.boostKeyword(word)  - Boost videos with keyword in title
  rt.hideKeyword(word)   - Hide videos with keyword in title
  rt.reset()             - Reset to original order
  rt.list()              - List all videos with IDs
  rt.run()               - Re-run the pipeline
  rt.status()            - Show current status
  rt.help()              - Show this help
`);
      break;
    }

    default:
      console.log("[Rerank] Unknown command: " + command);
  }
});

console.log("[Rerank] Ready. Paste this to get test commands: var rt={shuffle:()=>window.postMessage({type:'RERANK_TEST',command:'shuffle'},'*'),reverse:()=>window.postMessage({type:'RERANK_TEST',command:'reverse'},'*'),boostChannel:a=>window.postMessage({type:'RERANK_TEST',command:'boostChannel',arg:a},'*'),boostKeyword:a=>window.postMessage({type:'RERANK_TEST',command:'boostKeyword',arg:a},'*'),hideKeyword:a=>window.postMessage({type:'RERANK_TEST',command:'hideKeyword',arg:a},'*'),reset:()=>window.postMessage({type:'RERANK_TEST',command:'reset'},'*'),list:()=>window.postMessage({type:'RERANK_TEST',command:'list'},'*'),run:()=>window.postMessage({type:'RERANK_TEST',command:'run'},'*'),status:()=>window.postMessage({type:'RERANK_TEST',command:'status'},'*'),help:()=>window.postMessage({type:'RERANK_TEST',command:'help'},'*')}; rt.help()");