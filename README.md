# Chandamama Podcast — TTS Fix v2

## What Changed

| File | Change |
|------|--------|
| `index.html` | Added ResponsiveVoice CDN + cache-busting `?v=2` |
| `assets/js/app.js` | Replaced dead Google TTS with ResponsiveVoice + Web Speech hybrid |
| `assets/js/pdf-processor.js` | Unchanged |

## CRITICAL: Clear Browser Cache

If you still see the OLD code running, your browser cached the old `app.js`.

**Force clear cache:**
- **Chrome/Edge:** Press `Ctrl+Shift+R` (NOT just F5)
- **Or:** Open DevTools (F12) → Network tab → Check "Disable cache" → Refresh
- **Or:** `Ctrl+F5` while DevTools is open

**Verify new code loaded:**
Open browser console (F12). You should see:
```
[TTS FIX v2] LOADED — ResponsiveVoice enabled for Telugu/Hindi/Tamil
```

If you DON'T see this, the old code is still cached. Keep hard-refreshing until you do.

## Deploy

1. **Download & extract** this ZIP
2. **Upload ALL files** to your GitHub repo root (overwrite existing)
3. **Commit** with message:
   ```
   Fix TTS v2: add ResponsiveVoice for Indic languages
   ```
4. **Wait 2–5 minutes** for GitHub Pages
5. **Hard refresh with cache clear:** `Ctrl+Shift+R`
6. **Check console** for `[TTS FIX v2] LOADED`

## How It Works

```
Select Telugu/Hindi/Tamil/etc
    │
    └──► ResponsiveVoice (cloud TTS)
         └──► Real native voice from server
              └──► Clear audio ✅

Select English/French/German/etc
    │
    └──► Web Speech API (local voice)
         └──► Fast, offline
              └──► Clear audio ✅
```

## Verify

1. Open your site
2. **Open console (F12)**
3. Select **Telugu**
4. Click **Translate**
5. Click **Play Theater**
6. Console should show:
   ```
   [TTS FIX v2] LOADED
   [TTS FIX v2] Using ResponsiveVoice for TE
   [TTS FIX v2] Speaking with ResponsiveVoice: Telugu Female
   ```
7. You should hear **real Telugu speech**

## Troubleshooting

**"Console shows old messages (Microsoft David, Windows Settings)"**
> Old code is cached. Hard refresh with `Ctrl+Shift+R` until you see `[TTS FIX v2] LOADED`.

**"No console message at all"**
> The new `app.js` isn't loading. Check that you uploaded `assets/js/app.js` and the `index.html` has `?v=2` in the script tag.

**"ResponsiveVoice not loaded"**
> Check internet connection. ResponsiveVoice loads from `https://code.responsivevoice.org/responsivevoice.js`.

**"English sounds robotic"**
> English uses your local Windows voice. If it sounds bad, that's a Windows voice issue.
