# Rerank Everything

**Take back control of your YouTube feed.**

A browser extension that scrapes your YouTube recommendations, filters out junk content, and reranks what's left so you see the good stuff first.

Built by The Multiverse School Learn to Code
Week of February 9th 2026 Cohort

## Why?

Social media algorithms optimize for engagement, not for your wellbeing. They push rage bait, slop, and content designed to keep you scrolling - not content that's actually good for you.

Once a page loads in your browser, **you own that data**. This extension reads your YouTube feed, removes the garbage, boosts quality content, and reorders everything so your feed actually works for you.

## How It Works

```
YouTube Feed → Scrape video cards → Filter (remove junk) → Rerank (boost quality) → Your Better Feed
```

## Install (Development)

1. Clone this repo
2. Open Chrome/Edge/Brave and go to `chrome://extensions`
3. Enable **Developer mode** (toggle in top right)
4. Click **Load unpacked**
5. Select the `extension/` folder from this repo
6. Open YouTube - the extension is now running!

## Project Structure

```
extension/
├── manifest.json       # Extension config - tells the browser what to do
├── content.js          # Main script - runs on YouTube pages
├── styles.css          # CSS for hiding/highlighting videos
├── popup/
│   ├── popup.html      # Extension popup UI
│   ├── popup.css       # Popup styles
│   └── popup.js        # Popup logic
└── icons/              # Extension icons (TODO)
```

## Teams

| Team | Owns | Key File |
|------|------|----------|
| Scraper | Extract video data from YouTube DOM | `content.js` - `scrapeVideoCards()` |
| Filter/Rerank | Scoring and filtering logic | `content.js` - `filterCards()`, `rerankCards()` |
| Extension/UI | Extension setup, popup, DOM changes | `manifest.json`, `popup/`, `applyChanges()` |

## Contributing

1. Create a branch for your feature: `git checkout -b my-feature`
2. Make your changes
3. Commit: `git commit -m "Add my feature"`
4. Push: `git push origin my-feature`
5. Open a Pull Request on GitHub

## License

MIT - Use it, share it, remix it.
