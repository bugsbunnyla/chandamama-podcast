# 🚀 Quick Start Guide
## Chandamama AI Book Podcast — Getting Started

---

## For Content Creators

### Step 1: Extract a Story from the PDF

```bash
# Command for AI agent:
extract_story pages=5-8 issue="Chandamama_Sanskrit_1999_December"
```

**What happens:**
1. PDF pages 5-8 are analyzed
2. Text is extracted and translated to English
3. Illustrations are described in detail
4. A Story Unit Card is generated
5. Characters are identified and catalogued

**Output:** `story_unit_CHD-1999-12-005.md`

---

### Step 2: Choose Your Languages

```bash
# Command for AI agent:
adapt_languages story_id="CHD-1999-12-005" languages="en,te,hi,zh,es,it,de,fr"
```

**What happens:**
1. Story is translated to each language
2. Cultural adaptations are applied
3. Character voices are assigned per language
4. Vocabulary is graded for age appropriateness
5. Style guide compliance is checked

**Output:** 8 localized story files

---

### Step 3: Generate Podcast Scripts

```bash
# Command for AI agent:
generate_podcast story_id="CHD-1999-12-005" language="en"
```

**What happens:**
1. Full podcast script is written (18-20 minutes)
2. Sound design notes are added
3. Character dialogue is scripted
4. Kid interaction moments are placed
5. Music cues are specified

**Output:** `podcast_script_CHD-1999-12-005_en.md`

---

### Step 4: Design Digital Media

```bash
# Command for AI agent:
generate_visual story_id="CHD-1999-12-005" language="en"
```

**What happens:**
1. Storybook page layouts are designed
2. Character cards are created
3. Activity pages are planned
4. Animation specifications are written
5. Art direction is provided

**Output:** `visual_design_CHD-1999-12-005_en.md`

---

### Step 5: Full Pipeline (All at Once)

```bash
# Command for AI agent:
full_pipeline pdf_url="https://dn760107.eu.archive.org/0/items/Chandamama_Sanskrit_1999/1999December.pdf" languages="en,te,hi,zh,es,it,de,fr" target_age="7-9"
```

**What happens:**
1. Entire PDF is analyzed and segmented
2. All stories are extracted
3. All language adaptations are created
4. All podcast scripts are generated
5. All visual designs are created
6. A master index is compiled

**Output:** Complete production package

---

## For Parents & Educators

### How to Use with Children

#### Listening Together (Ages 4-6)
1. **Set the mood:** Dim lights, get cozy
2. **Preview:** Show the illustration first — "What do you see?"
3. **Listen:** Play the podcast, pause at interaction moments
4. **Discuss:** "What did you like? What did you learn?"
5. **Activity:** Do the coloring page or simple puzzle together

#### Independent Listening (Ages 7-9)
1. **Let them choose:** Show character cards, let them pick a story
2. **Listen with headphones:** They can follow along with the storybook
3. **Tap and explore:** Let them discover hidden sounds and facts
4. **Retell:** Ask them to tell YOU the story afterward
5. **Connect:** "How is this like our culture? How is it different?"

#### Deep Dive (Ages 10-12)
1. **Research:** Look up the Sanskrit concepts mentioned
2. **Compare:** How is this story similar to stories from YOUR culture?
3. **Create:** Write or draw your own ending
4. **Perform:** Put on a puppet show or skit
5. **Share:** Teach a younger child the story

---

## For Voice Actors

### Preparation Checklist

```markdown
Before recording:
- [ ] Read the full script 3 times
- [ ] Practice character voices (distinct pitch/rhythm for each)
- [ ] Record a test sample and check audio levels
- [ ] Warm up voice (humming, tongue twisters in target language)
- [ ] Set up quiet recording space
- [ ] Have water nearby
- [ ] Review cultural consultant notes

During recording:
- [ ] Maintain consistent energy throughout
- [ ] Pause at interaction moments (leave 5-second gaps)
- [ ] Mark pages where sound effects will be added
- [ ] Record 2-3 takes of emotional moments
- [ ] Save files with clear naming: StoryID_Language_Character_Take

After recording:
- [ ] Listen back for errors or inconsistencies
- [ ] Check pacing (use stopwatch for key segments)
- [ ] Submit raw files + marked script to sound designer
```

