# Chandamama Podcast — TTS Fix v3

## What Changed

Only `assets/js/app.js` was modified. Four changes in the `play()` method:

1. **Added `forceRV` logic** — When an Indic language (Telugu, Hindi, Tamil, etc.) has no native local voice, `forceRV` becomes `true` even if a fallback voice (e.g. Hindi for Telugu) was found.

2. **Updated notice banner** — Shows "Using ResponsiveVoice TTS" when `forceRV` is active.

3. **Guarded local voice path** — Skips `SpeechSynthesisUtterance` when `forceRV` is true, preventing a Hindi voice from reading Telugu text.

4. **Routed fallback Indic to ResponsiveVoice** — The `else if` branch now catches `!canSpeak || forceRV` and calls `speakWithGoogleTTS()` which uses ResponsiveVoice cloud TTS.

## Files in this ZIP

- `index.html` — unchanged (already includes ResponsiveVoice script)
- `assets/js/app.js` — fixed TTS routing

## How to Deploy

1. Extract this ZIP
2. Overwrite your repo files with these
3. Commit: `Fix play() to force ResponsiveVoice for Indic languages without native voice`
4. Wait 2–5 min for GitHub Pages
5. Hard refresh: `Ctrl + Shift + R`

## Verify

Open console (F12), select Telugu (TE), translate, click Play Theater:
- You should see: `[TTS FIX v2] Using ResponsiveVoice for TE`
- You should NOT see: `Using fallback voice: Microsoft David` or any Hindi voice for Telugu text
