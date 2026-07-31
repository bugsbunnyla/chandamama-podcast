#!/usr/bin/env python3
"""
Generate MP3 audio files for all stories in all languages.
Run locally: python .github/scripts/generate-audio.py
Run via GitHub Actions: push stories/ changes to main branch
"""

from gtts import gTTS
import os
import json
import re

def text_hash(text):
    """Same hash algorithm as app.js textHash()"""
    h = 0
    for c in text:
        h = ((h << 5) - h) + ord(c)
        h = h & 0xFFFFFFFF
    return hex(abs(h) & 0xFFFFFFFF)[2:].zfill(12)[:12]

def chunk_text(text, max_len=120):
    """Split text at sentence boundaries — same logic as app.js"""
    sentences = re.findall(r'[^\u0964.!?\n]+[\u0964.!?\n]+|[^\u0964.!?\n]+$', text)
    if not sentences:
        sentences = [text]
    chunks = []
    current = ''
    for s in sentences:
        t = s.strip()
        if not t:
            continue
        if len(current + t) > max_len and current:
            chunks.append(current.strip())
            current = t
        else:
            current = current + ' ' + t if current else t
    if current.strip():
        chunks.append(current.strip())
    return chunks if chunks else [text[:max_len]]

def generate_story_audio(story, lang):
    """Generate MP3s for one story in one language"""
    text = story.get('text', story.get('content', ''))
    if not text:
        return 0

    chunks = chunk_text(text)
    os.makedirs(f'audio/{lang}', exist_ok=True)
    generated = 0

    for chunk in chunks:
        h = text_hash(chunk)
        filepath = f'audio/{lang}/{h}.mp3'
        if os.path.exists(filepath):
            continue
        try:
            tts = gTTS(text=chunk, lang=lang, slow=False)
            tts.save(filepath)
            generated += 1
            print(f'  ✓ {filepath}')
        except Exception as e:
            print(f'  ✗ {filepath}: {e}')

    return generated

def load_stories():
    """Load stories from stories/ directory"""
    stories = []
    stories_dir = 'stories'
    if not os.path.exists(stories_dir):
        print(f'⚠️  {stories_dir}/ directory not found. Create it and add story JSON files.')
        return stories

    for filename in os.listdir(stories_dir):
        if filename.endswith('.json'):
            with open(os.path.join(stories_dir, filename), 'r', encoding='utf-8') as f:
                data = json.load(f)
                if isinstance(data, list):
                    stories.extend(data)
                elif isinstance(data, dict):
                    stories.append(data)
    return stories

def main():
    print('=' * 50)
    print('Chandamama Podcast — Audio Generator')
    print('=' * 50)

    stories = load_stories()
    if not stories:
        print('\n⚠️  No stories found. Add JSON files to stories/ directory.')
        print('\nExample stories/te.json:')
        print(json.dumps([{"id":"story-1","title":"My Story","text":"Your story text here..."}], indent=2))
        return

    languages = ['te', 'hi', 'ta', 'kn', 'ml', 'bn', 'en']
    total = 0

    for story in stories:
        sid = story.get('id', 'unknown')
        title = story.get('title', sid)
        print(f"\n📖 {title} ({sid})")
        for lang in languages:
            print(f"   🌐 {lang.upper()}")
            n = generate_story_audio(story, lang)
            total += n

    print(f"\n{'=' * 50}")
    print(f"Done! Generated {total} new MP3 files.")
    print("Next: git add audio/ && git commit -m 'Add audio' && git push")
    print('=' * 50)

if __name__ == '__main__':
    main()
