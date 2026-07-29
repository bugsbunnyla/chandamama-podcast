/* ============================================================
   Chandamama Podcast Theater — Fixed v2.2
   Fixes: partial translation (was filtering long sentences),
          illegible audio (no Telugu voice installed),
          chunk sizing, full-book translation
   ============================================================ */

const CONFIG = {
  translateApi: 'https://api.mymemory.translated.net/get',
  translateDelay: 1200,
  translateCacheKey: 'cm_translate_cache_v22',
  maxRetries: 3,
  maxChunkLength: 350,      // Conservative: 350 chars * 3 bytes (Devanagari) ≈ 1050 URL chars
  maxLineLength: 2000,      // Was 300 — killed full paragraphs. Now 2000.
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

// ======================= TEXT SANITIZER (Fixed) =======================
class TextSanitizer {
  static cleanPDFText(text) {
    if (!text) return '';
    let t = String(text);

    // Remove obvious PDF artifacts but PRESERVE story text
    t = t.replace(/---\s*PAGE\s*\d+\s*---/gi, '\n');
    t = t.replace(/\b\d{5,}\s*[\-/]\s*\d{5,}\b/g, ' '); // Long number chains (ISBN)
    t = t.replace(/\bRs\.?\s*\d+[\.,]?\d*\b/gi, ' '); // Prices
    t = t.replace(/\b\d+\s*(?:€|\$|£|¥)\b/g, ' '); // Currency symbols
    t = t.replace(/[#@^*~+=|\\{}[\]_<>]{2,}/g, ' '); // Repeated junk symbols only
    t = t.replace(/\b\d{4,}\b/g, ' '); // Standalone long numbers

    // Keep lines that have meaningful text. Be PERMISSIVE.
    const lines = t.split(/\n+/);
    const cleanLines = lines.filter(line => {
      const trimmed = line.trim();
      if (trimmed.length < 4) return false;
      // Count letters (Devanagari, Telugu, Tamil, Kannada, Malayalam, Bengali, Latin)
      const letterPattern = /[\u0900-\u097F\u0C00-\u0C7F\u0B80-\u0BFF\u0D00-\u0D7F\u0980-\u09FF\u0A80-\u0AFFa-zA-Z]/g;
      const alphaCount = (trimmed.match(letterPattern) || []).length;
      const total = trimmed.length;
      const ratio = alphaCount / total;
      // Keep if >20% letters OR it's a short title-like line
      return ratio > 0.20 || (total < 60 && alphaCount > 5);
    });

    t = cleanLines.join('\n');
    t = t.replace(/\s+/g, ' ').trim();
    t = t.replace(/[.]{3,}/g, '…');
    return t;
  }

  static splitIntoSentences(text) {
    if (!text) return [];
    // Split on Devanagari danda (।), double danda (॥), and Latin sentence ends
    const sentences = text
      .replace(/([।\.!?])\s+/g, "$1\n")
      .split(/\n+/)
      .map(s => s.trim())
      .filter(s => s.length > 5);
    // DO NOT filter by maxLineLength here — that was killing long paragraphs
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
    // Safety: if any single word is longer than maxLen, force-split it
    return chunks.flatMap(c => {
      if (c.length <= maxLen) return [c];
      const forced = [];
      for (let i = 0; i < c.length; i += maxLen) {
        forced.push(c.substring(i, i + maxLen));
      }
      return forced;
    });
  }
}

// ======================= TRANSLATION CACHE (LRU, persistent) =======================
class TranslationCache {
  constructor(maxSize = 5000, maxAgeDays = 30) {
    this.key = 'cm_translate_cache_v23';
    this.metaKey = 'cm_translate_cache_meta_v23';
    this.maxSize = maxSize;
    this.maxAge = maxAgeDays * 24 * 60 * 60 * 1000;
    this.data = this.load();
    this.meta = this.loadMeta();
  }
  hash(text, source, target) {
    let h = 5381;
    const str = String(text) + '|' + source + '|' + target;
    for (let i = 0; i < str.length; i++) {
      h = ((h << 5) + h) + str.charCodeAt(i);
      h |= 0;
    }
    return 't_' + Math.abs(h).toString(36);
  }
  get(text, source, target) {
    const key = this.hash(text, source, target);
    const entry = this.data[key];
    if (!entry) return null;
    if (Date.now() - entry.t > this.maxAge) {
      delete this.data[key]; delete this.meta[key];
      return null;
    }
    this.meta[key] = Date.now();
    return entry.v;
  }
  set(text, source, target, value) {
    const key = this.hash(text, source, target);
    const keys = Object.keys(this.data);
    if (keys.length >= this.maxSize) {
      let oldest = keys[0], oldestTime = this.meta[oldest] || 0;
      for (const k of keys) {
        const t = this.meta[k] || 0;
        if (t < oldestTime) { oldestTime = t; oldest = k; }
      }
      delete this.data[oldest]; delete this.meta[oldest];
    }
    this.data[key] = { v: value, t: Date.now() };
    this.meta[key] = Date.now();
    this.save();
  }
  load() { try { return JSON.parse(localStorage.getItem(this.key) || '{}'); } catch(e) { return {}; } }
  loadMeta() { try { return JSON.parse(localStorage.getItem(this.metaKey) || '{}'); } catch(e) { return {}; } }
  save() {
    try {
      localStorage.setItem(this.key, JSON.stringify(this.data));
      localStorage.setItem(this.metaKey, JSON.stringify(this.meta));
    } catch(e) { this.evictHalf(); }
  }
  evictHalf() {
    const keys = Object.keys(this.data);
    keys.sort((a, b) => (this.meta[a] || 0) - (this.meta[b] || 0));
    for (let i = 0; i < keys.length / 2; i++) {
      delete this.data[keys[i]]; delete this.meta[keys[i]];
    }
    this.save();
  }
  size() { return Object.keys(this.data).length; }
  clear() { this.data = {}; this.meta = {}; this.save(); }
}

// ======================= TRANSLATION PROVIDERS =======================
class LibreTranslateProvider {
  constructor() {
    this.name = 'LibreTranslate';
    this.mirrors = [
      'https://libretranslate.de',
      'https://translate.argosopentech.com',
      'https://libretranslate.pussthecat.org',
      'https://lt.vern.cc'
    ];
    this.mirrorIndex = 0;
    this.failures = 0;
    this.circuitOpen = false;
    this.circuitResetAt = 0;
    this.minDelay = 5000;
    this.lastRequestAt = 0;
  }
  get baseUrl() { return this.mirrors[this.mirrorIndex]; }
  async translate(text, targetLang, sourceLang) {
    if (this.circuitOpen && Date.now() < this.circuitResetAt) throw new Error('Circuit breaker open');
    this.circuitOpen = false;
    const elapsed = Date.now() - this.lastRequestAt;
    if (elapsed < this.minDelay) await this.sleep(this.minDelay - elapsed + Math.random() * 500);
    const url = `${this.baseUrl}/translate`;
    const body = {
      q: text.substring(0, 1000),
      source: sourceLang === 'Autodetect' ? 'auto' : sourceLang,
      target: targetLang,
      format: 'text'
    };
    try {
      this.lastRequestAt = Date.now();
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (resp.status === 429) { this.failures++; this.rotateMirror(); throw new Error('429'); }
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      this.failures = 0;
      return data.translatedText;
    } catch (e) {
      this.failures++;
      if (this.failures >= 5) { this.circuitOpen = true; this.circuitResetAt = Date.now() + 5 * 60 * 1000; }
      throw e;
    }
  }
  rotateMirror() {
    this.mirrorIndex = (this.mirrorIndex + 1) % this.mirrors.length;
    this.failures = Math.max(0, this.failures - 2);
    console.log(`[LibreTranslate] Rotated to: ${this.baseUrl}`);
  }
  sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
}

class MyMemoryProvider {
  constructor() {
    this.name = 'MyMemory';
    this.failures = 0;
    this.circuitOpen = false;
    this.circuitResetAt = 0;
    this.minDelay = 10000;
    this.lastRequestAt = 0;
  }
  async translate(text, targetLang, sourceLang) {
    if (this.circuitOpen && Date.now() < this.circuitResetAt) throw new Error('Circuit breaker open');
    this.circuitOpen = false;
    const elapsed = Date.now() - this.lastRequestAt;
    if (elapsed < this.minDelay) await this.sleep(this.minDelay - elapsed);
    const sl = sourceLang === 'Autodetect' ? 'Autodetect' : sourceLang;
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.substring(0, 350))}&langpair=${sl}|${targetLang}`;
    try {
      this.lastRequestAt = Date.now();
      const resp = await fetch(url);
      if (resp.status === 429) throw new Error('429');
      const data = await resp.json();
      if (data.responseData?.translatedText) { this.failures = 0; return data.responseData.translatedText; }
      throw new Error(data.responseDetails || 'Empty');
    } catch (e) {
      this.failures++;
      if (this.failures >= 3) { this.circuitOpen = true; this.circuitResetAt = Date.now() + 10 * 60 * 1000; }
      throw e;
    }
  }
  sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
}

class UserKeyProvider {
  constructor(type) {
    this.type = type;
    this.name = { google: 'Google Cloud', deepl: 'DeepL', azure: 'Azure Translator' }[type] || type;
    this.failures = 0;
    this.minDelay = 50;
    this.lastRequestAt = 0;
  }
  getKey() { try { return localStorage.getItem(`cm_api_key_${this.type}`) || ''; } catch(e) { return ''; } }
  hasKey() { return !!this.getKey(); }
  async translate(text, targetLang, sourceLang) {
    const key = this.getKey();
    if (!key) throw new Error('No API key');
    const elapsed = Date.now() - this.lastRequestAt;
    if (elapsed < this.minDelay) await this.sleep(this.minDelay - elapsed);
    this.lastRequestAt = Date.now();
    if (this.type === 'google') return this.translateGoogle(text, targetLang, sourceLang, key);
    if (this.type === 'deepl') return this.translateDeepL(text, targetLang, sourceLang, key);
    if (this.type === 'azure') return this.translateAzure(text, targetLang, sourceLang, key);
    throw new Error('Unknown provider');
  }
  async translateGoogle(text, targetLang, sourceLang, key) {
    const url = `https://translation.googleapis.com/language/translate/v2?key=${key}`;
    const body = { q: text, target: targetLang, format: 'text' };
    if (sourceLang !== 'Autodetect') body.source = sourceLang;
    const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!resp.ok) throw new Error(`Google HTTP ${resp.status}`);
    const data = await resp.json();
    return data.data.translations[0].translatedText;
  }
  async translateDeepL(text, targetLang, sourceLang, key) {
    const isFree = key.endsWith(':fx');
    const url = isFree ? 'https://api-free.deepl.com/v2/translate' : 'https://api.deepl.com/v2/translate';
    const body = new URLSearchParams({ text: text, target_lang: targetLang.toUpperCase() });
    if (sourceLang !== 'Autodetect') body.append('source_lang', sourceLang.toUpperCase());
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `DeepL-Auth-Key ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body
    });
    if (!resp.ok) throw new Error(`DeepL HTTP ${resp.status}`);
    const data = await resp.json();
    return data.translations[0].text;
  }
  async translateAzure(text, targetLang, sourceLang, key) {
    const region = localStorage.getItem('cm_api_key_azure_region') || 'global';
    let url = `https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&to=${targetLang}`;
    if (sourceLang !== 'Autodetect') url += `&from=${sourceLang}`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Ocp-Apim-Subscription-Region': region,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([{ Text: text }])
    });
    if (!resp.ok) throw new Error(`Azure HTTP ${resp.status}`);
    const data = await resp.json();
    return data[0].translations[0].text;
  }
  sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
}

// ======================= TRANSLATION ENGINE (Redesigned for 1M+ words) =======================
class TranslationEngine {
  constructor() {
    this.cache = new TranslationCache();
    this.stats = { translated: 0, cached: 0, failed: 0 };
    this.providers = [
      new LibreTranslateProvider(),
      new MyMemoryProvider(),
      new UserKeyProvider('google'),
      new UserKeyProvider('deepl'),
      new UserKeyProvider('azure')
    ];
    this.abortController = new AbortController();
  }
  get activeProviders() {
    return this.providers.filter(p => {
      if (p instanceof UserKeyProvider) return p.hasKey();
      return true;
    });
  }
  get bestProvider() {
    const active = this.activeProviders;
    const userKeys = active.filter(p => p instanceof UserKeyProvider);
    if (userKeys.length) return userKeys[0];
    const free = active.filter(p => !(p instanceof UserKeyProvider) && !p.circuitOpen);
    return free[0] || active[0];
  }
  get providerStatus() {
    return this.providers.map(p => ({
      name: p.name,
      available: p instanceof UserKeyProvider ? p.hasKey() : !p.circuitOpen,
      circuitOpen: p.circuitOpen || false,
      failures: p.failures || 0
    }));
  }
  async translate(text, targetLang = 'te', sourceLang = 'Autodetect') {
    if (!text || !text.trim()) return '';
    const cached = this.cache.get(text, sourceLang, targetLang);
    if (cached !== null) { this.stats.cached++; return cached; }
    const clean = TextSanitizer.cleanPDFText(text);
    const chunks = TextSanitizer.chunkForTranslation(clean, 400);
    const results = [];
    for (const chunk of chunks) {
      if (this.abortController.signal.aborted) throw new Error('Translation cancelled');
      const cc = this.cache.get(chunk, sourceLang, targetLang);
      if (cc !== null) { this.stats.cached++; results.push(cc); continue; }
      let translated = null, lastError = null;
      for (const provider of this.activeProviders) {
        if (provider.circuitOpen && Date.now() < provider.circuitResetAt) continue;
        try {
          translated = await provider.translate(chunk, targetLang, sourceLang);
          this.stats.translated++;
          break;
        } catch (e) {
          lastError = e.message;
          console.warn(`[Translate] ${provider.name} failed:`, e.message);
        }
      }
      if (translated === null) {
        console.warn('[Translate] All providers failed. Using original. Last error:', lastError);
        this.stats.failed++;
        translated = chunk;
      }
      this.cache.set(chunk, sourceLang, targetLang, translated);
      results.push(translated);
    }
    const result = results.join(' ');
    this.cache.set(text, sourceLang, targetLang, result);
    return result;
  }
  async translateBatch(lines, targetLang = 'te', sourceLang = 'Autodetect', onProgress = null) {
    const results = [];
    let cachedCount = 0;
    for (const line of lines) {
      if (this.cache.get(line, sourceLang, targetLang) !== null) cachedCount++;
    }
    const networkTotal = lines.length - cachedCount;
    let networkDone = 0;
    for (let i = 0; i < lines.length; i++) {
      if (this.abortController.signal.aborted) throw new Error('Translation cancelled');
      const r = await this.translate(lines[i], targetLang, sourceLang);
      results.push(r);
      if (this.cache.get(lines[i], sourceLang, targetLang) === r && cachedCount > 0) {
        // cached
      } else {
        networkDone++;
      }
      if (onProgress) onProgress(i + 1, lines.length, networkDone, networkTotal);
    }
    return results;
  }
  cancel() {
    this.abortController.abort();
    this.abortController = new AbortController();
  }
  clearCache() {
    this.cache.clear();
    this.stats = { translated: 0, cached: 0, failed: 0 };
  }
  getCacheStats() {
    return { size: this.cache.size(), ...this.stats };
  }
}

const Translator = new TranslationEngine();

// ======================= VOICE MANAGER (Fixed for Telugu) =======================
class VoiceManager {
  constructor() {
    this.synth = window.speechSynthesis;
    this.voices = [];
    this.ready = false;
    this.loadVoices();
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = () => this.loadVoices();
    }
    // Fallback load after 1s
    setTimeout(() => this.loadVoices(), 1000);
  }

  loadVoices() {
    this.voices = this.synth.getVoices() || [];
    if (this.voices.length) this.ready = true;
    console.log('[VoiceManager] Loaded', this.voices.length, 'voices');
  }

  getVoicesForLang(lang) {
    if (!this.ready) this.loadVoices();
    const langMap = { te: ['te','hi'], hi: ['hi','te'], sa: ['hi','sa'], ta: ['ta'], kn: ['kn'], ml: ['ml'], bn: ['bn'], en: ['en'] };
    const codes = langMap[lang] || [lang, 'en'];
    for (const code of codes) {
      const found = this.voices.filter(v => v.lang && v.lang.toLowerCase().startsWith(code));
      if (found.length) return found;
    }
    return this.voices.filter(v => v.lang && v.lang.toLowerCase().startsWith('en'));
  }

  hasVoiceForLang(lang) {
    return this.getVoicesForLang(lang).length > 0;
  }

  getBestVoice(lang) {
    const candidates = this.getVoicesForLang(lang);
    // Prefer non-local, clear voices (Google, Microsoft, Apple)
    const preferred = candidates.find(v => 
      /Google|Microsoft|Apple|Premium|Enhanced/i.test(v.name)
    );
    return preferred || candidates[0] || null;
  }

  speak(text, characterInfo, lang = 'te') {
    if (!this.synth) return null;
    this.synth.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.pitch = Math.max(0.1, Math.min(2.0, characterInfo.pitch || 1.0));
    utter.rate = Math.max(0.1, Math.min(2.0, characterInfo.rate || 1.0));
    utter.volume = 1.0;

    const voice = this.getBestVoice(lang);
    if (voice) {
      utter.voice = voice;
      utter.lang = voice.lang;
    } else {
      // Fallback lang code
      const langCodes = { te: 'te-IN', hi: 'hi-IN', sa: 'hi-IN', ta: 'ta-IN', kn: 'kn-IN', ml: 'ml-IN', bn: 'bn-IN', en: 'en-US' };
      utter.lang = langCodes[lang] || 'en-US';
    }
    this.synth.speak(utter);
    return utter;
  }
}

// ======================= CHARACTER VOICE MAPPER =======================
class CharacterVoiceMapper {
  constructor() {
    this.map = {};
    this.voiceManager = new VoiceManager();
  }

  assign(characterName, type = 'narrator') {
    const cfg = CONFIG.voices[type] || CONFIG.voices.narrator;
    this.map[characterName] = { name: characterName, type, ...cfg, emoji: this.emojiForType(type) };
    return this.map[characterName];
  }

  emojiForType(type) {
    const map = { kidBoy:'👦', kidGirl:'👧', adultMale:'👨', adultFemale:'👩', elderMale:'👴', elderFemale:'👵', oldMale:'🧓', oldFemale:'👵', animal:'🐾', narrator:'🌙' };
    return map[type] || '👤';
  }

  detectTypeFromName(name) {
    const n = name.toLowerCase();
    if (/\b(boy|son|kid|child|bala|balu|రాజు|బాలుడు|बालक|लड़का)\b/.test(n)) return 'kidBoy';
    if (/\b(girl|daughter|kid|child|bala|రాణి|బాలిక|बालिका|लड़की)\b/.test(n)) return 'kidGirl';
    if (/\b(old man|grandfather|thatha|తాతయ్య|ముసలి|వృద్ధ|वृद्ध|बुज़ुर्ग)\b/.test(n)) return 'oldMale';
    if (/\b(old woman|grandmother|paati|నానమ్మ|ముసలి|వృద్ధ|वृद्धा)\b/.test(n)) return 'oldFemale';
    if (/\b(elder|uncle|mama|గురువు|పెద్ద|गुरु|अंकल)\b/.test(n)) return 'elderMale';
    if (/\b(elder|aunty|amma|పెద్ద|मासी|आंटी)\b/.test(n)) return 'elderFemale';
    if (/\b(animal|dog|cat|bird|lion|fox|తోడు|నక్క|సింహం|ఏనుగ|शेर|कुत्ता|बिल्ली|पक्षी|सर्प)\b/.test(n)) return 'animal';
    if (/\b(queen|princess|wife|mother|sister|అమ్మ|అక్క|భార్య|రాణి|रानी|माँ|बहन|पत्नी)\b/.test(n)) return 'adultFemale';
    if (/\b(king|prince|husband|father|brother|నాన్న|అన్న|భర్త|రాజు|राजा|पिता|भाई|पति)\b/.test(n)) return 'adultMale';
    return 'narrator';
  }

  autoAssign(characters) {
    characters.forEach(c => this.assign(c, this.detectTypeFromName(c)));
  }

  speak(text, characterName, lang = 'te') {
    const info = this.map[characterName] || this.map['Narrator'] || { pitch: 1, rate: 1, emoji: '🌙' };
    return this.voiceManager.speak(text, info, lang);
  }
}

// ======================= THEATER ENGINE (Fixed) =======================
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
        <div class="theater-voice-status" id="voiceStatus" style="font-size:0.75rem;color:rgba(255,200,100,0.7);margin-top:8px;"></div>
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

    // Show voice availability warning
    const hasVoice = this.voiceMapper.voiceManager.hasVoiceForLang(lang);
    const statusEl = document.getElementById('voiceStatus');
    if (statusEl) {
      if (!hasVoice) {
        statusEl.innerHTML = '⚠️ No ' + lang.toUpperCase() + ' voice found. Install a ' + lang.toUpperCase() + ' language pack in your OS, or audio will sound like numbers/gibberish.';
      } else {
        const v = this.voiceMapper.voiceManager.getBestVoice(lang);
        statusEl.textContent = '🎙️ Using voice: ' + (v ? v.name : 'default');
      }
    }
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
      this.utterance.onerror = (e) => {
        console.warn('[Theater] Speech error:', e.error);
        if (this.isPlaying && !this.isPaused) {
          this.autoTimer = setTimeout(() => this.nextLine(), 1200);
        }
      };
    }
  }

  play() {
    if (!this.script.length) return;
    // Warn if text is not in target script
    const line = this.script[this.currentLine];
    const isTargetScript = this.lang === 'te' ? /[\u0C00-\u0C7F]/.test(line.text) : true;
    if (!isTargetScript) {
      const status = document.getElementById('voiceStatus');
      if (status) status.innerHTML = '⚠️ Text appears untranslated. Click "Translate" first for proper audio.';
    }
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
      this.renderLine(this.currentLine);
      if (this.isPlaying && !this.isPaused) this.speakLine(this.currentLine);
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
    document.getElementById('charLine').textContent = '🎭 Episode Complete!';
    document.getElementById('charLine').style.color = '#F4D03F';
  }
  updatePlayBtn() {
    const btn = document.getElementById('theaterPlayBtn');
    if (btn) btn.textContent = (this.isPlaying && !this.isPaused) ? '⏸' : '▶';
  }
  updateTime() {
    document.getElementById('theaterCur').textContent = this.currentLine + 1;
    document.getElementById('theaterDur').textContent = this.script.length;
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

// ======================= PDF PROCESSOR =======================
class PDFStoryExtractor {
  constructor() {
    this.stories = [];
  }
  async loadPDF(arrayBuffer) {
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
  detectStories(pages) {
    const stories = [];
    let current = { title: 'Story 1', pages: [], text: '', sentences: [] };
    pages.forEach((p) => {
      const sentences = TextSanitizer.splitIntoSentences(p.text);
      if (sentences.length === 0) return;
      const first = sentences[0];
      const isTitle = /^\d+[.\)]?\s*[A-Z\u0900-\u097F\u0C00-\u0C7F]/.test(first) ||
                      /^(Chapter|Story|Katha|కథ|అధ్యాయం|भाग|कथा|अध्याय)/i.test(first) ||
                      (first.length < 60 && first.length > 5);
      if (isTitle && current.sentences.length > 2) {
        stories.push(current);
        current = { title: first, pages: [p.pageNum], text: p.text, sentences };
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

// ======================= MAIN APP =======================
class ChandamamaApp {
  constructor() {
    this.lang = 'te';
    this.pages = [];
    this.stories = [];
    this.currentStory = null;
    this.init();
  }

  init() {
    this.bindEvents();
    this.renderLanguageCards();
    this.setLanguage('te');
    this.renderSettings();
    this.renderSettingsButton();
  }

  bindEvents() {
    const pdfInput = document.getElementById('pdfInput');
    if (pdfInput) pdfInput.addEventListener('change', (e) => this.handlePDF(e.target.files[0]));
    const dropZone = document.getElementById('pdfDropZone');
    if (dropZone) {
      dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
      dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
      dropZone.addEventListener('drop', (e) => {
        e.preventDefault(); dropZone.classList.remove('dragover');
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
      this.pages = await (new PDFStoryExtractor()).loadPDF(arrayBuffer);
      this.stories = await (new PDFStoryExtractor()).detectStories(this.pages);
      this.renderStorySelector();
      if (status) status.textContent = `Found ${this.pages.length} pages, ${this.stories.length} stories, ${this.stories.reduce((a,s)=>a+(s.sentences?.length||0),0)} lines.`;
    } catch (e) {
      console.error(e);
      if (status) status.textContent = 'Error: ' + e.message;
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
            <div class="story-title">${this.escapeHtml(s.title || 'Story ' + (i+1))}</div>
            <div class="story-meta">Pages ${s.pages[0]}–${s.pages[s.pages.length-1]} · ${s.sentences?.length || 0} lines</div>
          </div>
        `).join('')}
      </div>
      <div style="margin-top:12px;text-align:center;">
        <button class="btn-primary" onclick="app.translateAllStories()">🌐 Translate ALL Stories to ${this.lang.toUpperCase()}</button>
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
    document.querySelectorAll('.story-card').forEach((c, i) => c.classList.toggle('active', i === index));
    this.showStoryEditor();
  }

  showStoryEditor() {
    const editor = document.getElementById('storyEditor');
    if (!editor || !this.currentStory) return;
    const sentences = this.currentStory.sentences || [];
    const lines = sentences.map((text, i) => {
      let speaker = 'Narrator';
      let lineText = text;
      const quoteMatch = text.match(/^["""'](.+)["""']\s*(.*)/);
      if (quoteMatch) {
        lineText = quoteMatch[1];
        const after = quoteMatch[2];
        const saidMatch = after.match(/(?:said|cried|asked|replied|అన్నాడు|అన్నది|चेप्प|अनौ)\s+(\w+)/i);
        if (saidMatch) speaker = saidMatch[1];
      }
      const colonMatch = text.match(/^(\w+[\s\w]*)[:：]\s*(.+)/);
      if (colonMatch) { speaker = colonMatch[1].trim(); lineText = colonMatch[2].trim(); }
      return { id: i, speaker, text: lineText, original: text };
    }).filter(l => l.text.length > 3);
    this.currentStory.lines = lines;

    editor.innerHTML = `
      <h3>🎭 Drama Cast & Lines (${lines.length} lines)</h3>
      <div class="cast-editor" id="castEditor"></div>
      <div class="lines-editor">
        <div class="lines-header">
          <span>#</span><span>Character</span><span>Voice Type</span><span>Dialogue</span>
        </div>
        <div class="lines-list" id="linesList">
          ${lines.slice(0, 100).map((l, i) => `
            <div class="line-row" data-idx="${i}">
              <span class="line-num">${i+1}</span>
              <input class="line-speaker" value="${this.escapeHtml(l.speaker)}" onchange="app.updateSpeaker(${i}, this.value)">
              <select class="line-voice" onchange="app.updateVoice(${i}, this.value)">
                ${Object.entries(CONFIG.voices).map(([k,v]) => `<option value="${k}">${v.label}</option>`).join('')}
              </select>
              <input class="line-text" value="${this.escapeHtml(l.text)}" onchange="app.updateText(${i}, this.value)">
            </div>
          `).join('')}
          ${lines.length > 100 ? `<div style="text-align:center;padding:10px;color:rgba(255,255,255,0.5);">... and ${lines.length - 100} more lines ...</div>` : ''}
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
            ${Object.entries(CONFIG.voices).map(([k,v]) => `<option value="${k}" ${k===info.type?'selected':''}>${v.label}</option>`).join('')}
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
    const statsBefore = Translator.getCacheStats();
    try {
      const translated = await Translator.translateBatch(texts, this.lang, 'Autodetect', (done, total, netDone, netTotal) => {
        if (fill) fill.style.width = (done / total * 100) + '%';
        if (textDiv) {
          const prov = Translator.bestProvider?.name || '...';
          textDiv.textContent = `Translating ${done}/${total} lines... Provider: ${prov} | Network: ${netDone}/${netTotal} | Cache: ${Translator.stats.cached}`;
        }
      });
      this.currentStory.lines.forEach((l, i) => { l.translated = translated[i]; });
      const statsAfter = Translator.getCacheStats();
      if (textDiv) {
        textDiv.innerHTML = this.currentStory.lines.slice(0, 50).map((l, i) => 
          `<div class="trans-line"><b>${this.escapeHtml(l.speaker)}:</b> ${this.escapeHtml(l.translated || l.text)}</div>`
        ).join('') + (this.currentStory.lines.length > 50 ? `<div style="color:rgba(255,255,255,0.5)">... ${this.currentStory.lines.length - 50} more lines ...</div>` : '') +
        `<div style="margin-top:8px;color:#4ade80;font-size:12px;">✓ Done. Cache: ${statsAfter.size} entries (${statsAfter.cached} hits, ${statsAfter.translated} new, ${statsAfter.failed} fails)</div>`;
      }
    } catch (e) {
      if (textDiv) textDiv.innerHTML = `<div style="color:#f87171;">Translation stopped: ${e.message}</div>`;
    }
    if (fill) fill.style.width = '100%';
  }

  async translateAllStories() {
    const status = document.getElementById('pdfStatus');
    const totalLines = this.stories.reduce((a, s) => a + (s.sentences?.length || 0), 0);
    if (totalLines > 5000) {
      const hasKey = Translator.activeProviders.some(p => p instanceof UserKeyProvider);
      if (!hasKey) {
        const go = confirm(`WARNING: You are about to translate ~${totalLines} lines without a paid API key. Free providers will rate-limit heavily and this may take hours or fail entirely.\n\nFor 1M+ words, you MUST add a Google Cloud, DeepL, or Azure API key in Settings.\n\nClick OK to proceed anyway (very slow), or Cancel to open Settings.`);
        if (!go) { this.openSettings(); return; }
      }
    }
    if (status) status.textContent = `Translating ${this.stories.length} stories (~${totalLines} lines)...`;
    Translator.cancel();
    for (let i = 0; i < this.stories.length; i++) {
      this.currentStory = this.stories[i];
      if (!this.currentStory.lines) {
        const sentences = this.currentStory.sentences || [];
        this.currentStory.lines = sentences.map(text => ({ speaker: 'Narrator', text, original: text }));
      }
      const texts = this.currentStory.lines.map(l => l.text);
      try {
        const translated = await Translator.translateBatch(texts, this.lang, 'Autodetect', (done, total) => {
          if (status) status.textContent = `Story ${i+1}/${this.stories.length}: ${this.currentStory.title} — line ${done}/${total}`;
        });
        this.currentStory.lines.forEach((l, idx) => { l.translated = translated[idx]; });
      } catch (e) {
        if (status) status.textContent = `Stopped at story ${i+1}: ${e.message}`;
        return;
      }
    }
    if (status) status.textContent = `All ${this.stories.length} stories translated! Cache: ${Translator.getCacheStats().size} entries`;
    this.renderStorySelector();
  }

  openTheater() {
    if (!this.currentStory || !this.currentStory.lines.length) return;
    const hasTranslation = this.currentStory.lines[0].translated;
    if (!hasTranslation) {
      const go = confirm('Text is not yet translated to ' + this.lang.toUpperCase() + '. Theater will speak in the original language (which may sound like gibberish if your browser lacks that voice).\n\nClick OK to translate first, or Cancel to play original.');
      if (go) { this.translateStory(); return; }
    }
    const script = this.currentStory.lines.map(l => ({
      speaker: l.speaker,
      text: hasTranslation ? l.translated : l.text
    }));
    window.theater.loadScript(script, this.lang);
    window.theater.open();
    window.theater.play();
  }

  renderSettings() {
    const existing = document.getElementById('cmSettingsPanel');
    if (existing) return;
    const panel = document.createElement('div');
    panel.id = 'cmSettingsPanel';
    panel.style.cssText = 'display:none;position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#1e1b4b;border:1px solid #4c1d95;border-radius:12px;padding:24px;max-width:420px;width:90%;z-index:10000;color:#fff;box-shadow:0 20px 60px rgba(0,0,0,0.6);font-family:sans-serif;';
    panel.innerHTML = `
      <h3 style="margin:0 0 16px;color:#c084fc;">⚙️ Translation Settings</h3>
      <p style="font-size:12px;color:#a78bfa;margin:0 0 12px;">For 1,000+ lines, add a paid API key. Free providers rate-limit heavily.</p>
      <div style="margin-bottom:12px;">
        <label style="display:block;font-size:11px;color:#c4b5fd;margin-bottom:4px;">Google Cloud API Key</label>
        <input type="password" id="cmKeyGoogle" placeholder="AIza..." style="width:100%;padding:8px;border-radius:6px;border:1px solid #4c1d95;background:#0f0a1e;color:#fff;font-size:13px;">
      </div>
      <div style="margin-bottom:12px;">
        <label style="display:block;font-size:11px;color:#c4b5fd;margin-bottom:4px;">DeepL API Key</label>
        <input type="password" id="cmKeyDeepL" placeholder="DeepL-Auth-Key ..." style="width:100%;padding:8px;border-radius:6px;border:1px solid #4c1d95;background:#0f0a1e;color:#fff;font-size:13px;">
      </div>
      <div style="margin-bottom:12px;">
        <label style="display:block;font-size:11px;color:#c4b5fd;margin-bottom:4px;">Azure Translator Key</label>
        <input type="password" id="cmKeyAzure" placeholder="..." style="width:100%;padding:8px;border-radius:6px;border:1px solid #4c1d95;background:#0f0a1e;color:#fff;font-size:13px;">
      </div>
      <div style="margin-bottom:12px;">
        <label style="display:block;font-size:11px;color:#c4b5fd;margin-bottom:4px;">Azure Region (e.g. global, westus2)</label>
        <input type="text" id="cmKeyAzureRegion" placeholder="global" style="width:100%;padding:8px;border-radius:6px;border:1px solid #4c1d95;background:#0f0a1e;color:#fff;font-size:13px;">
      </div>
      <div style="margin-bottom:16px;">
        <div style="font-size:11px;color:#c4b5fd;margin-bottom:4px;">Provider Status</div>
        <div id="cmProviderStatus" style="font-size:12px;color:#a78bfa;line-height:1.6;"></div>
      </div>
      <div style="display:flex;gap:8px;">
        <button onclick="app.saveSettings()" style="flex:1;padding:10px;background:#7c3aed;border:none;border-radius:6px;color:#fff;cursor:pointer;font-weight:600;">Save Keys</button>
        <button onclick="app.clearCache()" style="padding:10px;background:#374151;border:none;border-radius:6px;color:#fff;cursor:pointer;">Clear Cache</button>
        <button onclick="document.getElementById('cmSettingsPanel').style.display='none'" style="padding:10px;background:#374151;border:none;border-radius:6px;color:#fff;cursor:pointer;">Close</button>
      </div>
    `;
    document.body.appendChild(panel);
    this.loadSettings();
  }

  renderSettingsButton() {
    const btn = document.createElement('button');
    btn.textContent = '⚙️ Settings';
    btn.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:9999;padding:10px 16px;background:#7c3aed;border:none;border-radius:8px;color:#fff;cursor:pointer;font-weight:600;box-shadow:0 4px 12px rgba(0,0,0,0.3);';
    btn.onclick = () => this.openSettings();
    document.body.appendChild(btn);
  }

  openSettings() {
    const panel = document.getElementById('cmSettingsPanel');
    if (panel) { this.updateProviderStatusUI(); panel.style.display = 'block'; }
  }

  updateProviderStatusUI() {
    const div = document.getElementById('cmProviderStatus');
    if (!div) return;
    const status = Translator.providerStatus;
    div.innerHTML = status.map(s => {
      const color = s.available ? '#4ade80' : '#f87171';
      const note = s.circuitOpen ? ' (circuit open)' : '';
      return `<div>● <span style="color:${color}">${s.name}</span>${note} — fails: ${s.failures}</div>`;
    }).join('');
  }

  loadSettings() {
    const g = localStorage.getItem('cm_api_key_google') || '';
    const d = localStorage.getItem('cm_api_key_deepl') || '';
    const a = localStorage.getItem('cm_api_key_azure') || '';
    const r = localStorage.getItem('cm_api_key_azure_region') || 'global';
    const elG = document.getElementById('cmKeyGoogle');
    const elD = document.getElementById('cmKeyDeepL');
    const elA = document.getElementById('cmKeyAzure');
    const elR = document.getElementById('cmKeyAzureRegion');
    if (elG) elG.value = g;
    if (elD) elD.value = d;
    if (elA) elA.value = a;
    if (elR) elR.value = r;
  }

  saveSettings() {
    const g = document.getElementById('cmKeyGoogle')?.value.trim() || '';
    const d = document.getElementById('cmKeyDeepL')?.value.trim() || '';
    const a = document.getElementById('cmKeyAzure')?.value.trim() || '';
    const r = document.getElementById('cmKeyAzureRegion')?.value.trim() || 'global';
    if (g) localStorage.setItem('cm_api_key_google', g); else localStorage.removeItem('cm_api_key_google');
    if (d) localStorage.setItem('cm_api_key_deepl', d); else localStorage.removeItem('cm_api_key_deepl');
    if (a) localStorage.setItem('cm_api_key_azure', a); else localStorage.removeItem('cm_api_key_azure');
    localStorage.setItem('cm_api_key_azure_region', r);
    this.updateProviderStatusUI();
    alert('Settings saved. Paid providers will now be used.');
  }

  clearCache() {
    Translator.clearCache();
    this.updateProviderStatusUI();
    alert('Translation cache cleared.');
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  downloadScript() {
    if (!this.currentStory) return;
    const data = { title: this.currentStory.title, language: this.lang, lines: this.currentStory.lines };
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
