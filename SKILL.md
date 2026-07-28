# Chandamama Podcast Production Skill
## PDF-to-Dramatized-Podcast Workflow

### Overview
This skill converts scanned magazine PDFs (like Chandamama Sanskrit 1999) into enacted multi-cast podcast episodes with interactive transcripts, playable on GitHub Pages.

---

## Phase 1: Source Extraction

### 1.1 Download Source Material
```bash
# From Archive.org
curl -L -o 1999December.pdf \
  "https://archive.org/download/Chandamama_Sanskrit_1999/1999December.pdf"

# Or download OCR text directly
curl -L -o 1999December.txt \
  "https://archive.org/download/Chandamama_Sanskrit_1999/1999December_djvu.txt"
```

### 1.2 Extract Text from PDF (if no OCR available)
```bash
# Using pdftotext
pdftotext -layout 1999December.pdf output.txt

# Using Python + PyPDF2
python3 -c "
import PyPDF2
reader = PyPDF2.PdfReader('1999December.pdf')
text = '\n'.join([page.extract_text() for page in reader.pages])
with open('extracted.txt', 'w') as f: f.write(text)
"
```

### 1.3 Identify Story Boundaries
Look for:
- **Cover illustration** → Usually the main story (Episode 1)
- **Editorial/Welcome page** → Introduction episode (Episode 0)
- **Puzzle/Activity pages** → Interactive episode (Episode 2)
- **Page numbers** in margins to map content flow

---

## Phase 2: Translation & Adaptation

### 2.1 Sanskrit → English Pipeline
1. **Raw OCR** → Devanagari text (may have errors)
2. **Sanskrit scholar review** → Correct OCR errors
3. **Literal translation** → Word-for-word meaning
4. **Literary adaptation** → Child-friendly dramatization

### 2.2 Adaptation Rules
- Preserve moral lessons (dharma, ahimsa, courage)
- Add dialogue where the original is narrative
- Create distinct character voices
- Insert interactive moments for children
- Keep episode length: 10–25 minutes

---

## Phase 3: Script Structuring

### 3.1 JSON Schema
```json
{
  "episodes": [{
    "id": "ep01",
    "title": "Story Title",
    "subtitle": "One-line hook",
    "art": "🎭",
    "duration": "18:00",
    "source": "Page range in original PDF",
    "cast": [
      {
        "name": "Character Name",
        "role": "Role description",
        "emoji": "🤴",
        "voice": {"pitch": 0.8, "rate": 0.9, "pref": "male"},
        "description": "Character bio"
      }
    ],
    "scenes": [
      {
        "id": "scene1",
        "title": "Scene Title",
        "setting": "Visual description",
        "mood": "atmospheric keyword",
        "bg": "CSS linear-gradient(...)"
      }
    ],
    "script": [
      {
        "speaker": "Character Name",
        "text": "Dialogue line",
        "emotion": "happy|sad|angry|mysterious",
        "scene": "scene1"
      }
    ]
  }]
}
```

### 3.2 Voice Mapping Guide
| Character Type | pitch | rate | pref | Example |
|---|---|---|---|---|
| Elderly narrator | 0.9 | 0.8 | male | Uncle Moonbeam |
| Brave king | 0.75 | 0.8 | male | King Vikramaditya |
| Graceful queen | 1.15 | 0.9 | female | Queen Ananya |
| Cautious advisor | 0.9 | 0.85 | male | Minister Gopal |
| Young girl | 1.25 | 1.05 | female | Smita |
| Playful animal | 1.1 | 1.1 | male | Dr. Rabbit |
| Ancient sage | 0.95 | 0.75 | male | Old Sage |

---

## Phase 4: Audio Production

### Option A: Browser TTS (Instant, Free)
- No recording needed
- Web Speech API reads scripts aloud
- Distinct voices per character via pitch/rate/voice selection
- Works immediately on GitHub Pages

### Option B: Human Recording (Highest Quality)
```
audio/
  en/
    ep01/
      narrator.mp3
      king_vikramaditya.mp3
      queen_ananya.mp3
      ...
```
Mix in Audacity or Reaper with:
- Reverb for cave scenes
- Bird sounds for forest scenes
- Soft music between scenes

### Option C: AI TTS (Balanced)
- ElevenLabs, Play.ht, or Azure Speech
- Clone voices for consistency
- Export per-character tracks
- Mix with ambient sound

---

## Phase 5: Deployment

### 5.1 File Structure
```
chandamama-podcast/
├── index.html              # Landing page
├── .nojekyll               # Required for GitHub Pages
├── assets/
│   ├── css/style.css       # Theater styles
│   └── js/
│       ├── theater.js      # Multi-voice player
│       └── player.js       # MP3 fallback
├── stories/
│   └── en.json             # Episode scripts
├── languages/
│   └── en.html             # Language episode page
├── audio/
│   └── en/
│       ├── ep00.mp3
│       ├── ep01.mp3
│       └── ep02.mp3
└── rss/
    └── en.xml              # Podcast feed
```

### 5.2 GitHub Pages Setup
1. Push to `main` branch
2. Settings → Pages → Source: Deploy from branch → `main` → `/ (root)`
3. Wait 1–2 minutes
4. Visit `https://YOURNAME.github.io/chandamama-podcast/`

---

## Phase 6: Quality Checklist

- [ ] All episode scripts have ≥20 dialogue lines
- [ ] Each character has unique voice settings
- [ ] Scene backgrounds have distinct CSS gradients
- [ ] Transcripts load and highlight correctly
- [ ] Theater Mode plays through full episode
- [ ] Bookmarks save and restore position
- [ ] Mobile layout works (test on phone)
- [ ] RSS feed validates at castfeedvalidator.com
- [ ] MP3 downloads work
- [ ] All 8 language pages link correctly

---

## Quick Reference: Adding a New Episode

1. Write script in `stories/en.json`
2. Add episode to `languages/en.html` EPISODES array
3. Generate/create MP3 in `audio/en/ep03.mp3`
4. Add `<item>` to `rss/en.xml`
5. Commit and push
