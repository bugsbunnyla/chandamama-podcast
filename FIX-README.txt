# Chandamama Podcast — TTS Fix v3

## Problem Fixed

ResponsiveVoice free tier does NOT include "Telugu Female" (or Tamil/Kannada/Malayalam voices).
When the previous fix routed Telugu to ResponsiveVoice, it threw:
  Selected voice does not exist: Telugu Female

This v3 fix adds a robust 3-tier fallback chain.

## What Changed in app.js

1. getRVVoice() — Maps ALL Indic languages to 'Hindi Female' (the only reliably
   available ResponsiveVoice free-tier Indic voice). Hindi is phonetically the
   closest fallback for Telugu/Tamil/Kannada/Malayalam.

2. playGoogleTTSChunk() — Added retry logic:
   - Try mapped voice (e.g. Hindi Female)
   - If that fails, try 'Hindi Female' again as universal fallback
   - If ResponsiveVoice completely fails, try Google Translate TTS via <audio>
   - Final fallback: Web Speech API

3. Console markers updated to [TTS FIX v3] so you can verify deployment.

## Deploy

1. Extract ZIP → overwrite assets/js/app.js (and index.html if included)
2. Update cache-buster in index.html: change app.js?v=2 to app.js?v=3
3. Commit & push
4. Wait 2-5 min for GitHub Pages
5. Hard refresh: Ctrl + Shift + R

## Verify in Console (F12)

Select Telugu (TE), translate, Play Theater. You should see:
  [TTS FIX v3] LOADED
  [TTS FIX v3] Trying ResponsiveVoice: Hindi Female
  [TTS FIX v3] ResponsiveVoice finished: Hindi Female

If Google TTS is used instead:
  [TTS FIX v3] ResponsiveVoice failed for all voices, trying Google Translate TTS...

You should NOT see:
  Selected voice does not exist: Telugu Female
  [Theater] Found via fallback: Microsoft David
