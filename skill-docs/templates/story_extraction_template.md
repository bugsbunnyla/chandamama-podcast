# 📖 Story Extraction & Adaptation Template
## Chandamama Sanskrit → Global Children's Media

---

## Part A: Source Document Analysis

```yaml
source_document:
  title: "चन्दमामा (Chandamama)"
  language: "Sanskrit"
  script: "Devanagari"
  issue_date: "December 1999"
  archive_url: "https://dn760107.eu.archive.org/0/items/Chandamama_Sanskrit_1999/1999December.pdf"

  issue_contents:
    cover_story: "[To be identified from illustration]"
    editor: "[Name from masthead]"
    publisher: "Chandamama India Limited, Chennai"

  physical_description:
    pages: "[Total page count]"
    illustrations_per_story: "[Average]"
    color_scheme: "Full color cover, B&W or spot color interior"

  known_sections:
    - "Editorial Letter (संपादकीय)"
    - "Cover Story / Main Tale"
    - "Short Stories (Laghu Katha)"
    - "Puzzles & Activities (बालचेष्टाः)"
    - "Cultural Articles (संस्कृतिक लेखाः)"
    - "Poems & Rhymes (काव्याणि)"
    - "Advertisements (विज्ञापनानि)"
```

---

## Part B: Per-Page Story Unit Extraction

### Template: Story Unit Card

```markdown
# Story Unit: [STORY-ID]

## Source Information
- **PDF Pages:** [start]-[end]
- **Content Type:** [story_main / story_short / cultural / poem / puzzle]
- **Original Title (Sanskrit):** [Devanagari text]
- **Transliteration:** [Romanized]
- **Estimated Sanskrit Word Count:** [number]

## Content Extraction

### Sanskrit Text (Original)
```
[Extract all Sanskrit text from these pages, preserving line breaks]
```

### English Translation (Literal)
```
[Direct translation maintaining original structure]
```

### Visual Description
```
[Describe every illustration on these pages in detail:
 - Characters shown
 - Clothing and jewelry
 - Background setting
 - Colors used
 - Action poses
 - Expressions]
```

### Layout Notes
```
[How text and images are arranged:
 - Text wraps around images?
 - Full-page illustration?
 - Multi-panel layout?
 - Caption placement?]
```

## Story Analysis

### Narrative Structure
```yaml
exposition: "[How the story begins]"
rising_action: "[What happens to build tension]"
climax: "[The turning point]"
falling_action: "[How tension resolves]"
resolution: "[The ending and lesson]"
```

### Character Inventory
```yaml
characters:
  - id: "char_01"
    name_sanskrit: "[Name in Devanagari]"
    name_transliterated: "[Romanized]"
    role: "[protagonist / antagonist / mentor / sidekick / narrator]"
    species: "[human / animal / deity / demon / nature_spirit / hybrid]"
    age_group: "[child / teen / adult / elder / ageless]"
    gender: "[male / female / nonbinary / unspecified]"
    appearance:
      clothing: "[Description from illustration]"
      distinguishing_features: "[What makes them recognizable]"
      colors_associated: "[Dominant colors]"
    personality:
      primary_trait: "[Core characteristic]"
      secondary_traits: ["trait1", "trait2", "trait3"]
      speech_pattern: "[How they talk - formal, playful, wise, etc.]"
    motivation: "[What do they want?]"
    arc: "[How do they change?]"

  - id: "char_02"
    # ... repeat for all characters
```

### Setting Deep-Dive
```yaml
world:
  name: "[If named]"
  type: "[realistic / mythological / fantasy / historical / blended]"
  time_period: "[specific era or 'timeless']"

locations:
  - name: "[Location name]"
    type: "[palace / forest / village / river / mountain / celestial / market / home]"
    description: "[Rich sensory details]"
    significance: "[Why this place matters to the story]"
    visual_elements: ["element1", "element2"]

cultural_markers:
  - "[Specific cultural practice shown]"
  - "[Traditional clothing depicted]"
  - "[Architecture style]"
  - "[Natural elements with symbolic meaning]"
```

### Theme & Moral Framework
```yaml
themes:
  primary: "[Main lesson - e.g., honesty, courage, kindness]"
  secondary:
    - "[Sub-theme 1]"
    - "[Sub-theme 2]"

moral_complexity: "[simple / nuanced / open_to_interpretation]"

cultural_values:
  - "[Value embedded in story from Indian tradition]"
  - "[Universal value that transcends culture]"

educational_opportunities:
  - subject: "[history / science / ethics / language / art]"
    topic: "[Specific learning point]"
    age_appropriateness: "[4-6 / 7-9 / 10-12]"
```

## Adaptation Readiness Score

```yaml
adaptation_score:
  overall: "[1-10]"

  factors:
    story_clarity: "[1-10] - How clear is the narrative?"
    character_distinctiveness: "[1-10] - Are characters memorable?"
    visual_richness: "[1-10] - How much illustration support?"
    cultural_specificity: "[1-10] - How rooted in Indian culture?"
    universal_appeal: "[1-10] - Will global kids relate?"
    educational_value: "[1-10] - Learning opportunities?"
    length_appropriateness: "[1-10] - Good for 15-20 min episode?"

  adaptation_notes: "[Any special considerations]"
  recommended_priority: "[high / medium / low]"
```