---

## For Illustrators

### Art Direction Quick Reference

```markdown
For each story page:
1. Read the story text thoroughly
2. Identify the KEY moment on this page
3. Sketch composition (rule of thirds, focal point)
4. Add cultural elements from language-specific guide
5. Ensure characters match their voice descriptions
6. Check color palette against language style guide
7. Add interactive elements (hidden objects, tap targets)
8. Create parallax layers (background, midground, foreground)
9. Export in required formats (PNG, WebP)
10. Provide alt text for accessibility
```

---

## For Developers

### Technical Implementation Guide

```markdown
### Audio Engine
- Use Web Audio API (web) or AVFoundation (iOS)
- Implement word-level timestamp sync
- Support variable playback speed (0.75x, 1.0x, 1.25x)
- Cache audio for offline playback

### Visual Engine
- Use Canvas 2D or WebGL for animations
- Implement parallax scrolling
- Support pinch-to-zoom on illustrations
- Handle text reflow for all languages

### Localization Engine
- Use ICU MessageFormat for text
- Support RTL if needed (future Arabic/Hebrew)
- Dynamic font loading per language
- Cultural asset swapping (overlays)

### Data Model
```json
{
  "story_id": "CHD-1999-12-005",
  "pages": [
    {
      "page_number": 1,
      "layout": "split_screen",
      "illustration": "url",
      "text": "localized_text",
      "audio_timestamps": [...],
      "interactives": [...]
    }
  ],
  "characters": [...],
  "activities": [...]
}
```
```

---

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| Story too long for 20 min | Split into Part 1 & Part 2 |
| Character voices too similar | Widen pitch range, add accent variation |
| Text doesn't fit in layout | Simplify language, use two pages |
| Cultural reference too obscure | Add inline explanation or glossary |
| Animation too complex | Simplify to 2-3 layers max |
| Audio sync drifts | Use word-level timestamps, not sentence |
| Child loses attention | Add interaction moment every 3 minutes |
| Translation loses meaning | Consult native speaker, adjust freely |

---

## Resources

### Source Material
- **PDF Archive:** https://dn760107.eu.archive.org/0/items/Chandamama_Sanskrit_1999/1999December.pdf
- **Chandamama History:** [To be researched]
- **Sanskrit Children's Literature:** [Resources to be compiled]

### Cultural Consultants Needed
- Telugu language & culture expert
- Hindi language & culture expert
- Chinese (Mandarin) language & culture expert
- Spanish language & culture expert
- Italian language & culture expert
- German language & culture expert
- French language & culture expert
- Indian classical music expert (for authentic soundscapes)
- Child development expert (for age-appropriateness)

### Tools Recommended
- **Audio:** Audacity (free), Adobe Audition, Pro Tools
- **Illustration:** Procreate, Photoshop, Illustrator, Figma
- **Animation:** After Effects, Lottie, Rive
- **Development:** React Native, Flutter, Unity
- **Localization:** Crowdin, Lokalise, Phrase

---

## Success Stories (Template)

```markdown
### Story: [Title]
- **Source:** Chandamama Sanskrit, December 1999, Pages [#-#]
- **Languages:** [List]
- **Runtime:** [Minutes]
- **Age Group:** [Range]
- **Production Time:** [Hours/Days]
- **Challenges:** [What was hard]
- **Solutions:** [How you solved it]
- **Feedback:** [What kids/parents said]
- **Improvements:** [What you'd do differently]
```

---

*"Every child deserves a story. Every story deserves to travel. Every language is a new adventure."*

**Welcome to Chandamama Moonlight Stories. Let's begin.** 🌙
