# Chandamama Podcast — TTS Fix (Surgical)

## What Changed

ONLY `assets/js/app.js` was modified. Two functions replaced:

- `speakWithGoogleTTS()` — now routes to Web Speech API
- `playGoogleTTSChunk()` — now uses `SpeechSynthesisUtterance` instead of dead `translate.google.com`

## Files Unchanged

- `index.html` — full UI (language select, translate, theater, story list)
- `assets/js/pdf-processor.js` — PDF parsing
- `assets/css/style.css` — styles
- All language files, RSS, stories

## How to Deploy

1. Extract this ZIP
2. Upload ALL files to your GitHub repo root (overwrite existing)
3. Commit: `Fix TTS: replace dead Google endpoint with Web Speech API`
4. Wait 2-5 minutes for GitHub Pages
5. Hard refresh: `Ctrl + F5`

## Verify

Open console (F12), select a language, translate, click Play:
```
[TTS] Using Web Speech API (Google endpoint is dead)
```

Audio now speaks dynamically in the selected language using your browser's built-in voice.
