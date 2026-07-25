# 🚀 Deploy Chandamama Podcast on GitHub Pages (100% Free)

This folder contains a complete, ready-to-deploy static website for hosting the Chandamama Moonlight Stories podcast **without paying for any external hosting**.

---

## 💰 Cost Breakdown

| Component | Service | Cost |
|-----------|---------|------|
| **Website** | GitHub Pages | **$0** |
| **Audio Files** | Internet Archive | **$0** |
| **Domain** | github.io subdomain | **$0** |
| **Custom Domain** | Your own domain (optional) | ~$10/year |
| **Total** | | **$0** |

---

## 📁 What's Inside

```
chandamama-podcast-site/
├── index.html              # Landing page with language selector
├── languages/
│   ├── en.html             # English episodes page
│   ├── te.html             # Telugu episodes page
│   ├── hi.html             # Hindi episodes page
│   ├── zh.html             # Chinese episodes page
│   ├── es.html             # Spanish episodes page
│   ├── it.html             # Italian episodes page
│   ├── de.html             # German episodes page
│   └── fr.html             # French episodes page
├── rss/
│   ├── en.xml              # English RSS feed
│   ├── te.xml              # Telugu RSS feed
│   ├── hi.xml              # Hindi RSS feed
│   ├── zh.xml              # Chinese RSS feed
│   ├── es.xml              # Spanish RSS feed
│   ├── it.xml              # Italian RSS feed
│   ├── de.xml              # German RSS feed
│   └── fr.xml              # French RSS feed
├── assets/
│   ├── css/
│   │   └── style.css       # All styles (dark mode, animations)
│   ├── js/
│   │   └── player.js       # Audio player with progress bar
│   └── images/             # Add cover art here
└── DEPLOY.md               # This file
```

---

## 🛠️ Step-by-Step Deployment

### Step 1: Create a GitHub Repository

1. Go to [github.com/new](https://github.com/new)
2. Repository name: `chandamama-podcast` (or any name you like)
3. Make it **Public** (required for free GitHub Pages)
4. Check **"Add a README file"**
5. Click **Create repository**

### Step 2: Upload These Files

**Option A: Drag & Drop (Easiest)**
1. Download this ZIP and extract it
2. In your GitHub repo, click **"Add file" → "Upload files"**
3. Drag ALL files from this folder into the upload area
4. Click **"Commit changes"**

**Option B: Git Command Line**
```bash
# Clone your repo
git clone https://github.com/YOUR_USERNAME/chandamama-podcast.git
cd chandamama-podcast

# Copy all files from this folder into the repo
cp -r /path/to/chandamama-podcast-site/* .

# Push to GitHub
git add .
git commit -m "Initial podcast site deployment"
git push origin main
```

### Step 3: Enable GitHub Pages

1. In your repo, go to **Settings** (tab at the top)
2. Scroll down to **Pages** in the left sidebar
3. Under **Source**, select **Deploy from a branch**
4. Select branch: `main` (or `master`)
5. Select folder: `/ (root)`
6. Click **Save**
7. Wait 1-2 minutes for the site to build
8. Your site will be at: `https://YOUR_USERNAME.github.io/chandamama-podcast/`

### Step 4: Update URLs

**CRITICAL:** Replace `yourname` in these files with your actual GitHub username:

1. **index.html** — Find all instances of `yourname.github.io` and replace
2. **languages/*.html** — Same replacement in RSS links
3. **rss/*.xml** — Update the `<link>` and `<itunes:image>` URLs

Use Find & Replace in any text editor:
- Find: `yourname.github.io/chandamama-podcast`
- Replace: `YOUR_USERNAME.github.io/chandamama-podcast`

### Step 5: Upload Audio to Internet Archive (Free Hosting)

GitHub Pages has a **1GB total limit** and **100MB per file limit**, so we host audio files on **Internet Archive** (free, unlimited, permanent).

1. Go to [archive.org/create](https://archive.org/create)
2. Create a free account
3. Click **"Upload"**
4. Upload your MP3 files with these naming conventions:
   ```
   chandamama-en-ep00-welcome.mp3
   chandamama-en-ep01-royal.mp3
   chandamama-te-ep00-welcome.mp3
   ...
   ```
5. After upload, click on each file to get its direct download URL
6. Update the `audio` URLs in the HTML files:
   - Open `languages/en.html`, `languages/te.html`, etc.
   - Find the `data-audio` attributes
   - Replace placeholder URLs with real Internet Archive URLs

**Example Internet Archive URL format:**
```
https://archive.org/download/IDENTIFIER/FILENAME.mp3
```

### Step 6: Add Cover Art

1. Create square cover images (3000x3000px recommended, minimum 1400x1400px)
2. Save as `cover-en.jpg`, `cover-te.jpg`, etc. in `assets/images/`
3. Upload to your repo
4. Update RSS feeds to point to these images

### Step 7: Submit to Podcast Directories

Once your site is live, submit the RSS feeds:

| Platform | Submit URL |
|----------|-----------|
| **Apple Podcasts** | [podcastsconnect.apple.com](https://podcastsconnect.apple.com) |
| **Spotify** | [podcasters.spotify.com](https://podcasters.spotify.com) → paste RSS URL |
| **Google Podcasts** | Auto-discovers from RSS |
| **Amazon Music** | [music.amazon.com/podcasts](https://music.amazon.com/podcasts) |
| **Stitcher** | [partners.stitcher.com](https://partners.stitcher.com) |
| **iHeartRadio** | [podcasters.iheart.com](https://podcasters.iheart.com) |
| **TuneIn** | [tunein.com/submit](https://tunein.com/submit) |
| **Pocket Casts** | [pocketcasts.com/submit](https://pocketcasts.com/submit) |

**RSS Feed URLs to submit:**
```
https://YOUR_USERNAME.github.io/chandamama-podcast/rss/en.xml
https://YOUR_USERNAME.github.io/chandamama-podcast/rss/te.xml
https://YOUR_USERNAME.github.io/chandamama-podcast/rss/hi.xml
... (one for each language)
```

---

## 🎨 Customization Guide

### Change Colors
Edit `assets/css/style.css` — modify these CSS variables at the top:
```css
:root {
    --moon-gold: #F4D03F;      /* Change accent color */
    --night-blue: #1a1a2e;      /* Change background */
    --accent-saffron: #FF9933;   /* Change button color */
}
```

### Add New Episodes
1. Record your audio
2. Upload to Internet Archive
3. Add a new episode card in the language HTML file:
```html
<div class="episode-card" data-audio="YOUR_AUDIO_URL" data-title="Episode Title" data-lang="English">
    <div class="episode-art">🎭</div>
    <div class="episode-info">
        <h3>Your Episode Title</h3>
        <div class="episode-meta">
            <span>⏱️ 15:00</span>
            <span>📅 Dec 1999</span>
            <span>👶 Ages 7-9</span>
        </div>
        <p class="episode-desc">Episode description here...</p>
        <div class="episode-actions">
            <button class="btn-play">▶️ Play</button>
            <a class="btn-download" href="YOUR_AUDIO_URL" download>⬇️ Download</a>
            <button class="btn-transcript">📄 Transcript</button>
        </div>
    </div>
