/* ============================================================
   Chandamama Podcast Theater — Fixed v2.1
   Fixes: 414 URI Too Long, illegible PDF garbage, 
          text sanitization, chunked translation
   ============================================================ */

// ======================= CONFIG =======================
const CONFIG = {
  translateApi: 'https://api.mymemory.translated.net/get',
  translateDelay: 1200,
  translateCacheKey: 'cm_translate_cache_v2',
  maxRetries: 3,
  maxChunkLength: 450,      // Max chars per translation request
  maxLineLength: 300,       // Max chars per dialogue line
  voices: {
    kidBoy:     { pitch: 1.45, rate: 1.15, label: '👦 Kid Boy' },
    kidGirl:    { pitch: 1.55, rate: 1.10, label: '👧 Kid Girl' },
    adultMale:  { pitch: 0.95, rate: 1.00, label: '👨 Adult Male' },
    adultFemale:{ pitch: 1.15, rate: 1.00, label: '👩 Adult Female' },
    elderMale:  { pitch: 0.75, rate: 0.88, label: '👴 Elder Male' },
    elderFemale:{ pitch: 0.88, rate: 0.90, label: '👵 Elder Female' },
    oldMale:    { pitch: 0.65, rate: 0.80, label: '🧓 Old Age Male' },
    oldFemale:  { pitch: 0.78, rate: 0.82, label: '👵 Old Age Female' },
    animal:     { pitch: 1.35, rate: 1.25, label: '🐾 Animal' },
    narrator:   { pitch: 1.00, rate: 0.95, label: '🌙 Narrator' }
  }
};

