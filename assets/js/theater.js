/* ============================================
   Chandamama Theater v5
   Multi-Voice Dramatized Podcast with Recording
   Character Reels • Episode Recording • Download
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
    this.bookmarkKey = 'chandamama_bookmarks_v5';

    // Recording
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.isRecording = false;
    this.recordedBlob = null;

    // Character reel
    this.reelMode = false;
    this.reelCharacter = null;
    this.reelIndices = [];
    this.reelPosition = 0;

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
  }

  createOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'theaterOverlay';
    overlay.className = 'theater-overlay';
    overlay.innerHTML = `
      <button class="theater-close" onclick="window.theater.exit()" title="Close (Esc)">✕</button>

      <!-- Recording indicator -->
      <div class="recording-indicator" id="recordingIndicator" style="display:none;">
        <span class="rec-dot"></span> REC
      </div>

      <!-- Character reel badge -->
      <div class="reel-badge" id="reelBadge" style="display:none;">
        🎭 Character Reel
      </div>

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

        <!-- Recording controls -->
        <button class="theater-btn rec-btn" id="recBtn" onclick="window.theater.toggleRecording()" title="Record Episode">⏺️</button>
        <button class="theater-btn" onclick="window.theater.showDownloadPanel()" title="Download Audio">💾</button>
      </div>

      <!-- Download Panel -->
      <div class="download-panel" id="downloadPanel">
        <h4>🎙️ Download Your Recording</h4>
        <p class="download-desc">Your browser recorded the Theater Mode audio. Download it as a podcast episode.</p>
        <div class="download-actions">
          <button class="btn-download-audio" onclick="window.theater.downloadRecording()">⬇️ Download Full Episode</button>
          <button class="btn-download-audio secondary" onclick="window.theater.downloadCharacterScript()">📄 Download Character Script</button>
        </div>
        <div class="character-reel-section">
          <h5>🎭 Character Reels</h5>
          <p class="reel-desc">Download audio of just one character's lines:</p>
          <div class="reel-buttons" id="reelButtons"></div>
        </div>
        <button class="download-close" onclick="window.theater.hideDownloadPanel()">✕</button>
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

    const quality = candidates.filter(v => 
      v.name.includes('Google') || v.name.includes('Samantha') || 
      v.name.includes('Daniel') || v.name.includes('Karen') ||
      v.name.includes('Victoria') || v.name.includes('Fred')
    );
    if (quality.length) candidates = quality;

    if (pref === 'female') {
      const female = candidates.filter(v => 
        v.name.includes('Female') || v.name.includes('Samantha') || 
        v.name.includes('Victoria') || v.name.includes('Karen')
      );
      if (female.length) return female[0];
    } else if (pref === 'male') {
      const male = candidates.filter(v => 
        v.name.includes('Male') || v.name.includes('Daniel') || 
        v.name.includes('Fred')
      );
      if (male.length) return male[0];
    }

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
    }
  }

  startEpisode(episodeId, options = {}) {
    if (!this.story) return;

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

    // Handle character reel mode
    if (options.characterReel) {
      this.reelMode = true;
      this.reelCharacter = options.characterReel;
      this.reelIndices = this.episode.script
        .map((line, i) => line.speaker === this.reelCharacter ? i : -1)
        .filter(i => i !== -1);
      this.reelPosition = 0;
      this.currentLine = this.reelIndices[0] || 0;
    } else {
      this.reelMode = false;
      this.reelCharacter = null;
      this.reelIndices = [];
      const bookmark = this.loadBookmark(episodeId);
      this.currentLine = bookmark;
    }

    this.isPlaying = false;
    this.isPaused = false;

    this.buildVoiceMap(this.episode);
    this.overlay.classList.add('active');
    document.body.style.overflow = 'hidden';

    const progress = document.getElementById('theaterProgress');
    if (progress) progress.max = this.getTotalLines() - 1;

    this.updateDuration();
    this.renderLine(this.currentLine);
    this.populateReelButtons();
    this.play();
  }

  getTotalLines() {
    if (this.reelMode && this.reelIndices.length > 0) {
      return this.reelIndices.length;
    }
    return this.episode ? this.episode.script.length : 0;
  }

  getScriptIndex(position) {
    if (this.reelMode && this.reelIndices.length > 0) {
      return this.reelIndices[position] || 0;
    }
    return position;
  }

  renderLine(index) {
    if (!this.episode) return;

    const scriptIndex = this.getScriptIndex(index);
    if (scriptIndex < 0 || scriptIndex >= this.episode.script.length) return;

    const line = this.episode.script[scriptIndex];
    const scene = this.episode.scenes.find(s => s.id === line.scene) || this.episode.scenes[0];
    const cast = this.episode.cast.find(c => c.name === line.speaker);

    if (this.sceneEl && scene && scene.bg) {
      this.sceneEl.style.background = scene.bg;
    }

    const sceneTitle = document.getElementById('sceneTitle');
    if (sceneTitle && scene) sceneTitle.textContent = scene.title || '';

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
      lineEl.style.color = '';
    }
    if (indicator) {
      indicator.textContent = `Line ${index + 1} of ${this.getTotalLines()}`;
    }

    const progress = document.getElementById('theaterProgress');
    if (progress) progress.value = index;
    this.updateTime();
    this.highlightTranscript(scriptIndex);
  }

  speakLine(index) {
    if (!this.episode) return;

    this.synth.cancel();

    const scriptIndex = this.getScriptIndex(index);
    const line = this.episode.script[scriptIndex];
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

    if (this.reelMode) {
      if (this.reelPosition < this.reelIndices.length - 1) {
        this.reelPosition++;
        this.currentLine = this.reelPosition;
        this.renderLine(this.currentLine);
        this.speakLine(this.currentLine);
      } else {
        this.finishEpisode();
      }
    } else {
      if (this.currentLine < this.episode.script.length - 1) {
        this.currentLine++;
        this.renderLine(this.currentLine);
        this.speakLine(this.currentLine);
      } else {
        this.finishEpisode();
      }
    }
  }

  finishEpisode() {
    this.isPlaying = false;
    this.updatePlayButton();
    this.saveBookmark(true);
    const lineEl = document.getElementById('charLine');
    if (lineEl) {
      lineEl.textContent = this.reelMode 
        ? `🎭 Character Reel Complete! (${this.reelCharacter})`
        : '🎭 Episode Complete! Thank you for listening.';
      lineEl.style.color = '#F4D03F';
    }
    if (this.isRecording) {
      this.stopRecording();
    }
  }

  skip(direction) {
    if (!this.episode) return;

    if (this.reelMode) {
      const newPos = this.reelPosition + direction;
      if (newPos >= 0 && newPos < this.reelIndices.length) {
        this.reelPosition = newPos;
        this.currentLine = newPos;
        if (this.isPlaying) {
          this.renderLine(this.currentLine);
          this.speakLine(this.currentLine);
        } else {
          this.renderLine(this.currentLine);
        }
      }
    } else {
      const newIndex = this.currentLine + direction;
      if (newIndex >= 0 && newIndex < this.episode.script.length) {
        this.currentLine = newIndex;
        if (this.isPlaying) {
          this.renderLine(this.currentLine);
          this.speakLine(this.currentLine);
        } else {
          this.renderLine(this.currentLine);
        }
      }
    }
  }

  seek(value) {
    if (!this.episode) return;
    const index = parseInt(value);
    const max = this.getTotalLines();
    if (index >= 0 && index < max) {
      if (this.reelMode) {
        this.reelPosition = index;
        this.currentLine = index;
      } else {
        this.currentLine = index;
      }
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
    if (cur) cur.textContent = (this.reelMode ? this.reelPosition : this.currentLine) + 1;
    if (dur) dur.textContent = this.getTotalLines();
  }

  updateDuration() { this.updateTime(); }

  highlightTranscript(index) {
    document.querySelectorAll('.transcript-line').forEach((el, i) => {
      if (parseInt(el.dataset.index) === index) {
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

  // ============================================
  // RECORDING
  // ============================================

  async toggleRecording() {
    if (this.isRecording) {
      this.stopRecording();
    } else {
      await this.startRecording();
    }
  }

  async startRecording() {
    try {
      // Request display media (user selects tab with audio)
      const stream = await navigator.mediaDevices.getDisplayMedia({
        audio: true,
        video: { width: 1, height: 1 } // Minimal video to reduce size
      });

      // Also try to get user audio as fallback
      let audioStream = stream;
      try {
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioStream = new MediaStream([...stream.getAudioTracks(), ...micStream.getAudioTracks()]);
      } catch (e) {
        // mic not available, use display audio only
      }

      this.recordedChunks = [];
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus' 
        : 'audio/webm';

      this.mediaRecorder = new MediaRecorder(audioStream, { mimeType });

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.recordedChunks.push(e.data);
      };

      this.mediaRecorder.onstop = () => {
        this.recordedBlob = new Blob(this.recordedChunks, { type: mimeType });
        stream.getTracks().forEach(t => t.stop());
        this.showDownloadPanel();
      };

      this.mediaRecorder.start(1000); // Collect every second
      this.isRecording = true;

      document.getElementById('recBtn').textContent = '⏹️';
      document.getElementById('recBtn').classList.add('recording');
      document.getElementById('recordingIndicator').style.display = 'flex';

      console.log('[Theater] Recording started');
    } catch (e) {
      console.error('[Theater] Recording failed:', e);
      alert('Recording requires permission to capture audio. Please allow when prompted, and select the browser tab.');
    }
  }

  stopRecording() {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      this.isRecording = false;
      document.getElementById('recBtn').textContent = '⏺️';
      document.getElementById('recBtn').classList.remove('recording');
      document.getElementById('recordingIndicator').style.display = 'none';
      console.log('[Theater] Recording stopped');
    }
  }

  showDownloadPanel() {
    document.getElementById('downloadPanel').classList.add('active');
  }

  hideDownloadPanel() {
    document.getElementById('downloadPanel').classList.remove('active');
  }

  downloadRecording() {
    if (!this.recordedBlob) {
      alert('No recording available. Record an episode first.');
      return;
    }
    const episodeTitle = this.episode ? this.episode.title.replace(/[^a-z0-9]/gi, '_') : 'episode';
    const url = URL.createObjectURL(this.recordedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chandamama_${episodeTitle}_${Date.now()}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  downloadCharacterScript() {
    if (!this.episode) return;
    const script = {
      title: this.episode.title,
      character: this.reelCharacter || 'All',
      lines: this.episode.script.map((line, i) => ({...line, index: i}))
    };
    const blob = new Blob([JSON.stringify(script, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chandamama_script_${this.episode.id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  populateReelButtons() {
    const container = document.getElementById('reelButtons');
    if (!container || !this.episode) return;

    container.innerHTML = '';

    // Count lines per character
    const charCounts = {};
    this.episode.script.forEach(line => {
      charCounts[line.speaker] = (charCounts[line.speaker] || 0) + 1;
    });

    Object.entries(charCounts).forEach(([name, count]) => {
      const cast = this.episode.cast.find(c => c.name === name);
      const emoji = cast ? cast.emoji : '🎭';
      const btn = document.createElement('button');
      btn.className = 'reel-char-btn';
      btn.innerHTML = `${emoji} ${name} <span class="reel-count">${count} lines</span>`;
      btn.onclick = () => {
        this.hideDownloadPanel();
        this.exit();
        setTimeout(() => {
          this.startEpisode(this.episode.id, { characterReel: name });
        }, 300);
      };
      container.appendChild(btn);
    });
  }

  exit() {
    this.synth.cancel();
    this.isPlaying = false;
    this.isPaused = false;
    if (this.autoAdvanceTimer) clearTimeout(this.autoAdvanceTimer);
    if (this.isRecording) this.stopRecording();
    this.overlay.classList.remove('active');
    document.body.style.overflow = '';
    this.saveBookmark();
    const lineEl = document.getElementById('charLine');
    if (lineEl) lineEl.style.color = '';
    this.hideDownloadPanel();
    this.reelMode = false;
    this.reelCharacter = null;
    document.getElementById('reelBadge').style.display = 'none';
  }

  static async openEpisode(storyUrl, episodeId, options = {}) {
    if (!window.theater) {
      window.theater = new ChandamamaTheater();
    }
    if (typeof storyUrl === 'object' && storyUrl.episodes) {
      window.theater.story = storyUrl;
    } else {
      await window.theater.loadStory(storyUrl);
    }
    const bookmark = window.theater.loadBookmark(episodeId);
    window.theater.currentLine = bookmark;
    window.theater.startEpisode(episodeId, options);
  }
}

window.theater = new ChandamamaTheater();
