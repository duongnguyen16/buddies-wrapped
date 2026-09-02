# Buddies Wrapped

**English** | [Tiếng Việt](README.vi.md)

[![Website](https://img.shields.io/badge/Website-buddieswrapped.duongnx.tech-D97757?style=flat-square)](https://buddieswrapped.duongnx.tech)
[![npm version](https://img.shields.io/npm/v/buddies-wrapped.svg?style=flat-square&color=D97757)](https://www.npmjs.com/package/buddies-wrapped)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

> [!CAUTION]
> **All data is analyzed locally on your own device.** Your chat archives contain sensitive conversations and personal memories. Beware of unverified mirrors and scam repositories.
>
> - **100% Client-Side Processing:** In this official repository and on [buddieswrapped.duongnx.tech](https://buddieswrapped.duongnx.tech), all messages are processed strictly inside your device's memory (via in-browser JSZip or local Node CLI). Zero data, zero contacts, and zero messages are ever sent to any remote server or external API. You can verify this by inspecting the browser Network tab (F12) or auditing the open-source code.
> - **Caution on Untrusted Clones:** Never upload your `messages.zip` or run scripts from unverified forks, copies, or third-party websites.

---

## How to Export Your Chat Data from Facebook

1. Open [https://www.facebook.com/secure_storage/dyi](https://www.facebook.com/secure_storage/dyi) (*Download Your Information*).
2. Select **Messages**.
3. Set Format to **JSON** (Note: *HTML format is not supported*).
4. **Uncheck media files** (Photos and videos are not analyzed by this tool; unchecking them makes your export download instant and lightweight).
5. Choose your desired date range (e.g., *All time* or custom range).
6. Click **Request Download**. Once Facebook notifies you that the archive is ready, download the `.zip` file!

---

## How to Use

### 1. Website (No Installation Required)

Visit: [https://buddieswrapped.duongnx.tech](https://buddieswrapped.duongnx.tech) (or shortened link: [https://bit.ly/buddies-wrapped](https://bit.ly/buddies-wrapped))

1. Drag & drop your downloaded Facebook `messages.zip` (or JSON files) directly into the website.
2. Confirm your identity & preferred language (`EN` / `VI`).
3. Click **Continue** to explore your chat analytics immediately!

---

### 2. CLI / Terminal (`npx`)

**Prerequisite:** Requires [Node.js & npm](https://nodejs.org) installed on your system.  
*(To install Node.js/npm: download the LTS installer from [nodejs.org](https://nodejs.org), or run `brew install node` on macOS, `winget install OpenJS.NodeJS` on Windows, or `sudo apt install nodejs npm` on Ubuntu/Debian).*

1. Download and extract your Facebook `messages.zip`.
2. Open terminal in the extracted folder containing the `message_1.json` files.
3. Run:

```bash
npx buddies-wrapped
```

4. Follow the interactive prompts to select your name and language.
5. Your interactive `CHAT_OVERVIEW.html` report will open automatically in your default browser!

---

## Features

- **24+ Unique & Playful Leaderboards**: Best Value Score, Night Owl Champion, Early Bird Champion, Reply Speed (Them → Me), Rapid-Fire Message Bursts, Longest Monologue, Weekend Intensity, and more.
- **33+ Spotify-Wrapped-Style Key Insights**: "Accidental Novelist", "The Witching Hour (2 AM – 4 AM)", "Comedy Duo", "Curious Soul", "Ellipsis Addict", "ALL CAPS Drama", "Typing Marathon", and quirky physical equivalents.
- **Spoiler Mode by Default**: Blur insights with 1-click reveal badges to preserve the surprise.
- **1-Click PNG Card Graphic Export**: Hover over any insight card to download a Retina-ready graphic to share on social media.
- **Interactive Multi-Metric Timeline Graphs**: Dynamic time-series line charts powered by Chart.js (Monthly, Weekly, Daily aggregation; filter by Total, Cumulative Growth, Night Owl, Quality, Sent by Them, Chars typed).
- **Opposite-Only & Master Analysis**: Deep-dive into what friends sent to you vs what you sent.
- **Dual English & Vietnamese (EN / VI) Localization**: Full native translation for every metric, tooltip, and report view.
- **100% Private & Local**: Zero data leaves your machine. Runs entirely in your browser or local terminal.

---

## Privacy & Security

- **Zero Server Uploads**: The website uses [JSZip](https://stuk.github.io/jszip/) and browser APIs to decode and analyze data in memory on your device.
- **No Analytics / Telemetry**: No trackers, cookies, or remote logging.
- **Open Source**: All source code is completely public and auditable.

---

## License

[MIT](LICENSE) © [Duncuti](https://github.com/duongnguyen16/buddies-wrapped)