// ======================= TEXT SANITIZER =======================
class TextSanitizer {
  static cleanPDFText(text) {
    if (!text) return '';
    let t = text;

    // Remove PDF artifacts: page markers, headers, footers, ISBNs, prices
    t = t.replace(/---\s*PAGE\s*\d+\s*---/gi, '\n');
    t = t.replace(/\b\d{3,5}\s*[\-/]\s*\d{3,5}\s*[\-/]\s*\d{3,5}\b/g, ' '); // Phone/ISBN numbers
    t = t.replace(/\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g, ' '); // Dates
    t = t.replace(/\bRs\.?\s*\d+[\.,]?\d*\b/gi, ' '); // Prices
    t = t.replace(/\b\d+\s*(?:€|\$|£|¥)\b/g, ' '); // Currency
    t = t.replace(/\b\d{4,}\b/g, ' '); // Long number sequences
    t = t.replace(/[#@^*~+=|\\{}[\]_<>]/g, ' '); // Junk symbols
    t = t.replace(/\b\d+\s*\/\s*-\s*\d+\b/g, ' '); // "100/- 200" patterns
    t = t.replace(/\b\d+\s*\(\s*\d+\s*\)\s*\d+\b/g, ' '); // Phone patterns
    t = t.replace(/\b\d+\s*[-.]\s*\d+\s*[-.]\s*\d+\b/g, ' '); // Number chains

    // Remove lines that are mostly numbers/symbols (OCR garbage)
    const lines = t.split(/\n+/);
    const cleanLines = lines.filter(line => {
      const alphaCount = (line.match(/[\u0900-\u097F\u0C00-\u0C7F\u0B80-\u0BFF\u0D00-\u0D7F\u0980-\u09FF\u0A80-\u0AFFa-zA-Z]/g) || []).length;
      const totalCount = line.trim().length;
      if (totalCount === 0) return false;
      const ratio = alphaCount / totalCount;
      // Keep lines that are at least 30% actual letters
      return ratio > 0.30 || totalCount < 10;
    });

    t = cleanLines.join('\n');

    // Normalize whitespace
    t = t.replace(/\s+/g, ' ').trim();

    // Remove repeated punctuation
    t = t.replace(/[.]{2,}/g, '…');
    t = t.replace(/[,]{2,}/g, ',');
    t = t.replace(/[!]{2,}/g, '!');
    t = t.replace(/[?]{2,}/g, '?');

    return t;
  }

  static splitIntoSentences(text) {
    if (!text) return [];
    // Split on sentence endings for Sanskrit/Hindi/Telugu/English
    const sentences = text
      .replace(/([।.!?])\s+/g, "$1\n")
      .split(/\n+/)
      .map(s => s.trim())
      .filter(s => s.length > 5 && s.length < CONFIG.maxLineLength);
    return sentences;
  }

  static chunkForTranslation(text, maxLen = CONFIG.maxChunkLength) {
    if (!text) return [];
    if (text.length <= maxLen) return [text];
    const chunks = [];
    let current = '';
    const words = text.split(/\s+/);
    for (const word of words) {
      if ((current + ' ' + word).length > maxLen) {
        if (current) chunks.push(current.trim());
        current = word;
      } else {
        current = current ? current + ' ' + word : word;
      }
    }
    if (current) chunks.push(current.trim());
    return chunks;
  }

  static isGarbageLine(line) {
    if (!line || line.length < 3) return true;
    // Check for high ratio of non-letters
    const letters = (line.match(/[\p{L}]/gu) || []).length;
    const total = line.length;
    if (letters / total < 0.25) return true;
    // Check for repeated single characters (OCR artifacts)
    if (/^(.)\1{3,}$/.test(line)) return true;
    // Check for excessive digits
    const digits = (line.match(/\d/g) || []).length;
    if (digits / total > 0.6) return true;
    return false;
  }
}

// ======================= TRANSLATION ENGINE (Fixed 429 + 414) =======================
class TranslationEngine {
  constructor() {
    this.cache = this.loadCache();
    this.queue = [];
    this.processing = false;
    this.delay = CONFIG.translateDelay;
  }

  loadCache() {
    try { return JSON.parse(localStorage.getItem(CONFIG.translateCacheKey) || '{}'); }
    catch(e) { return {}; }
  }

  saveCache() {
    localStorage.setItem(CONFIG.translateCacheKey, JSON.stringify(this.cache));
  }

  hash(text) {
    let h = 0;
    for (let i = 0; i < text.length; i++) {
      h = ((h << 5) - h) + text.charCodeAt(i);
      h |= 0;
    }
    return h.toString(16);
  }

  async translate(text, targetLang = 'te', sourceLang = 'Autodetect') {
    if (!text || !text.trim()) return '';
    // Sanitize and chunk
    const clean = TextSanitizer.cleanPDFText(text);
    const chunks = TextSanitizer.chunkForTranslation(clean, CONFIG.maxChunkLength);

    const results = [];
    for (const chunk of chunks) {
      const key = this.hash(chunk + '|' + sourceLang + '|' + targetLang);
      if (this.cache[key]) {
        results.push(this.cache[key]);
        continue;
      }
      const r = await this.translateChunk(chunk, targetLang, sourceLang, key);
      results.push(r);
    }
    return results.join(' ');
  }

  async translateChunk(text, targetLang, sourceLang, key) {
    return new Promise((resolve) => {
      this.queue.push({ text, targetLang, sourceLang, key, resolve });
      if (!this.processing) this.processQueue();
    });
  }

  async processQueue() {
    if (this.queue.length === 0) { this.processing = false; return; }
    this.processing = true;
    const job = this.queue.shift();

    let result = null;
    for (let attempt = 0; attempt < CONFIG.maxRetries; attempt++) {
      try {
        await this.sleep(attempt * this.delay);
        const url = `${CONFIG.translateApi}?q=${encodeURIComponent(job.text.substring(0, CONFIG.maxChunkLength))}&langpair=${job.sourceLang}|${job.targetLang}`;
        const resp = await fetch(url);
        if (resp.status === 429) {
          console.warn('[Translate] 429 — backing off, attempt', attempt + 1);
          await this.sleep(this.delay * 2 * (attempt + 1));
          continue;
        }
        if (resp.status === 414) {
          console.warn('[Translate] 414 URI Too Long — truncating');
          job.text = job.text.substring(0, 300);
          continue;
        }
        const data = await resp.json();
        if (data.responseData && data.responseData.translatedText) {
          result = data.responseData.translatedText;
          break;
        }
        if (data.responseStatus && data.responseStatus !== 200) {
          console.warn('[Translate] API error:', data.responseStatus, data.responseDetails);
        }
      } catch (e) { 
        console.warn('[Translate] attempt failed:', e.message); 
      }
    }

    if (!result) result = job.text; // fallback to original
    this.cache[job.key] = result;
    this.saveCache();
    job.resolve(result);

    await this.sleep(this.delay);
    this.processQueue();
  }

  sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  async translateBatch(lines, targetLang = 'te', sourceLang = 'Autodetect', onProgress = null) {
    const results = [];
    for (let i = 0; i < lines.length; i++) {
      const r = await this.translate(lines[i], targetLang, sourceLang);
      results.push(r);
      if (onProgress) onProgress(i + 1, lines.length);
    }
    return results;
  }
}

const Translator = new TranslationEngine();

// ======================= PDF PROCESSOR (Integrates with existing pdf-processor.js if present) =======================
class PDFStoryExtractor {
  constructor() {
    this.stories = [];
    this.useExternalProcessor = (typeof PDFAutoProcessor !== 'undefined');
  }

  async loadPDF(arrayBuffer) {
    // If the existing pdf-processor.js is loaded, use it
    if (this.useExternalProcessor && window.pdfProcessor) {
      console.log('[PDF] Using existing pdf-processor.js');
      const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      try {
        const story = await window.pdfProcessor.process(url);
        URL.revokeObjectURL(url);
        return this.adaptExternalStory(story);
      } catch (e) {
        URL.revokeObjectURL(url);
        console.warn('[PDF] External processor failed, falling back:', e);
      }
    }

    // Fallback to built-in PDF.js extraction
    if (typeof pdfjsLib === 'undefined') {
      throw new Error('PDF.js not loaded. Please include pdf.min.js');
    }
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const rawText = textContent.items.map(item => item.str).join(' ');
      const cleanText = TextSanitizer.cleanPDFText(rawText);
      pages.push({ pageNum: i, text: cleanText, rawText });
    }
    return pages;
  }

  adaptExternalStory(story) {
    // Convert pdf-processor.js output format to our format
    if (!story || !story.episodes) return [];
    return story.episodes.map((ep, idx) => ({
      pageNum: idx + 1,
      text: (ep.script || []).map(s => s.text).join('. '),
      title: ep.title || `Episode ${idx + 1}`
    }));
  }

  detectStories(pages) {
    const stories = [];
    let current = { title: 'Story 1', pages: [], text: '', sentences: [] };

    pages.forEach((p) => {
      const sentences = TextSanitizer.splitIntoSentences(p.text);
      if (sentences.length === 0) return;

      const firstSentence = sentences[0];
      // Heuristic for new story: short first sentence that looks like a title
      const isTitle = /^\d+[.\)]?\s*[A-Z\u0900-\u097F\u0C00-\u0C7F]/.test(firstSentence) ||
                      /^(Chapter|Story|Katha|కథ|అధ్యాయం|భాగం|कथा|अध्याय)/i.test(firstSentence) ||
                      (firstSentence.length < 50 && firstSentence.length > 5 && !firstSentence.includes(' '));

      if (isTitle && current.sentences.length > 2) {
        stories.push(current);
        current = { title: firstSentence, pages: [p.pageNum], text: p.text, sentences };
      } else {
        current.pages.push(p.pageNum);
        current.text += '\n' + p.text;
        current.sentences.push(...sentences);
      }
    });
    if (current.sentences.length > 0) stories.push(current);
    return stories;
  }
}

