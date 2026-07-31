# Chandamama Podcast — Complete TTS Fix

## What Changed

| File | Change |
|------|--------|
| `index.html` | Added ResponsiveVoice CDN script |
| `assets/js/app.js` | Replaced dead Google TTS with ResponsiveVoice + Web Speech API hybrid |
| `assets/js/pdf-processor.js` | Unchanged |

## How TTS Works Now

```
User selects Telugu/Hindi/Tamil/etc
    │
    └──► ResponsiveVoice (cloud TTS)
         └──► Real native voice streams from server

User selects English/French/German/etc
    │
    └──► Web Speech API (local voice)
         └──► Fast, offline, uses Windows/macOS voices
```

## Deploy (No Editing Needed)

1. **Download & extract** this ZIP
2. **Upload ALL files** to your GitHub repo root (overwrite existing)
3. **Commit** with message:
   ```
   Fix TTS: add ResponsiveVoice for Indic languages
   ```
4. **Wait 2–5 minutes** for GitHub Pages
5. **Hard refresh:** `Ctrl + F5`

## Verify

1. Open your site
2. Select **Telugu** from language dropdown
3. Click **Translate**
4. Click **Play Theater**
5. You should hear **clear Telugu speech** — not Microsoft David robot

## Browser Console Messages

```
[TTS] Using ResponsiveVoice for te
```

If you see this, ResponsiveVoice is active and Telugu audio is working.

## Troubleshooting

**"Still no audio"**
> Check browser console (F12) for errors. Make sure `https://code.responsivevoice.org/responsivevoice.js` loads (check Network tab).

**"Audio is delayed first time"**
> ResponsiveVoice loads from CDN on first play. After that, it's instant.

**"English sounds robotic too"**
> English uses your local Windows voice. If it sounds bad, that's a Windows voice issue — not the code.

## Optional: Pre-Generate MP3s (Offline Support)

If you want audio to work without internet:

```bash
pip install gTTS
python .github/scripts/generate-audio.py
git add audio/
git commit -m "Add generated audio"
git push
```

The app will automatically use MP3s when available, ResponsiveVoice otherwise.
