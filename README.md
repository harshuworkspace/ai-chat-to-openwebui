# AI Chat → Open WebUI Importer

A Chrome extension that adds a **🚀 Send to Open WebUI** and **⬇ Download JSON** button to Perplexity, ChatGPT, Gemini, and Claude — letting you import any chat directly into your [Open WebUI](https://github.com/open-webui/open-webui) instance.

## Supported Platforms

| Platform | URL |
|---|---|
| Perplexity | `perplexity.ai` |
| ChatGPT | `chatgpt.com` |
| Google Gemini | `gemini.google.com` |
| Claude | `claude.ai` |

## Features

- ✅ Auto-scrolls Perplexity to load all virtualised chat turns (fixes 15–20 message cap)
- ✅ Expands all collapsed “Show More” user messages before scraping
- ✅ Converts HTML responses to clean Markdown
- ✅ Preserves sources/citations from Perplexity
- ✅ Sends directly to Open WebUI via API **or** downloads as JSON
- ✅ Handles extension context loss gracefully (SPA navigation)

## Install

1. Clone or download this repo
   ```
   git clone https://github.com/harshuworkspace/ai-chat-to-openwebui.git
   ```
2. Open Chrome → `chrome://extensions`
3. Enable **Developer Mode** (top right toggle)
4. Click **Load unpacked** → select the `ai-chat-to-openwebui` folder
5. Click the extension icon and go to **⚙️ Settings**
6. Enter your Open WebUI URL (e.g. `http://192.168.1.10:3000`) and API token

## Getting your Open WebUI API Token

Open WebUI → Profile (top right) → **Settings** → **Account** → **API Key** → Copy

## Usage

1. Open any chat on Perplexity / ChatGPT / Gemini / Claude
2. Two buttons appear at the **bottom-right** of the page
   - **🚀 Send to Open WebUI** — imports directly into your Open WebUI
   - **⬇ Download JSON** — saves the chat as a JSON file you can import manually
3. For Perplexity: the scraper will auto-scroll the page (~5 seconds) to load all messages before exporting

## Files

| File | Purpose |
|---|---|
| `manifest.json` | Extension manifest (v3) |
| `content.js` | Page scraper + floating buttons |
| `background.js` | API relay (bypasses CORS) |
| `popup.html` | Settings popup UI |
| `popup.js` | Settings popup logic |

## Changelog

### v2.1
- Added `scrollToLoadAll()` — fixes Perplexity virtual DOM truncation (was capping at ~15–20 msgs)
- Added `expandAllShowMore()` — fixes truncated user messages showing “Show More” text
- Added ChatGPT, Gemini, Claude scrapers
- Added `chrome.storage.sync` guard + `try/catch` for SPA context loss

### v2.0
- Multi-platform support

### v1.0
- Perplexity-only