// ======================= CHARACTER VOICE MAPPER =======================
class CharacterVoiceMapper {
  constructor() {
    this.map = {};
    this.synth = window.speechSynthesis;
    this.voices = [];
    this.loadVoices();
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = () => this.loadVoices();
    }
  }

  loadVoices() {
    this.voices = this.synth.getVoices() || [];
  }

  getVoiceForLang(lang = 'te') {
    if (!this.voices.length) this.loadVoices();
    const langMap = { te: 'te', hi: 'hi', sa: 'hi', en: 'en', ta: 'ta', kn: 'kn', ml: 'ml', bn: 'bn' };
    const code = langMap[lang] || lang;
    let candidates = this.voices.filter(v => v.lang && v.lang.startsWith(code));
    if (!candidates.length) candidates = this.voices.filter(v => v.lang && v.lang.startsWith('en'));
    if (!candidates.length) candidates = this.voices;
    return candidates[0] || null;
  }

  assign(characterName, type = 'narrator') {
    const cfg = CONFIG.voices[type] || CONFIG.voices.narrator;
    this.map[characterName] = {
      name: characterName,
      type,
      ...cfg,
      emoji: this.emojiForType(type)
    };
    return this.map[characterName];
  }

  emojiForType(type) {
    const map = {
      kidBoy: '👦', kidGirl: '👧', adultMale: '👨', adultFemale: '👩',
      elderMale: '👴', elderFemale: '👵', oldMale: '🧓', oldFemale: '👵',
      animal: '🐾', narrator: '🌙'
    };
    return map[type] || '👤';
  }

  detectTypeFromName(name) {
    const n = name.toLowerCase();
    if (/\b(boy|son|kid|child|bala|balu|రాజు|బాలుడు|बालक|लड़का)\b/.test(n)) return 'kidBoy';
    if (/\b(girl|daughter|kid|child|bala|రాణి|బాలిక|बालिका|लड़की)\b/.test(n)) return 'kidGirl';
    if (/\b(old man|grandfather|thatha|తాతయ్య|ముసలి|వృద్ధ|वृद्ध|बुज़ुर्ग)\b/.test(n)) return 'oldMale';
    if (/\b(old woman|grandmother|paati|నానమ్మ|ముసలి|వృద్ధ|वृद्धा|बुज़ुर्ग)\b/.test(n)) return 'oldFemale';
    if (/\b(elder|uncle|mama|గురువు|పెద్ద|गुरु|अंकल)\b/.test(n)) return 'elderMale';
    if (/\b(elder|aunty|amma|పెద్ద|मासी|आंटी)\b/.test(n)) return 'elderFemale';
    if (/\b(animal|dog|cat|bird|lion|fox|తోడు|నక్క|సింహం|ఏనుగ|शेर|कुत्ता|बिल्ली|पक्षी|सर्प)\b/.test(n)) return 'animal';
    if (/\b(queen|princess|wife|mother|sister|అమ్మ|అక్క|భార్య|రాణి|रानी|माँ|बहन|पत्नी)\b/.test(n)) return 'adultFemale';
    if (/\b(king|prince|husband|father|brother|నాన్న|అన్న|భర్త|రాజు|राजा|पिता|भाई|पति)\b/.test(n)) return 'adultMale';
    return 'narrator';
  }

  autoAssign(characters) {
    characters.forEach(c => {
      const type = this.detectTypeFromName(c);
      this.assign(c, type);
    });
  }

  speak(text, characterName, lang = 'te') {
    if (!this.synth) return;
    this.synth.cancel();
    const info = this.map[characterName] || this.map['Narrator'] || { pitch: 1, rate: 1, emoji: '🌙' };
    const utter = new SpeechSynthesisUtterance(text);
    utter.pitch = Math.max(0.1, Math.min(2.0, info.pitch));
    utter.rate = Math.max(0.1, Math.min(2.0, info.rate));
    utter.volume = 1.0;
    const v = this.getVoiceForLang(lang);
    if (v) utter.voice = v;
    utter.lang = lang === 'te' ? 'te-IN' : (lang === 'hi' ? 'hi-IN' : 'en-US');
    this.synth.speak(utter);
    return utter;
  }
}

