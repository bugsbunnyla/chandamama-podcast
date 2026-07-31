# Chandamama Podcast — Complete TTS Fix

## The Problem (SOLVED)

Your Google TTS endpoint is dead (404 + CORS). The app now uses a **hybrid approach**:

1. **Pre-generated MP3s** — crystal clear audio, works on every device
2. **Web Speech API** — instant fallback, uses browser's built-in voice
3. **Text-only mode** — auto-scroll with reading time

## Quick Start (Choose One Path)

---

### PATH A: Generate MP3s (Recommended — Best Quality)

This treats your stories like real podcasts. Generate audio once, play forever.

#### Step 1: Add Your Stories

Create `stories/your-stories.json`:
```json
[
  {
    "id": "story-1",
    "title": "Story Title",
    "text": "Your full story text here..."
  }
]
```

#### Step 2: Generate Audio Locally

```bash
pip install gTTS
python .github/scripts/generate-audio.py
```

This creates:
```
audio/
├── te/
│   ├── a1b2c3d4.mp3
│   └── ...
├── hi/
│   └── ...
└── ...
```

#### Step 3: Commit & Push

```bash
git add audio/ stories/
git commit -m "Add stories with generated audio"
git push
```

✅ Done! Your app now plays pre-generated MP3s for every language.

---

### PATH B: GitHub Actions (Zero Local Setup)

The workflow auto-generates MP3s whenever you push story changes.

1. Add your stories to `stories/` as JSON
2. Push to GitHub
3. GitHub Actions runs automatically → generates MP3s → commits them back

Enable it: Go to repo → Actions → "Generate Story Audio" → Enable workflows

---

### PATH C: Web Speech Only (Instant — No MP3s)

If you skip MP3 generation, the app falls back to Web Speech API.

**Requirements per OS:**

| OS | Telugu Audio? | How to Enable |
|----|--------------|---------------|
| Windows | ❌ No (by default) | Settings → Time & Language → Language & Region → Add Telugu → Enable Text-to-speech |
| Android Chrome | ✅ Yes | Usually works out of the box |
| macOS | ⚠️ Sometimes | System Preferences → Accessibility → Spoken Content |
| iOS Safari | ✅ Yes | Usually works |

**The app now shows a clear warning** if your device lacks the voice:
> "⚠️ Telugu voice not found on this device. For clear audio: Use the Generate Audio button..."

---

## What Changed in app.js

Only these methods were modified:

- `speakWithGoogleTTS()` — now tries MP3s first, then Web Speech
- `playGoogleTTSChunk()` — now uses `SpeechSynthesisUtterance` instead of dead `translate.google.com`
- Added `getVoiceStatus()` — detects available voices
- Added `showTTSToast()` — shows friendly user messages
- Added `textHash()` — creates deterministic MP3 filenames

## Files Included

| File | Status |
|------|--------|
| `index.html` | Unchanged — your original UI |
| `assets/js/pdf-processor.js` | Unchanged |
| `assets/js/app.js` | **Fixed TTS** |
| `.github/workflows/generate-audio.yml` | **New** — auto-generate MP3s |
| `.github/scripts/generate-audio.py` | **New** — audio generation script |
| `stories/example.json` | **New** — example story format |

## How MP3 Lookup Works

```
User clicks Play
    │
    ├──► Hash the text chunk → "a1b2c3d4"
    │      ├──► Check audio/te/a1b2c3d4.mp3
    │      │        ├──► Found? → Play MP3 (crystal clear)
    │      │        └──► Missing? → Continue
    │      └──► Check Web Speech API
    │               ├──► Telugu voice? → Speak natively
    │               └──► No voice? → Show warning, use fallback voice
    │
    └──► All failed? → Text-only auto-scroll
```

## Troubleshooting

**"Audio plays but sounds like English robot"**
> Your device has no Telugu voice. Use Path A (generate MP3s) or install Telugu in Windows Settings.

**"No audio at all"**
> Check browser console. If Web Speech is unsupported, use Chrome/Edge. Or generate MP3s.

**"MP3s not found"**
> Run `python .github/scripts/generate-audio.py` after adding stories to `stories/`.

**"GitHub Actions not running"**
> Go to repo → Actions tab → Enable workflows. Then push a change to `stories/`.
