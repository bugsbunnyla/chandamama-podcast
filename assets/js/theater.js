/* ============================================
   Chandamama Theater — Real Multi-Voice Podcast
   Web Speech API with Character Voice Mapping
   Dramatized presentation with scene backgrounds
   ============================================ */

class ChandamamaTheater {
  constructor() {
    this.story = null;
    this.episode = null;
    this.currentLine = 0;
    this.isPlaying = false;
    this.isPaused = false;
    this.voices = [];
    this.voiceMap = {};
    this.synth = window.speechSynthesis;
    this.utterance = null;
    this.overlay = null;
    this.sceneEl = null;
    this.autoAdvanceTimer = null;
    this.bookmarkKey = 'chandamama_bookmarks_v3';
    this.preferredVoice = null;

    this.init();
  }

  init() {
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = () => this.loadVoices();
    }
    this.loadVoices();

    if (!document.getElementById('theaterOverlay')) {
      this.createOverlay();
    }
    this.overlay = document.getElementById('theaterOverlay');
    this.sceneEl = document.getElementById('theaterScene');

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (!this.overlay.classList.contains('active')) return;
      switch(e.code) {
        case 'Space': e.preventDefault(); this.togglePlay(); break;
        case 'ArrowRight': this.skip(1); break;
        case 'ArrowLeft': this.skip(-1); break;
        case 'Escape': this.exit(); break;
      }
    });
  }

  loadVoices() {
    this.voices = this.synth.getVoices() || [];
    console.log(`[Theater] ${this.voices.length} voices available`);

    // Log voice names for debugging
    this.voices.forEach((v, i) => {
      console.log(`  [${i}] ${v.name} (${v.lang})`);
    });
  }

  createOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'theaterOverlay';
    overlay.className = 'theater-overlay';
    overlay.innerHTML = `
      <button class="theater-close" onclick="window.theater.exit()" title="Close (Esc)">✕</button>
      <div class="theater-scene" id="theaterScene">
        <div class="theater-scene-title" id="sceneTitle"></div>
        <div class="theater-character" id="theaterCharacter">
          <span class="theater-emoji" id="charEmoji">🌙</span>
          <div class="theater-name" id="charName">Uncle Moonbeam</div>
          <div class="theater-line" id="charLine">Welcome to Chandamama</div>
        </div>
        <div class="theater-line-indicator" id="lineIndicator">Line 1 of 1</div>
      </div>
      <div class="theater-controls">
        <button class="theater-btn" onclick="window.theater.skip(-1)" title="Previous (←)">⏮️</button>
        <button class="theater-btn" onclick="window.theater.rewind()" title="Rewind 3 lines">⏪</button>
        <button class="theater-btn play" id="theaterPlayBtn" onclick="window.theater.togglePlay()" title="Play/Pause (Space)">▶️</button>
        <button class="theater-btn" onclick="window.theater.forward()" title="Forward 3 lines">⏩</button>
        <button class="theater-btn" onclick="window.theater.skip(1)" title="Next (→)">⏭️</button>
        <div class="theater-progress-wrap">
          <span class="theater-time" id="theaterCur">1</span>
          <input type="range" id="theaterProgress" min="0" max="100" value="0" step="1" oninput="window.theater.seek(this.value)">
          <span class="theater-time" id="theaterDur">1</span>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  async loadStory(url) {
    try {
      const response = await fetch(url);
      this.story = await response.json();
      return this.story;
    } catch (e) {
      console.error('[Theater] Failed to load story:', e);
      alert('Could not load story data. Please check your connection.');
      return null;
    }
  }

  selectVoice(pref, pitch) {
    if (!this.voices.length) this.loadVoices();
    if (!this.voices.length) return null;

    let candidates = this.voices.filter(v => v.lang.startsWith('en'));
    if (!candidates.length) candidates = this.voices;

    // Try to find high-quality voices first
    const quality = candidates.filter(v => 
      v.name.includes('Google') || v.name.includes('Samantha') || 
      v.name.includes('Daniel') || v.name.includes('Karen') ||
      v.name.includes('Victoria') || v.name.includes('Fred') ||
      v.name.includes('Google US English') || v.name.includes('Google UK English')
    );
    if (quality.length) candidates = quality;

    // Match by preference
    if (pref === 'female') {
      const female = candidates.filter(v => 
        v.name.includes('Female') || v.name.includes('Samantha') || 
        v.name.includes('Victoria') || v.name.includes('Karen') ||
        v.name.includes('Google UK English Female') ||
        v.name.includes('Google US English') && !v.name.includes('Male')
      );
      if (female.length) return female[0];
    } else if (pref === 'male') {
      const male = candidates.filter(v => 
        v.name.includes('Male') || v.name.includes('Daniel') || 
        v.name.includes('Fred') || v.name.includes('Google US English')
      );
      if (male.length) return male[0];
    }

    // Fallback by pitch
    if (pitch >= 1.15) {
      const f = candidates.filter(v => v.name.includes('Female') || v.name.includes('Samantha'));
      if (f.length) return f[0];
    } else if (pitch <= 0.85) {
      const m = candidates.filter(v => v.name.includes('Male') || v.name.includes('Daniel'));
      if (m.length) return m[0];
    }

    return candidates[0];
  }

  buildVoiceMap(episode) {
    this.voiceMap = {};
    if (!episode.cast) return;

    for (const character of episode.cast) {
      const voicePref = character.voice ? character.voice.pref : 'male';
      const voicePitch = character.voice ? character.voice.pitch : 1.0;
      const voiceRate = character.voice ? character.voice.rate : 1.0;
      const voice = this.selectVoice(voicePref, voicePitch);
      this.voiceMap[character.name] = {
        voice: voice,
        pitch: voicePitch || 1.0,
        rate: voiceRate || 1.0,
        emoji: character.emoji || '🎭'
      };
      console.log(`[Theater] Voice for ${character.name}: ${voice ? voice.name : 'DEFAULT'}`);
    }
  }

  startEpisode(episodeId) {
    if (!this.story) return;

    // Support auto-generated episodes
    if (typeof episodeId === 'object') {
      this.episode = episodeId;
      episodeId = episodeId.id;
    } else {
      this.episode = this.story.episodes.find(e => e.id === episodeId);
    }

    if (!this.episode) {
      console.error('[Theater] Episode not found:', episodeId);
      return;
    }

    // Load bookmark
    const bookmark = this.loadBookmark(episodeId);
    this.currentLine = bookmark;
    this.isPlaying = false;
    this.isPaused = false;

    this.buildVoiceMap(this.episode);
    this.overlay.classList.add('active');
    document.body.style.overflow = 'hidden';

    const progress = document.getElementById('theaterProgress');
    if (progress) progress.max = this.episode.script.length - 1;

    this.updateDuration();
    this.renderLine(this.currentLine);
    this.play();
  }

  renderLine(index) {
    if (!this.episode || index < 0 || index >= this.episode.script.length) return;

    const line = this.episode.script[index];
    const scene = this.episode.scenes.find(s => s.id === line.scene) || this.episode.scenes[0];
    const cast = this.episode.cast.find(c => c.name === line.speaker);
    const voiceInfo = this.voiceMap[line.speaker];

    // Update scene background
    if (this.sceneEl && scene && scene.bg) {
      this.sceneEl.style.background = scene.bg;
    }

    // Update scene title
    const sceneTitle = document.getElementById('sceneTitle');
    if (sceneTitle && scene) {
      sceneTitle.textContent = scene.title || '';
    }

    // Update character display
    const emojiEl = document.getElementById('charEmoji');
    const nameEl = document.getElementById('charName');
    const lineEl = document.getElementById('charLine');
    const indicator = document.getElementById('lineIndicator');

    if (emojiEl) {
      emojiEl.textContent = cast ? cast.emoji : '🌙';
      emojiEl.style.animation = 'none';
      emojiEl.offsetHeight;
      emojiEl.style.animation = 'breathe 3s ease-in-out infinite';
    }
    if (nameEl) nameEl.textContent = line.speaker;
    if (lineEl) {
      lineEl.textContent = line.text;
      lineEl.style.animation = 'none';
      lineEl.offsetHeight;
      lineEl.style.animation = 'fadeInUp 0.5s ease';
    }
    if (indicator) {
      indicator.textContent = `Line ${index + 1} of ${this.episode.script.length}`;
    }

    // Update progress
    const progress = document.getElementById('theaterProgress');
    if (progress) progress.value = index;
    this.updateTime();

    // Highlight transcript
    this.highlightTranscript(index);
  }

  speakLine(index) {
    if (!this.episode) return;

    this.synth.cancel();

    const line = this.episode.script[index];
    const voiceInfo = this.voiceMap[line.speaker];

    this.utterance = new SpeechSynthesisUtterance(line.text);

    if (voiceInfo && voiceInfo.voice) {
      this.utterance.voice = voiceInfo.voice;
    }
    if (voiceInfo) {
      this.utterance.pitch = Math.max(0.1, Math.min(2.0, voiceInfo.pitch));
      this.utterance.rate = Math.max(0.1, Math.min(2.0, voiceInfo.rate));
    }
    this.utterance.volume = 1.0;

    this.utterance.onend = () => {
      if (this.isPlaying && !this.isPaused) {
        this.autoAdvanceTimer = setTimeout(() => {
          this.nextLine();
        }, 600);
      }
    };

    this.utterance.onerror = (e) => {
      console.warn('[Theater] Speech error:', e);
      if (this.isPlaying && !this.isPaused) {
        this.autoAdvanceTimer = setTimeout(() => this.nextLine(), 1200);
      }
    };

    this.synth.speak(this.utterance);
  }

  play() {
    if (!this.episode) return;

    this.isPlaying = true;
    this.isPaused = false;
    this.updatePlayButton();

    this.renderLine(this.currentLine);

    // Small delay before speaking to let UI settle
    setTimeout(() => {
      this.speakLine(this.currentLine);
    }, 300);
  }

  pause() {
    this.isPaused = true;
    this.synth.pause();
    this.updatePlayButton();
    if (this.autoAdvanceTimer) clearTimeout(this.autoAdvanceTimer);
  }

  resume() {
    this.isPaused = false;
    this.synth.resume();
    this.updatePlayButton();
    if (!this.synth.speaking) {
      this.nextLine();
    }
  }

  togglePlay() {
    if (this.isPaused) {
      this.resume();
    } else if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  nextLine() {
    if (!this.episode) return;
    if (this.currentLine < this.episode.script.length - 1) {
      this.currentLine++;
      this.renderLine(this.currentLine);
      this.speakLine(this.currentLine);
    } else {
      this.isPlaying = false;
      this.updatePlayButton();
      this.saveBookmark(true);
      // Show completion
      const lineEl = document.getElementById('charLine');
      if (lineEl) {
        lineEl.textContent = '🎭 Episode Complete! Thank you for listening.';
        lineEl.style.color = '#F4D03F';
      }
    }
  }

  skip(direction) {
    if (!this.episode) return;
    const newIndex = this.currentLine + direction;
    if (newIndex >= 0 && newIndex < this.episode.script.length) {
      this.currentLine = newIndex;
      if (this.isPlaying && !this.isPaused) {
        this.renderLine(this.currentLine);
        this.speakLine(this.currentLine);
      } else {
        this.renderLine(this.currentLine);
      }
    }
  }

  seek(value) {
    if (!this.episode) return;
    const index = parseInt(value);
    if (index >= 0 && index < this.episode.script.length) {
      this.currentLine = index;
      this.renderLine(this.currentLine);
      if (this.isPlaying && !this.isPaused) {
        this.speakLine(this.currentLine);
      }
    }
  }

  rewind() { this.skip(-3); }
  forward() { this.skip(3); }

  updatePlayButton() {
    const btn = document.getElementById('theaterPlayBtn');
    if (btn) {
      btn.textContent = (this.isPlaying && !this.isPaused) ? '⏸️' : '▶️';
    }
  }

  updateTime() {
    const cur = document.getElementById('theaterCur');
    const dur = document.getElementById('theaterDur');
    if (cur) cur.textContent = (this.currentLine + 1).toString();
    if (dur && this.episode) dur.textContent = this.episode.script.length.toString();
  }

  updateDuration() { this.updateTime(); }

  highlightTranscript(index) {
    document.querySelectorAll('.transcript-line').forEach((el, i) => {
      if (i === index) {
        el.classList.add('active');
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        el.classList.remove('active');
      }
    });
  }

  saveBookmark(completed = false) {
    if (!this.episode) return;
    const bookmarks = JSON.parse(localStorage.getItem(this.bookmarkKey) || '{}');
    bookmarks[this.episode.id] = {
      line: this.currentLine,
      completed: completed,
      timestamp: Date.now()
    };
    localStorage.setItem(this.bookmarkKey, JSON.stringify(bookmarks));
  }

  loadBookmark(episodeId) {
    const bookmarks = JSON.parse(localStorage.getItem(this.bookmarkKey) || '{}');
    const bm = bookmarks[episodeId];
    return bm ? bm.line : 0;
  }

  exit() {
    this.synth.cancel();
    this.isPlaying = false;
    this.isPaused = false;
    if (this.autoAdvanceTimer) clearTimeout(this.autoAdvanceTimer);
    this.overlay.classList.remove('active');
    document.body.style.overflow = '';
    this.saveBookmark();
    // Reset line color
    const lineEl = document.getElementById('charLine');
    if (lineEl) lineEl.style.color = '';
  }

  static async openEpisode(storyUrl, episodeId) {
    if (!window.theater) {
      window.theater = new ChandamamaTheater();
    }
    // If storyUrl is actually a story object (from auto-processor), use it directly
    if (typeof storyUrl === 'object' && storyUrl.episodes) {
      window.theater.story = storyUrl;
    } else {
      await window.theater.loadStory(storyUrl);
    }
    const bookmark = window.theater.loadBookmark(episodeId);
    window.theater.currentLine = bookmark;
    window.theater.startEpisode(episodeId);
  }
}

window.theater = new ChandamamaTheater();