// ======================= THEATER ENGINE =======================
class TheaterEngine {
  constructor() {
    this.script = [];
    this.currentLine = 0;
    this.isPlaying = false;
    this.isPaused = false;
    this.voiceMapper = new CharacterVoiceMapper();
    this.synth = window.speechSynthesis;
    this.utterance = null;
    this.autoTimer = null;
    this.lang = 'te';
    this.overlay = null;
    this.onLineChange = null;
  }

  createOverlay() {
    if (document.getElementById('theaterOverlay')) return;
    const ov = document.createElement('div');
    ov.id = 'theaterOverlay';
    ov.className = 'theater-overlay';
    ov.innerHTML = `
      <button class="theater-close" onclick="window.theater.exit()" title="Close (Esc)">✕</button>
      <div class="theater-scene" id="theaterScene">
        <div class="theater-scene-title" id="sceneTitle"></div>
        <div class="theater-character" id="theaterCharacter">
          <span class="theater-emoji" id="charEmoji">🌙</span>
          <div class="theater-name" id="charName">Narrator</div>
          <div class="theater-line" id="charLine">Welcome to Chandamama Theater</div>
        </div>
        <div class="theater-line-indicator" id="lineIndicator">Line 1 of 1</div>
      </div>
      <div class="theater-controls">
        <button class="theater-btn" onclick="window.theater.skip(-1)" title="Previous">⏮</button>
        <button class="theater-btn" onclick="window.theater.rewind()" title="Rewind 3 lines">⏪</button>
        <button class="theater-btn play" id="theaterPlayBtn" onclick="window.theater.togglePlay()" title="Play/Pause (Space)">▶</button>
        <button class="theater-btn" onclick="window.theater.forward()" title="Forward 3 lines">⏩</button>
        <button class="theater-btn" onclick="window.theater.skip(1)" title="Next">⏭</button>
        <div class="theater-progress-wrap">
          <span class="theater-time" id="theaterCur">1</span>
          <input type="range" id="theaterProgress" min="0" max="100" value="0" step="1" oninput="window.theater.seek(this.value)">
          <span class="theater-time" id="theaterDur">1</span>
        </div>
      </div>
    `;
    document.body.appendChild(ov);
    this.overlay = ov;

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

  loadScript(lines, lang = 'te') {
    this.script = lines;
    this.lang = lang;
    this.currentLine = 0;
    const chars = [...new Set(lines.map(l => l.speaker))];
    this.voiceMapper.autoAssign(chars);
    this.createOverlay();
    const prog = document.getElementById('theaterProgress');
    if (prog) prog.max = Math.max(0, lines.length - 1);
    this.updateDuration();
  }

  renderLine(idx) {
    if (!this.script.length || idx < 0 || idx >= this.script.length) return;
    const line = this.script[idx];
    const info = this.voiceMapper.map[line.speaker] || { emoji: '👤', label: line.speaker };
    document.getElementById('charEmoji').textContent = info.emoji;
    document.getElementById('charName').textContent = line.speaker;
    document.getElementById('charLine').textContent = line.text;
    document.getElementById('lineIndicator').textContent = `Line ${idx + 1} of ${this.script.length}`;
    const prog = document.getElementById('theaterProgress');
    if (prog) prog.value = idx;
    this.updateTime();
    if (this.onLineChange) this.onLineChange(idx, line);
  }

  speakLine(idx) {
    if (!this.script.length) return;
    this.synth.cancel();
    const line = this.script[idx];
    this.utterance = this.voiceMapper.speak(line.text, line.speaker, this.lang);
    if (this.utterance) {
      this.utterance.onend = () => {
        if (this.isPlaying && !this.isPaused) {
          this.autoTimer = setTimeout(() => this.nextLine(), 800);
        }
      };
      this.utterance.onerror = () => {
        if (this.isPlaying && !this.isPaused) {
          this.autoTimer = setTimeout(() => this.nextLine(), 1200);
        }
      };
    }
  }

  play() {
    if (!this.script.length) return;
    this.isPlaying = true;
    this.isPaused = false;
    this.updatePlayBtn();
    this.renderLine(this.currentLine);
    setTimeout(() => this.speakLine(this.currentLine), 300);
  }

  pause() {
    this.isPaused = true;
    this.synth.pause();
    this.updatePlayBtn();
    if (this.autoTimer) clearTimeout(this.autoTimer);
  }

  resume() {
    this.isPaused = false;
    this.synth.resume();
    this.updatePlayBtn();
    if (!this.synth.speaking) this.nextLine();
  }

  togglePlay() {
    if (this.isPaused) this.resume();
    else if (this.isPlaying) this.pause();
    else this.play();
  }

  nextLine() {
    if (this.currentLine < this.script.length - 1) {
      this.currentLine++;
      this.renderLine(this.currentLine);
      this.speakLine(this.currentLine);
    } else {
      this.finish();
    }
  }

  skip(dir) {
    const newIdx = this.currentLine + dir;
    if (newIdx >= 0 && newIdx < this.script.length) {
      this.currentLine = newIdx;
      if (this.isPlaying) {
        this.renderLine(this.currentLine);
        this.speakLine(this.currentLine);
      } else {
        this.renderLine(this.currentLine);
      }
    }
  }

  seek(val) {
    const idx = parseInt(val);
    if (idx >= 0 && idx < this.script.length) {
      this.currentLine = idx;
      this.renderLine(this.currentLine);
      if (this.isPlaying && !this.isPaused) this.speakLine(this.currentLine);
    }
  }

  rewind() { this.skip(-3); }
  forward() { this.skip(3); }

  finish() {
    this.isPlaying = false;
    this.updatePlayBtn();
    document.getElementById('charLine').textContent = '🎭 Episode Complete! Thank you for listening.';
    document.getElementById('charLine').style.color = '#F4D03F';
  }

  updatePlayBtn() {
    const btn = document.getElementById('theaterPlayBtn');
    if (btn) btn.textContent = (this.isPlaying && !this.isPaused) ? '⏸' : '▶';
  }

  updateTime() {
    const cur = document.getElementById('theaterCur');
    const dur = document.getElementById('theaterDur');
    if (cur) cur.textContent = this.currentLine + 1;
    if (dur) dur.textContent = this.script.length;
  }
  updateDuration() { this.updateTime(); }

  open() {
    this.createOverlay();
    this.overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  exit() {
    this.synth.cancel();
    this.isPlaying = false;
    this.isPaused = false;
    if (this.autoTimer) clearTimeout(this.autoTimer);
    this.overlay.classList.remove('active');
    document.body.style.overflow = '';
  }
}

window.theater = new TheaterEngine();

// ======================= PODCAST PLAYER =======================
class PodcastPlayer {
  constructor() {
    this.audio = new Audio();
    this.currentUrl = null;
    this.isPlaying = false;
    this.bar = null;
    this.init();
  }

  init() {
    if (document.querySelector('.podcast-bar')) return;
    const bar = document.createElement('div');
    bar.className = 'podcast-bar';
    bar.innerHTML = `
      <div class="podcast-art" id="podcastArt">🎧</div>
      <div class="podcast-info">
        <div class="podcast-title" id="podcastTitle">Select an episode</div>
        <div class="podcast-lang" id="podcastLang">—</div>
      </div>
      <div class="podcast-controls">
        <button class="podcast-btn-sm" onclick="window.podcastPlayer.seek(-15)">⏪</button>
        <button class="podcast-btn-sm play" id="podcastPlayBtn" onclick="window.podcastPlayer.togglePlay()">▶</button>
        <button class="podcast-btn-sm" onclick="window.podcastPlayer.seek(15)">⏩</button>
      </div>
      <div class="podcast-progress">
        <span class="podcast-time" id="podcastCur">0:00</span>
        <input type="range" id="podcastProgress" min="0" max="100" value="0" step="0.1">
        <span class="podcast-time" id="podcastDur">0:00</span>
      </div>
      <button class="podcast-btn-sm" onclick="window.podcastPlayer.close()">✕</button>
    `;
    document.body.appendChild(bar);
    this.bar = bar;

    this.audio.addEventListener('timeupdate', () => this.updateProgress());
    this.audio.addEventListener('ended', () => this.onEnded());
    this.audio.addEventListener('loadedmetadata', () => this.updateDuration());
    document.getElementById('podcastProgress').addEventListener('input', (e) => {
      if (this.audio.duration) this.audio.currentTime = (e.target.value / 100) * this.audio.duration;
    });
  }

  play(url, title, lang, art = '🎧') {
    if (this.currentUrl === url && this.audio.src) { this.togglePlay(); return; }
    this.currentUrl = url;
    this.audio.src = url;
    this.audio.play().then(() => {
      this.isPlaying = true;
      this.bar.classList.add('active');
      document.getElementById('podcastArt').textContent = art;
      document.getElementById('podcastTitle').textContent = title;
      document.getElementById('podcastLang').textContent = lang || 'Audio';
      this.updatePlayBtn();
    }).catch(err => alert('Could not play audio: ' + err.message));
  }

  togglePlay() {
    if (!this.audio.src) return;
    if (this.isPlaying) { this.audio.pause(); this.isPlaying = false; }
    else { this.audio.play(); this.isPlaying = true; }
    this.updatePlayBtn();
  }

  updatePlayBtn() {
    const btn = document.getElementById('podcastPlayBtn');
    if (btn) btn.textContent = this.isPlaying ? '⏸' : '▶';
  }

  seek(seconds) {
    this.audio.currentTime = Math.max(0, Math.min(this.audio.duration || 0, this.audio.currentTime + seconds));
  }

  updateProgress() {
    if (!this.audio.duration) return;
    const pct = (this.audio.currentTime / this.audio.duration) * 100;
    document.getElementById('podcastProgress').value = pct;
    document.getElementById('podcastCur').textContent = this.formatTime(this.audio.currentTime);
  }

  updateDuration() {
    document.getElementById('podcastDur').textContent = this.formatTime(this.audio.duration);
  }

  onEnded() { this.isPlaying = false; this.updatePlayBtn(); }

  close() {
    this.audio.pause();
    this.isPlaying = false;
    this.bar.classList.remove('active');
    this.currentUrl = null;
    this.updatePlayBtn();
  }

  formatTime(sec) {
    if (isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
}

window.podcastPlayer = new PodcastPlayer();

// ======================= MAIN APP =======================
class ChandamamaApp {
  constructor() {
    this.lang = 'te';
    this.pages = [];
    this.stories = [];
    this.currentStory = null;
    this.translatedLines = [];
    this.pdfExtractor = new PDFStoryExtractor();
    this.init();
  }

  init() {
    this.bindEvents();
    this.renderLanguageCards();
  }

  bindEvents() {
    const pdfInput = document.getElementById('pdfInput');
    if (pdfInput) {
      pdfInput.addEventListener('change', (e) => this.handlePDF(e.target.files[0]));
    }

    const dropZone = document.getElementById('pdfDropZone');
    if (dropZone) {
      dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
      dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length) this.handlePDF(e.dataTransfer.files[0]);
      });
    }
  }

  renderLanguageCards() {
    const grid = document.getElementById('langGrid');
    if (!grid) return;
    const langs = [
      { code: 'te', name: 'Telugu', native: 'తెలుగు', flag: '🇮🇳' },
      { code: 'hi', name: 'Hindi', native: 'हिन्दी', flag: '🇮🇳' },
      { code: 'en', name: 'English', native: 'English', flag: '🇬🇧' },
      { code: 'ta', name: 'Tamil', native: 'தமிழ்', flag: '🇮🇳' },
      { code: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ', flag: '🇮🇳' },
      { code: 'ml', name: 'Malayalam', native: 'മലയാളം', flag: '🇮🇳' },
      { code: 'bn', name: 'Bengali', native: 'বাংলা', flag: '🇮🇳' },
      { code: 'sa', name: 'Sanskrit', native: 'संस्कृतम्', flag: '🕉️' }
    ];
    grid.innerHTML = langs.map(l => `
      <div class="lang-card" data-lang="${l.code}" onclick="app.setLanguage('${l.code}')">
        <span class="flag">${l.flag}</span>
        <span class="lang-name">${l.name}</span>
        <span class="lang-native">${l.native}</span>
      </div>
    `).join('');
  }

  setLanguage(code) {
    this.lang = code;
    document.querySelectorAll('.lang-card').forEach(c => {
      c.classList.toggle('active', c.dataset.lang === code);
    });
    const label = document.getElementById('currentLangLabel');
    if (label) label.textContent = 'Target: ' + code.toUpperCase();
  }

  async handlePDF(file) {
    if (!file || file.type !== 'application/pdf') {
      alert('Please upload a valid PDF file.');
      return;
    }
    const status = document.getElementById('pdfStatus');
    if (status) status.textContent = 'Reading PDF...';

    const arrayBuffer = await file.arrayBuffer();
    try {
      this.pages = await this.pdfExtractor.loadPDF(arrayBuffer);
      this.stories = this.pdfExtractor.detectStories(this.pages);
      this.renderStorySelector();
      if (status) status.textContent = `Found ${this.pages.length} pages, ${this.stories.length} stories.`;
    } catch (e) {
      console.error(e);
      if (status) status.textContent = 'Error reading PDF: ' + e.message;
    }
  }

  renderStorySelector() {
    const container = document.getElementById('storySelector');
    if (!container) return;
    container.innerHTML = `
      <h3>📚 Select Story / Episode</h3>
      <div class="story-list">
        ${this.stories.map((s, i) => `
          <div class="story-card" onclick="app.selectStory(${i})">
            <div class="story-title">${this.escapeHtml(s.title || 'Untitled ' + (i+1))}</div>
            <div class="story-meta">Pages ${s.pages[0]}–${s.pages[s.pages.length-1]} · ${s.sentences?.length || 0} lines</div>
          </div>
        `).join('')}
      </div>
    `;
    container.style.display = 'block';
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  selectStory(index) {
    this.currentStory = this.stories[index];
    document.querySelectorAll('.story-card').forEach((c, i) => {
      c.classList.toggle('active', i === index);
    });
    this.showStoryEditor();
  }

  showStoryEditor() {
    const editor = document.getElementById('storyEditor');
    if (!editor || !this.currentStory) return;

    // Use pre-split sentences from PDF extraction
    const sentences = this.currentStory.sentences || [];
    const lines = sentences.map((text, i) => {
      let speaker = 'Narrator';
      let lineText = text;

      // Try to detect speaker from quotes
      const quoteMatch = text.match(/^["""'](.+)["""']\s*(.*)/);
      if (quoteMatch) {
        lineText = quoteMatch[1];
        const after = quoteMatch[2];
        const saidMatch = after.match(/(?:said|cried|asked|replied|అన్నాడు|అన్నది|चेप्प|अनौ|said|replied)\s+(\w+)/i);
        if (saidMatch) speaker = saidMatch[1];
      }

      // Name: dialogue pattern
      const colonMatch = text.match(/^(\w+[\s\w]*)[:：]\s*(.+)/);
      if (colonMatch) {
        speaker = colonMatch[1].trim();
        lineText = colonMatch[2].trim();
      }

      return { id: i, speaker, text: lineText, original: text };
    }).filter(l => l.text.length > 3); // Remove empty lines

    this.currentStory.lines = lines;

    editor.innerHTML = `
      <h3>🎭 Drama Cast & Lines</h3>
      <div class="cast-editor" id="castEditor"></div>
      <div class="lines-editor">
        <div class="lines-header">
          <span>#</span>
          <span>Character</span>
          <span>Voice Type</span>
          <span>Dialogue</span>
        </div>
        <div class="lines-list" id="linesList">
          ${lines.map((l, i) => `
            <div class="line-row" data-idx="${i}">
              <span class="line-num">${i+1}</span>
              <input class="line-speaker" value="${this.escapeHtml(l.speaker)}" onchange="app.updateSpeaker(${i}, this.value)">
              <select class="line-voice" onchange="app.updateVoice(${i}, this.value)">
                ${Object.entries(CONFIG.voices).map(([k,v]) => `<option value="${k}">${v.label}</option>`).join('')}
              </select>
              <input class="line-text" value="${this.escapeHtml(l.text)}" onchange="app.updateText(${i}, this.value)">
            </div>
          `).join('')}
        </div>
      </div>
      <div class="editor-actions">
        <button class="btn-primary" onclick="app.translateStory()">🌐 Translate to ${this.lang.toUpperCase()}</button>
        <button class="btn-secondary" onclick="app.openTheater()">🎭 Listen in Theater</button>
        <button class="btn-secondary" onclick="app.downloadScript()">⬇ Download Script</button>
      </div>
      <div class="translation-panel" id="translationPanel" style="display:none;">
        <h4>Translation Progress</h4>
        <div class="progress-bar"><div class="progress-fill" id="transProgress"></div></div>
        <div class="translated-text" id="translatedText"></div>
      </div>
    `;
    editor.style.display = 'block';
    this.renderCastEditor();
  }

  renderCastEditor() {
    const container = document.getElementById('castEditor');
    if (!container || !this.currentStory) return;
    const chars = [...new Set(this.currentStory.lines.map(l => l.speaker))];
    window.theater.voiceMapper.autoAssign(chars);
    container.innerHTML = chars.map(c => {
      const info = window.theater.voiceMapper.map[c] || { type: 'narrator', emoji: '🌙' };
      return `
        <div class="cast-chip">
          <span class="cast-emoji">${info.emoji}</span>
          <span class="cast-name">${this.escapeHtml(c)}</span>
          <select onchange="app.setCharacterType('${c.replace(/'/g, "\\'")}', this.value)">
            ${Object.entries(CONFIG.voices).map(([k,v]) => 
              `<option value="${k}" ${k===info.type?'selected':''}>${v.label}</option>`
            ).join('')}
          </select>
        </div>
      `;
    }).join('');
  }

  setCharacterType(name, type) {
    window.theater.voiceMapper.assign(name, type);
    this.renderCastEditor();
  }

  updateSpeaker(idx, val) { if (this.currentStory) this.currentStory.lines[idx].speaker = val; }
  updateText(idx, val) { if (this.currentStory) this.currentStory.lines[idx].text = val; }
  updateVoice(idx, type) {
    if (!this.currentStory) return;
    const speaker = this.currentStory.lines[idx].speaker;
    window.theater.voiceMapper.assign(speaker, type);
  }

  async translateStory() {
    if (!this.currentStory) return;
    const panel = document.getElementById('translationPanel');
    const fill = document.getElementById('transProgress');
    const textDiv = document.getElementById('translatedText');
    panel.style.display = 'block';

    const texts = this.currentStory.lines.map(l => l.text);
    const translated = await Translator.translateBatch(texts, this.lang, 'Autodetect', (done, total) => {
      const pct = (done / total) * 100;
      if (fill) fill.style.width = pct + '%';
      if (textDiv) textDiv.textContent = `Translating ${done}/${total} lines...`;
    });

    this.currentStory.lines.forEach((l, i) => { l.translated = translated[i]; });
    if (textDiv) {
      textDiv.innerHTML = this.currentStory.lines.map((l, i) => 
        `<div class="trans-line"><b>${this.escapeHtml(l.speaker)}:</b> ${this.escapeHtml(l.translated || l.text)}</div>`
      ).join('');
    }
    if (fill) fill.style.width = '100%';
  }

  openTheater() {
    if (!this.currentStory || !this.currentStory.lines.length) return;
    const useTranslated = this.currentStory.lines[0].translated;
    const script = this.currentStory.lines.map(l => ({
      speaker: l.speaker,
      text: useTranslated ? l.translated : l.text
    }));
    window.theater.loadScript(script, this.lang);
    window.theater.open();
    window.theater.play();
  }

  downloadScript() {
    if (!this.currentStory) return;
    const data = {
      title: this.currentStory.title,
      language: this.lang,
      lines: this.currentStory.lines
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chandamama_${(this.currentStory.title || 'story').replace(/\W+/g,'_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

let app;
document.addEventListener('DOMContentLoaded', () => { app = new ChandamamaApp(); });