</div>
```
4. Add the same episode to the RSS feed XML

### Add Transcripts
Inside each `.transcript-panel` div, replace the placeholder with your actual transcript:
```html
<div class="transcript-panel">
    <h4>Transcript — Episode Title</h4>
    <p><strong>NARRATOR:</strong> Welcome, little stars...</p>
    <p><strong>CHARACTER:</strong> Hello there!</p>
    ...
</div>
```

---

## 📊 GitHub Pages Limits

| Limit | Value | Notes |
|-------|-------|-------|
| **Repository size** | 1GB | Keep audio off GitHub, use Internet Archive |
| **File size** | 100MB | Audio files must be hosted elsewhere |
| **Bandwidth** | 100GB/month | More than enough for a podcast |
| **Builds** | 10/hour | Fine for normal updates |
| **Custom domain** | Yes | Add a CNAME file |

---

## 🔧 Troubleshooting

### Audio won't play?
- Check that the audio URL is correct and publicly accessible
- Internet Archive URLs should look like: `https://archive.org/download/IDENTIFIER/FILENAME.mp3`
- Test the URL in a browser tab directly

### Site not showing?
- GitHub Pages takes 1-2 minutes to build after each push
- Check **Settings → Pages** for build errors
- Make sure your repo is **Public**

### RSS feed not validating?
- Use [castfeedvalidator.com](https://castfeedvalidator.com) to check
- Ensure all `<enclosure>` URLs are absolute (start with https://)
- Make sure image URLs are accessible

### Styles look wrong?
- Hard refresh: `Ctrl+Shift+R` (or `Cmd+Shift+R` on Mac)
- Check browser console for 404 errors on CSS/JS files

---

## 🌐 Optional: Custom Domain

Want `chandamama-stories.org` instead of `github.io`?

1. Buy a domain from Namecheap, Cloudflare, or Google Domains (~$10/year)
2. In your repo, create a file named `CNAME` with your domain:
   ```
   chandamama-stories.org
   ```
3. In your domain DNS settings, add a CNAME record:
   - Type: CNAME
   - Name: www
   - Value: YOUR_USERNAME.github.io
4. Also add A records pointing to GitHub Pages IPs:
   - 185.199.108.153
   - 185.199.109.153
   - 185.199.110.153
   - 185.199.111.153
5. Wait up to 24 hours for DNS propagation

---

## 📱 Mobile App Feel

The site is already responsive and works great on phones. For an even more app-like experience:

1. Add this to `<head>` in all HTML files:
   ```html
   <meta name="theme-color" content="#1a1a2e">
   <link rel="manifest" href="manifest.json">
   ```
2. Create a `manifest.json` for "Add to Home Screen" support
3. The dark theme already feels like a native app!

---

## 🎵 Audio Production Workflow

```
Record Episode
    ↓
Edit in Audacity / GarageBand (free)
    ↓
Export as MP3 (192kbps, stereo)
    ↓
Upload to Internet Archive
    ↓
Copy the download URL
    ↓
Paste into HTML + RSS
    ↓
Git push → Auto-deploy to GitHub Pages
    ↓
Done! Live in 2 minutes.
```

---

## 🌟 Next Steps After Deployment

1. **Record Episode 0** (Welcome) in your strongest language first
2. **Share on social media** — post the GitHub Pages link
3. **Ask for voice actors** in Telugu, Hindi, Chinese, etc. communities
4. **Submit RSS feeds** to Apple Podcasts, Spotify, etc.
5. **Track analytics** — add Google Analytics or Plausible (free tier)
6. **Build community** — create a Discord or Telegram group for contributors

---

**Total cost to launch: $0. Total cost to maintain: $0.**

The only thing you need to invest is your time and creativity. The stories are already written — they just need your voice. 🌙
