// Chandamama v3.1 — Fixed: Progress bars, Translate-All, Telugu Audio, PDF Integration
/* ============================================================
   Chandamama Podcast Theater — Fixed v3.1
   Fixes:
   1. Translate-All progress bar now tracks cumulative progress accurately
   2. Translate-Selected-Story gets a full-screen overlay progress
   3. Telugu (TE) audio: utter.lang set to te-IN regardless of voice fallback
   4. PDF stories auto-parse lines before translate-all
   5. Theater warns when no native voice is available
   6. Story selector shows translation status badges
   ============================================================ */

const CONFIG = {
  translateApi: 'https://api.mymemory.translated.net/get',
  translateDelay: 1200,
  translateCacheKey: 'cm_translate_cache_v31',
  maxRetries: 3,
  maxChunkLength: 350,
  maxLineLength: 2000,
  voices: {
    kidBoy: { pitch: 1.45, rate: 1.15, label: '👦 Kid Boy' },
    kidGirl: { pitch: 1.55, rate: 1.10, label: '👧 Kid Girl' },
    adultMale: { pitch: 0.95, rate: 1.00, label: '👨 Adult Male' },
    adultFemale:{ pitch: 1.15, rate: 1.00, label: '👩 Adult Female' },
    elderMale: { pitch: 0.75, rate: 0.88, label: '👴 Elder Male' },
    elderFemale:{ pitch: 0.88, rate: 0.90, label: '👵 Elder Female' },
    oldMale: { pitch: 0.65, rate: 0.80, label: '🧓 Old Age Male' },
    oldFemale: { pitch: 0.78, rate: 0.82, label: '👵 Old Age Female' },
    animal: { pitch: 1.35, rate: 1.25, label: '🐾 Animal' },
    narrator: { pitch: 1.00, rate: 0.95, label: '🌙 Narrator' }
  }
};

// ======================= TEXT SANITIZER =======================
class TextSanitizer {
  static cleanPDFText(text) {
    if (!text) return '';
    let t = String(text);
    t = t.replace(/---\s*PAGE\s*\d+\s*---/gi, '\n');
    t = t.replace(/\b\d{5,}\s*[\-/]\s*\d{5,}\b/g, ' ');
    t = t.replace(/\bRs\.?\s*\d+[\.,]?\d*\b/gi, ' ');
    t = t.replace(/\b\d+\s*(?:€|\$|£|¥)\b/g, ' ');
    t = t.replace(/[#@^*~+=|\\{}[\]_<>]{2,}/g, ' ');
    t = t.replace(/\b\d{4,}\b/g, ' ');
    const lines = t.split(/\n+/);
    const cleanLines = lines.filter(line => {
      const trimmed = line.trim();
      if (trimmed.length < 4) return false;
      const letterPattern = /[\u0900-\u097F\u0C00-\u0C7F\u0B80-\u0BFF\u0D00-\u0D7F\u0980-\u09FF\u0A80-\u0AFFa-zA-Z]/g;
      const alphaCount = (trimmed.match(letterPattern) || []).length;
      const total = trimmed.length;
      const ratio = alphaCount / total;
      return ratio > 0.20 || (total < 60 && alphaCount > 5);
    });
    t = cleanLines.join('\n');
    t = t.replace(/\s+/g, ' ').trim();
    t = t.replace(/[.]{3,}/g, '…');
    return t;
  }

  static splitIntoSentences(text) {
    if (!text) return [];
    const sentences = text
      .replace(/([।॥.!?])\s+/g, "$1\n")
      .split(/\n+/)
      .map(s => s.trim())
      .filter(s => s.length > 5);
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

// ======================= TRANSLATION CACHE =======================
class TranslationCache {
  constructor(maxSize = 5000, maxAgeDays = 30) {
    this.key = 'cm_translate_cache_v31';
    this.metaKey = 'cm_translate_cache_meta_v31';
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
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

class GoogleTranslateFreeProvider {
  constructor() {
    this.name = 'GoogleTranslateFree';
    this.failures = 0;
    this.circuitOpen = false;
    this.circuitResetAt = 0;
    this.minDelay = 600;
    this.lastRequestAt = 0;
    this.maxRetries = 3;
  }
  async translate(text, targetLang, sourceLang) {
    if (this.circuitOpen && Date.now() < this.circuitResetAt) throw new Error('Circuit breaker open');
    this.circuitOpen = false;
    const sl = sourceLang === 'Autodetect' ? 'auto' : sourceLang;
    const q = encodeURIComponent(text.substring(0, 1800));
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${targetLang}&dt=t&q=${q}`;
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      const elapsed = Date.now() - this.lastRequestAt;
      const wait = this.minDelay * (attempt + 1) + Math.random() * 300;
      if (elapsed < wait) await sleep(wait - elapsed);
      try {
        this.lastRequestAt = Date.now();
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        if (!data || !Array.isArray(data[0]) || data[0].length === 0) throw new Error('Empty response');
        const result = data[0].map(item => item[0]).join('');
        if (!result || result.trim() === text.trim()) throw new Error('Same text returned');
        this.failures = 0;
        return result;
      } catch (e) {
        console.warn(`[GoogleTranslateFree] Attempt ${attempt + 1} failed:`, e.message);
        if (attempt === this.maxRetries - 1) {
          this.failures++;
          if (this.failures >= 6) { this.circuitOpen = true; this.circuitResetAt = Date.now() + 3 * 60 * 1000; }
          throw e;
        }
      }
    }
  }
}

class LingvaProvider {
  constructor() {
    this.name = 'Lingva';
    this.failures = 0;
    this.circuitOpen = false;
    this.circuitResetAt = 0;
    this.minDelay = 800;
    this.lastRequestAt = 0;
    this.maxRetries = 2;
  }
  async translate(text, targetLang, sourceLang) {
    if (this.circuitOpen && Date.now() < this.circuitResetAt) throw new Error('Circuit breaker open');
    this.circuitOpen = false;
    const sl = sourceLang === 'Autodetect' ? 'auto' : sourceLang;
    const q = encodeURIComponent(text.substring(0, 1200));
    const url = `https://lingva.ml/api/v1/${sl}/${targetLang}/${q}`;
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      const elapsed = Date.now() - this.lastRequestAt;
      const wait = this.minDelay * (attempt + 1) + Math.random() * 300;
      if (elapsed < wait) await sleep(wait - elapsed);
      try {
        this.lastRequestAt = Date.now();
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        if (!data || !data.translation) throw new Error('Empty response');
        if (data.translation.trim() === text.trim()) throw new Error('Same text returned');
        this.failures = 0;
        return data.translation;
      } catch (e) {
        console.warn(`[Lingva] Attempt ${attempt + 1} failed:`, e.message);
        if (attempt === this.maxRetries - 1) {
          this.failures++;
          if (this.failures >= 5) { this.circuitOpen = true; this.circuitResetAt = Date.now() + 4 * 60 * 1000; }
          throw e;
        }
      }
    }
  }
}

class MyMemoryProvider {
  constructor() {
    this.name = 'MyMemory';
    this.failures = 0;
    this.circuitOpen = false;
    this.circuitResetAt = 0;
    this.minDelay = 10000;
    this.lastRequestAt = 0;
    this.email = 'user@example.com';
  }
  async translate(text, targetLang, sourceLang) {
    if (this.circuitOpen && Date.now() < this.circuitResetAt) throw new Error('Circuit breaker open');
    this.circuitOpen = false;
    const elapsed = Date.now() - this.lastRequestAt;
    if (elapsed < this.minDelay) await sleep(this.minDelay - elapsed);
    const sl = sourceLang === 'Autodetect' ? 'Autodetect' : sourceLang;
    const q = encodeURIComponent(text.substring(0, 300));
    const url = `https://api.mymemory.translated.net/get?q=${q}&langpair=${sl}|${targetLang}&de=${encodeURIComponent(this.email)}`;
    try {
      this.lastRequestAt = Date.now();
      const resp = await fetch(url);
      if (resp.status === 429) throw new Error('429');
      const data = await resp.json();
      if (data.responseData?.translatedText) {
        const t = data.responseData.translatedText;
        if (t && t.trim() !== text.trim()) { this.failures = 0; return t; }
        throw new Error('Same text returned');
      }
      throw new Error(data.responseDetails || 'Empty');
    } catch (e) {
      this.failures++;
      if (this.failures >= 3) { this.circuitOpen = true; this.circuitResetAt = Date.now() + 10 * 60 * 1000; }
      throw e;
    }
  }
}

class LibreTranslateProvider {
  constructor() {
    this.name = 'LibreTranslate';
    this.mirrors = [
      'https://libretranslate.de',
      'https://translate.argosopentech.com',
      'https://libretranslate.pussthecat.org',
      'https://lt.vern.cc',
      'https://libretranslate.eownerdead.dedyn.io'
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
    if (elapsed < this.minDelay) await sleep(this.minDelay - elapsed + Math.random() * 1000);
    const url = `${this.baseUrl}/translate`;
    const body = { q: text.substring(0, 800), source: sourceLang === 'Autodetect' ? 'auto' : sourceLang, target: targetLang, format: 'text' };
    try {
      this.lastRequestAt = Date.now();
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(body)
      });
      if (resp.status === 429) { this.failures++; this.rotateMirror(); throw new Error('429'); }
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      if (!data.translatedText || data.translatedText.trim() === text.trim()) throw new Error('Same text returned');
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
    if (elapsed < this.minDelay) await sleep(this.minDelay - elapsed);
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
      body
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
}

// ======================= TRANSLATION MANAGER =======================
class TranslationManager {
  constructor() {
    this.cache = new TranslationCache();
    this.stats = { translated: 0, cached: 0, failed: 0 };
    this.providers = [
      new GoogleTranslateFreeProvider(),
      new LingvaProvider(),
      new MyMemoryProvider(),
      new LibreTranslateProvider(),
      new UserKeyProvider('google'),
      new UserKeyProvider('deepl'),
      new UserKeyProvider('azure')
    ];
    this.abortController = new AbortController();
  }

  get activeProviders() {
    return this.providers.filter(p => {
      if (p instanceof UserKeyProvider) return p.hasKey();
      return !(p.circuitOpen && Date.now() < p.circuitResetAt);
    });
  }

  get providerStatus() {
    return this.getStatus();
  }

  get bestProvider() {
    const free = this.activeProviders.find(p => !(p instanceof UserKeyProvider));
    return free || this.activeProviders[0] || null;
  }

  getStatus() {
    return this.providers.map(p => ({
      name: p.name,
      available: p instanceof UserKeyProvider ? p.hasKey() : !p.circuitOpen,
      circuitOpen: p.circuitOpen || false,
      failures: p.failures || 0
    }));
  }

  isValidCache(text, sourceLang, targetLang) {
    const cached = this.cache.get(text, sourceLang, targetLang);
    if (cached === null) return false;
    if (cached.trim() === text.trim()) return false;
    return true;
  }

  async translate(text, targetLang = 'te', sourceLang = 'Autodetect', force = false) {
    if (!text || !text.trim()) return '';
    if (!force && this.isValidCache(text, sourceLang, targetLang)) {
      this.stats.cached++;
      return this.cache.get(text, sourceLang, targetLang);
    }

    const clean = TextSanitizer.cleanPDFText(text);
    const chunks = TextSanitizer.chunkForTranslation(clean, 400);
    const results = [];

    for (const chunk of chunks) {
      if (this.abortController.signal.aborted) throw new Error('Translation cancelled');
      if (!force && this.isValidCache(chunk, sourceLang, targetLang)) {
        this.stats.cached++;
        results.push(this.cache.get(chunk, sourceLang, targetLang));
        continue;
      }

      let translated = null, lastError = null;
      for (const provider of this.activeProviders) {
        try {
          translated = await provider.translate(chunk, targetLang, sourceLang);
          if (translated && translated.trim() !== chunk.trim()) {
            this.stats.translated++;
            break;
          }
          throw new Error('Returned same text');
        } catch (e) {
          lastError = e.message;
          console.warn(`[Translate] ${provider.name} failed:`, e.message);
        }
      }

      if (translated === null || translated.trim() === chunk.trim()) {
        console.warn('[Translate] All providers failed. Using original. Last error:', lastError);
        this.stats.failed++;
        translated = chunk;
        results.push(translated);
        continue;
      }

      this.cache.set(chunk, sourceLang, targetLang, translated);
      results.push(translated);
    }

    const result = results.join(' ');
    if (result.trim() !== clean.trim()) {
      this.cache.set(text, sourceLang, targetLang, result);
    }
    return result;
  }

  async translateBatch(lines, targetLang = 'te', sourceLang = 'Autodetect', onProgress = null, force = false) {
    const results = [];
    let cachedCount = 0;
    for (const line of lines) {
      if (this.isValidCache(line, sourceLang, targetLang)) cachedCount++;
    }
    const networkTotal = lines.length - cachedCount;
    let networkDone = 0;

    for (let i = 0; i < lines.length; i++) {
      if (this.abortController.signal.aborted) throw new Error('Translation cancelled');
      const r = await this.translate(lines[i], targetLang, sourceLang, force);
      results.push(r);
      const wasCached = this.isValidCache(lines[i], sourceLang, targetLang);
      if (!wasCached) networkDone++;
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

const Translator = new TranslationManager();

// ======================= THEATER / AUDIO PLAYER =======================
class VoiceMapper {
  constructor() {
    this.map = {};
    this.emojiMap = {
      narrator: '🌙', hero: '⚔️', heroine: '✨', villain: '🐍',
      king: '👑', queen: '👸', sage: '📿', child: '🧒',
      demon: '👹', guard: '🛡️', farmer: '🌾', merchant: '💰',
      woman: '👩', man: '👨', bird: '🐦', animal: '🐾'
    };
  }
  autoAssign(chars) {
    chars.forEach((c, i) => {
      if (!this.map[c]) {
        const types = Object.keys(this.emojiMap);
        const type = types[i % types.length];
        this.map[c] = { type, emoji: this.emojiMap[type] };
      }
    });
  }
  assign(name, type) {
    this.map[name] = { type, emoji: this.emojiMap[type] || '👤' };
  }
}

class Theater {
  constructor() {
    this.voiceMapper = new VoiceMapper();
    this.script = null;
    this.lang = 'en';
    this.isPlaying = false;
    this.currentIndex = 0;
    this.voices = [];
    this.loadVoices();
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = () => this.loadVoices();
    }
  }

  loadVoices() {
    this.voices = speechSynthesis.getVoices() || [];
  }

  getVoiceForLang(lang) {
    this.loadVoices();
    const langCode = lang.toLowerCase();

    // Primary: exact language code match
    let v = this.voices.find(vx => vx.lang.toLowerCase().startsWith(langCode));
    if (v) return v;

    // For Telugu, also try broader matches
    if (langCode === 'te') {
      v = this.voices.find(vx => vx.lang.toLowerCase().includes('telugu') || vx.lang.toLowerCase().includes('te-'));
      if (v) return v;
      v = this.voices.find(vx => vx.lang.toLowerCase().startsWith('hi'));
      if (v) return v;
      v = this.voices.find(vx => vx.lang.toLowerCase().startsWith('ta'));
      if (v) return v;
    }

    // Generic fallbacks by language family
    if (langCode === 'hi' || langCode === 'sa') {
      v = this.voices.find(vx => vx.lang.toLowerCase().startsWith('hi'));
      if (v) return v;
    }
    if (langCode === 'ta') {
      v = this.voices.find(vx => vx.lang.toLowerCase().startsWith('ta'));
      if (v) return v;
    }
    if (langCode === 'kn') {
      v = this.voices.find(vx => vx.lang.toLowerCase().startsWith('kn'));
      if (v) return v;
    }
    if (langCode === 'ml') {
      v = this.voices.find(vx => vx.lang.toLowerCase().startsWith('ml'));
      if (v) return v;
    }
    if (langCode === 'bn') {
      v = this.voices.find(vx => vx.lang.toLowerCase().startsWith('bn'));
      if (v) return v;
    }

    // Final fallback: any English voice
    v = this.voices.find(vx => vx.lang.toLowerCase().startsWith('en'));
    return v || this.voices[0] || null;
  }

  loadScript(script, lang) {
    this.script = script;
    this.lang = lang;
    this.currentIndex = 0;
  }

  open() {
    console.log('[Theater] Opening');
  }

  stop() {
    this.isPlaying = false;
    speechSynthesis.cancel();
  }

  async play() {
    if (!this.script || !this.script.lines || this.script.lines.length === 0) {
      alert('No script loaded. Please select a story and translate first.');
      return;
    }
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.currentIndex = 0;

    const voice = this.getVoiceForLang(this.lang);
    const lines = this.script.lines;
    const langName = this.lang.toUpperCase();

    // Check if we have a native voice for this language
    const hasNativeVoice = this.voices.some(vx => {
      const lc = vx.lang.toLowerCase();
      return lc.startsWith(this.lang.toLowerCase());
    });

    if (!hasNativeVoice && voice) {
      console.warn(`[Theater] No native ${langName} voice found. Using fallback: ${voice.name} (${voice.lang}). Speech quality may be reduced.`);
    } else if (!voice) {
      alert(`No speech synthesis voice available for ${langName}. Your browser may not support this language. The story will be displayed as text only.`);
    }

    let overlay = document.getElementById('theaterOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'theaterOverlay';
      overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:linear-gradient(180deg,#0f0c29,#302b63,#24243e);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:Nunito,sans-serif;color:#fff;overflow:hidden;';
      document.body.appendChild(overlay);
    }
    overlay.style.display = 'flex';
    overlay.innerHTML = `
      <button onclick="window.theater.stop();document.getElementById('theaterOverlay').style.display='none';" style="position:absolute;top:20px;right:20px;background:none;border:none;color:#fff;font-size:24px;cursor:pointer;">✕</button>
      <div style="text-align:center;max-width:800px;padding:20px;">
        <div style="font-size:14px;text-transform:uppercase;letter-spacing:2px;color:#a855f7;margin-bottom:8px;">🎭 Chandamama Theater — ${langName}</div>
        <div id="theaterEmoji" style="font-size:80px;margin:20px 0;transition:all 0.5s;">🌙</div>
        <div id="theaterSpeaker" style="font-size:18px;color:#a855f7;margin-bottom:12px;font-weight:600;">Narrator</div>
        <div id="theaterLine" style="font-size:22px;line-height:1.6;min-height:80px;transition:all 0.4s;"></div>
        ${!hasNativeVoice ? `<div style="margin-top:16px;font-size:12px;color:#fbbf24;background:rgba(251,191,36,0.1);padding:8px 16px;border-radius:6px;">⚠️ No ${langName} voice installed. Using fallback voice. For best results, install a ${langName} TTS voice in your OS.</div>` : ''}
      </div>
    `;

    for (let i = 0; i < lines.length && this.isPlaying; i++) {
      this.currentIndex = i;
      const line = lines[i];
      const text = line.translated || line.text;
      const speaker = line.speaker || 'Narrator';
      const vm = this.voiceMapper.map[speaker] || { emoji: '🌙', type: 'narrator' };

      const emojiEl = document.getElementById('theaterEmoji');
      const speakerEl = document.getElementById('theaterSpeaker');
      const lineEl = document.getElementById('theaterLine');

      if (emojiEl) { emojiEl.textContent = vm.emoji; emojiEl.style.opacity = '1'; emojiEl.style.transform = 'scale(1)'; }
      if (speakerEl) { speakerEl.textContent = speaker; speakerEl.style.opacity = '1'; }
      if (lineEl) { lineEl.textContent = text; lineEl.style.opacity = '1'; lineEl.style.transform = 'translateY(0)'; }

      if (text && voice) {
        const utter = new SpeechSynthesisUtterance(text);
        utter.voice = voice;
        // CRITICAL FIX: Set utter.lang to target language code, not voice's default language.
        // This tells the speech engine to pronounce using the target language rules,
        // even if the voice is a fallback (e.g., Hindi voice speaking Telugu text).
        utter.lang = this.lang === 'te' ? 'te-IN' :
                      this.lang === 'hi' ? 'hi-IN' :
                      this.lang === 'ta' ? 'ta-IN' :
                      this.lang === 'kn' ? 'kn-IN' :
                      this.lang === 'ml' ? 'ml-IN' :
                      this.lang === 'bn' ? 'bn-IN' :
                      this.lang === 'sa' ? 'sa-IN' :
                      this.lang === 'en' ? 'en-US' :
                      voice.lang;
        utter.rate = 0.85;
        utter.pitch = vm.type === 'child' ? 1.3 : vm.type === 'demon' ? 0.7 : 1.0;
        speechSynthesis.speak(utter);
        await new Promise(r => { utter.onend = r; utter.onerror = r; });
      } else if (text) {
        await sleep(3500);
      } else {
        await sleep(500);
      }

      if (lineEl) { lineEl.style.opacity = '0'; lineEl.style.transform = 'translateY(-10px)'; }
      if (emojiEl) { emojiEl.style.opacity = '0.3'; }
      await sleep(400);
    }

    this.isPlaying = false;
    const lineEl = document.getElementById('theaterLine');
    if (lineEl) lineEl.textContent = '🎬 The End';
  }
}

window.theater = new Theater();

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
      // More lenient title detection for Indic languages
      const isTitle = /^\d+[.\)]?\s*[A-Zऀ-ॿఀ-౿஀-௿ഀ-ൿঀ-৿]/.test(first) ||
          /^(Chapter|Story|Katha|కథ|అధ్యాయం|भाग|कथा|अध्याय|கதை|ಪುಟ|കഥ)/i.test(first) ||
          (first.length < 80 && first.length > 5 && /^[A-Zऀ-ॿఀ-౿]/.test(first));
      if (isTitle && current.sentences.length > 2) {
        stories.push(current);
        current = { title: first, pages: [p.pageNum], text: p.text, sentences };
      } else {
        current.pages.push(p.pageNum);
        current.text += '
' + p.text;
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
      dropZone.addEventListener('click', () => { if (pdfInput) pdfInput.click(); });
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
        <div class="name">${l.name}</div>
        <div class="native">${l.native}</div>
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
    // Re-render story selector to update translation badges
    if (this.stories.length > 0) this.renderStorySelector();
  }

  async handlePDF(file) {
    if (!file || file.type !== 'application/pdf') {
      alert('Please upload a valid PDF file.');
      return;
    }
    const status = document.getElementById('pdfStatus');
    if (status) { status.textContent = 'Reading PDF...'; status.className = 'status-msg show info'; }
    const arrayBuffer = await file.arrayBuffer();
    try {
      const extractor = new PDFStoryExtractor();
      this.pages = await extractor.loadPDF(arrayBuffer);
      this.stories = extractor.detectStories(this.pages);
      // Auto-parse lines for all stories so translate-all works immediately
      for (const story of this.stories) {
        if (!story.lines) {
          const sentences = story.sentences || [];
          story.lines = sentences.map((text, idx) => ({
            id: idx,
            speaker: 'Narrator',
            text: text,
            original: text
          }));
        }
      }
      this.renderStorySelector();
      const totalLines = this.stories.reduce((a, s) => a + (s.lines?.length || 0), 0);
      if (status) {
        status.innerHTML = `✅ Found <strong>${this.pages.length}</strong> pages, <strong>${this.stories.length}</strong> stories, <strong>${totalLines}</strong> drama lines.`;
        status.className = 'status-msg show ok';
      }
    } catch (e) {
      console.error(e);
      if (status) { status.textContent = 'Error: ' + e.message; status.className = 'status-msg show err'; }
    }
  }

  renderStorySelector() {
    const container = document.getElementById('storySelector');
    if (!container) return;
    const hasAnyTranslated = this.stories.some(s => s.lines?.some(l => l.translated));

    container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
        <h3 style="margin:0;">📚 Select Story / Episode</h3>
        ${this.stories.length > 1 ? `<button onclick="app.translateAllStories()" style="padding:8px 16px;background:var(--accent);border:none;border-radius:6px;color:#fff;cursor:pointer;font-weight:600;font-size:13px;">🌐 Translate All to ${this.lang.toUpperCase()}</button>` : ''}
      </div>
      ${this.stories.map((s, i) => {
        const isTranslated = s.lines?.some(l => l.translated);
        return `
        <div class="story-card" data-index="${i}" onclick="app.selectStory(${i})">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <strong>${this.escapeHtml(s.title || 'Story ' + (i+1))}</strong>
            ${isTranslated ? '<span style="color:var(--success);font-size:12px;font-weight:600;">✓ Translated</span>' : ''}
          </div>
          <div>Pages ${s.pages?.[0] || '?'}–${s.pages?.[s.pages.length-1] || '?'} · ${s.sentences?.length || 0} sentences · ${s.lines?.length || 0} drama lines</div>
        </div>
        `;
      }).join('')}
      ${hasAnyTranslated ? `<div style="margin-top:12px;padding:10px;background:rgba(34,197,94,0.1);border-radius:6px;color:var(--success);font-size:13px;text-align:center;">✓ Some stories are translated to ${this.lang.toUpperCase()}. Select one and click 🎭 Play Theater to listen.</div>` : ''}
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

    const isTranslated = lines.some(l => l.translated);

    editor.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
        <h3 style="margin:0;">🎭 Drama Cast & Lines (${lines.length} lines)</h3>
        <div>
          <button onclick="app.translateStory()" style="padding:8px 16px;background:var(--accent);border:none;border-radius:6px;color:#fff;cursor:pointer;font-weight:600;font-size:13px;margin-right:8px;">🌐 Translate to ${this.lang.toUpperCase()}</button>
          <button onclick="app.openTheater()" style="padding:8px 16px;background:var(--success);border:none;border-radius:6px;color:#fff;cursor:pointer;font-weight:600;font-size:13px;">🎭 Play Theater</button>
        </div>
      </div>
      ${lines.slice(0, 100).map((l, i) => `
        <div style="display:flex;gap:8px;margin:6px 0;padding:8px;background:rgba(255,255,255,0.03);border-radius:6px;align-items:flex-start;">
          <span style="color:var(--accent);min-width:28px;font-weight:700;">${i+1}</span>
          <div style="flex:1;">
            <div style="font-size:12px;color:var(--accent2);margin-bottom:2px;">${this.escapeHtml(l.speaker)}</div>
            <div style="color:var(--text);">${this.escapeHtml(l.text)}</div>
            ${l.translated ? `<div style="color:var(--success);font-size:13px;margin-top:4px;border-left:2px solid var(--success);padding-left:8px;">${this.escapeHtml(l.translated)}</div>` : ''}
          </div>
        </div>
      `).join('')}
      ${lines.length > 100 ? `<div style="text-align:center;color:var(--muted);padding:12px;">... and ${lines.length - 100} more lines ...</div>` : ''}
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
        <div class="cast-row">
          <span class="emoji">${info.emoji}</span>
          <span style="flex:1;font-weight:600;">${this.escapeHtml(c)}</span>
          <select onchange="app.setCharacterType('${this.escapeHtml(c).replace(/'/g, "\'")}', this.value)">
            ${Object.entries(CONFIG.voices).map(([k, v]) => `<option value="${k}" ${info.type === k ? 'selected' : ''}>${v.label}</option>`).join('')}
          </select>
        </div>
      `;
    }).join('');
    container.style.display = 'block';
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

  // ======================= TRANSLATE SINGLE STORY =======================
  async translateStory() {
    if (!this.currentStory || !this.currentStory.lines || this.currentStory.lines.length === 0) {
      alert('No story lines to translate. Please select a story first.');
      return;
    }

    const panel = document.getElementById('translationPanel');
    const fill = document.getElementById('transProgress');
    const textDiv = document.getElementById('translatedText');
    if (panel) panel.style.display = 'block';
    if (fill) fill.style.width = '0%';
    if (textDiv) textDiv.textContent = 'Starting translation...';

    const texts = this.currentStory.lines.map(l => l.text);
    const statsBefore = Translator.getCacheStats();

    try {
      const translated = await Translator.translateBatch(texts, this.lang, 'Autodetect', (done, total, netDone, netTotal) => {
        const pct = Math.round((done / total) * 100);
        if (fill) fill.style.width = pct + '%';
        if (textDiv) {
          const prov = Translator.bestProvider?.name || '...';
          textDiv.innerHTML = `
            <div>Translating line ${done}/${total} (${pct}%)</div>
            <div style="font-size:12px;color:var(--muted);margin-top:4px;">Provider: ${prov} | Network: ${netDone}/${netTotal} | Cache hits: ${Translator.stats.cached}</div>
          `;
        }
      });

      this.currentStory.lines.forEach((l, i) => { l.translated = translated[i]; });
      const statsAfter = Translator.getCacheStats();

      if (textDiv) {
        textDiv.innerHTML = `
          <div style="color:var(--success);font-weight:700;margin-bottom:8px;">✅ Translation complete!</div>
          <div style="font-size:12px;color:var(--muted);">Cache: ${statsAfter.size} entries (${statsAfter.cached} hits, ${statsAfter.translated} new, ${statsAfter.failed} fails)</div>
          <div style="margin-top:12px;max-height:300px;overflow-y:auto;border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:12px;">
            ${this.currentStory.lines.slice(0, 30).map((l, i) => `
              <div style="margin:6px 0;padding:6px;background:rgba(255,255,255,0.02);border-radius:4px;">
                <div style="font-size:11px;color:var(--accent2);">${this.escapeHtml(l.speaker)}</div>
                <div style="font-size:13px;">${this.escapeHtml(l.translated || l.text)}</div>
              </div>
            `).join('')}
            ${this.currentStory.lines.length > 30 ? `<div style="text-align:center;color:var(--muted);padding:8px;">... ${this.currentStory.lines.length - 30} more lines ...</div>` : ''}
          </div>
        `;
      }
      // Refresh UI to show translated badge
      this.showStoryEditor();
      this.renderStorySelector();
    } catch (e) {
      if (textDiv) textDiv.innerHTML = `<div style="color:var(--danger);">❌ Translation stopped: ${e.message}</div>`;
    }
    if (fill) fill.style.width = '100%';
  }

  // ======================= TRANSLATE ALL STORIES =======================
  async translateAllStories() {
    const status = document.getElementById('pdfStatus');

    if (!this.stories || this.stories.length === 0) {
      if (status) { status.textContent = '⚠ No stories loaded. Please upload a PDF first.'; status.className = 'status-msg show err'; }
      return;
    }

    // Ensure all stories have lines parsed
    for (const story of this.stories) {
      if (!story.lines) {
        const sentences = story.sentences || [];
        story.lines = sentences.map((text, idx) => ({
          id: idx,
          speaker: 'Narrator',
          text: text,
          original: text
        }));
      }
    }

    const totalLines = this.stories.reduce((a, s) => a + (s.lines?.length || 0), 0);
    if (totalLines === 0) {
      if (status) { status.textContent = '⚠ No text found in stories.'; status.className = 'status-msg show err'; }
      return;
    }

    if (totalLines > 5000) {
      const hasKey = Translator.activeProviders.some(p => p instanceof UserKeyProvider);
      if (!hasKey) {
        const go = confirm(`WARNING: You are about to translate ~${totalLines} lines without a paid API key. Free providers will rate-limit heavily and this may take hours or fail entirely.\n\nFor 1M+ words, you MUST add a Google Cloud, DeepL, or Azure API key in Settings.\n\nClick OK to proceed anyway (very slow), or Cancel to open Settings.`);
        if (!go) { this.openSettings(); return; }
      }
    }

    // Create a full-screen progress overlay
    let overlay = document.getElementById('allTransOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'allTransOverlay';
      overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(15,15,35,0.95);z-index:10001;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:Nunito,sans-serif;color:#fff;overflow:hidden;';
      document.body.appendChild(overlay);
    }
    overlay.style.display = 'flex';
    overlay.innerHTML = `
      <div style="text-align:center;max-width:600px;padding:20px;">
        <div style="font-size:48px;margin-bottom:16px;">🌐</div>
        <div style="font-size:20px;font-weight:700;margin-bottom:8px;">Translating All Stories</div>
        <div style="font-size:14px;color:var(--muted);margin-bottom:20px;">${this.stories.length} stories · ~${totalLines} lines · Target: <strong>${this.lang.toUpperCase()}</strong></div>
        <div style="background:#333;height:20px;border-radius:10px;overflow:hidden;border:2px solid var(--accent);margin-bottom:12px;">
          <div id="allTransProgressBar" style="width:0%;height:100%;background:linear-gradient(90deg,var(--accent),var(--accent2));transition:width 0.3s ease;"></div>
        </div>
        <div id="allTransPercent" style="font-size:28px;font-weight:800;color:var(--accent2);margin-bottom:8px;">0%</div>
        <div id="allTransDetail" style="font-size:13px;color:var(--muted);min-height:20px;">Starting...</div>
        <button onclick="Translator.cancel();" style="margin-top:20px;padding:10px 24px;background:var(--danger);border:none;border-radius:8px;color:#fff;cursor:pointer;font-weight:600;">⛔ Cancel</button>
      </div>
    `;

    Translator.cancel(); // Reset any previous abort
    let globalDone = 0;
    let failedStories = 0;

    for (let i = 0; i < this.stories.length; i++) {
      this.currentStory = this.stories[i];
      const texts = this.currentStory.lines.map(l => l.text);
      const storyTotal = texts.length;

      const detail = document.getElementById('allTransDetail');
      if (detail) detail.textContent = `Story ${i+1}/${this.stories.length}: ${this.currentStory.title || 'Untitled'} — starting...`;

      try {
        const translated = await Translator.translateBatch(texts, this.lang, 'Autodetect', (done, total, netDone, netTotal) => {
          globalDone++;
          const pct = Math.round((globalDone / totalLines) * 100);
          const progBar = document.getElementById('allTransProgressBar');
          const pctEl = document.getElementById('allTransPercent');
          const detailEl = document.getElementById('allTransDetail');
          if (progBar) progBar.style.width = pct + '%';
          if (pctEl) pctEl.textContent = pct + '%';
          if (detailEl) {
            const prov = Translator.bestProvider?.name || '...';
            detailEl.innerHTML = `Story <strong>${i+1}/${this.stories.length}</strong>: ${this.escapeHtml(this.currentStory.title || 'Untitled')} — line ${done}/${total} <br><span style="color:var(--accent2);">${pct}% complete</span> · Provider: ${prov}`;
          }
        });

        this.currentStory.lines.forEach((l, idx) => { l.translated = translated[idx]; });
      } catch (e) {
        failedStories++;
        const detailEl = document.getElementById('allTransDetail');
        if (detailEl) detailEl.innerHTML = `<span style="color:var(--danger);">⚠ Stopped at story ${i+1}: ${e.message}</span>`;
        break;
      }
    }

    const stats = Translator.getCacheStats();
    const overlayEl = document.getElementById('allTransOverlay');
    if (overlayEl) {
      overlayEl.innerHTML = `
        <div style="text-align:center;max-width:600px;padding:20px;">
          <div style="font-size:48px;margin-bottom:16px;">${failedStories > 0 ? '⚠️' : '✅'}</div>
          <div style="font-size:20px;font-weight:700;margin-bottom:8px;">${failedStories > 0 ? 'Translation Partially Complete' : 'All Stories Translated!'}</div>
          <div style="font-size:14px;color:var(--muted);margin-bottom:20px;">
            ${this.stories.length - failedStories}/${this.stories.length} stories completed · ${stats.size} cache entries<br>
            ${stats.cached} cached · ${stats.translated} new · ${stats.failed} failed
          </div>
          <button onclick="document.getElementById('allTransOverlay').style.display='none';" style="padding:10px 24px;background:var(--success);border:none;border-radius:8px;color:#fff;cursor:pointer;font-weight:600;">Close</button>
        </div>
      `;
    }

    if (status) {
      status.innerHTML = `
        <div style="font-weight:700;color:var(--success);">✅ ${this.stories.length - failedStories}/${this.stories.length} stories translated to ${this.lang.toUpperCase()}!</div>
        <div style="font-size:12px;color:var(--muted);">Cache: ${stats.size} entries (${stats.cached} cached, ${stats.translated} new, ${stats.failed} failed)</div>
      `;
      status.className = 'status-msg show ok';
    }
    this.renderStorySelector();
  }

  // ======================= THEATER / PLAY =======================
  openTheater() {
    if (!this.currentStory || !this.currentStory.lines || this.currentStory.lines.length === 0) {
      alert('Please select a story with lines first.');
      return;
    }
    const hasTranslation = this.currentStory.lines.some(l => l.translated);
    if (!hasTranslation) {
      const go = confirm('🎭 Text is not yet translated to ' + this.lang.toUpperCase() + '.\n\nTheater will speak in the original language, which may not sound correct if your browser lacks Indic voices.\n\nClick OK to translate first, or Cancel to play original.');
      if (go) { this.translateStory(); return; }
    }
    const script = { title: this.currentStory.title, lines: this.currentStory.lines };
    window.theater.loadScript(script, this.lang);
    window.theater.open();
    window.theater.play();
  }

  // ======================= SETTINGS =======================
  renderSettings() {
    const existing = document.getElementById('cmSettingsPanel');
    if (existing) return;
    const panel = document.createElement('div');
    panel.id = 'cmSettingsPanel';
    panel.style.cssText = 'display:none;position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#1e1b4b;border:1px solid #4c1d95;border-radius:12px;padding:24px;max-width:420px;width:90%;z-index:10000;color:#fff;box-shadow:0 20px 60px rgba(0,0,0,0.6);font-family:sans-serif;';
    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h3 style="margin:0;">⚙️ Translation Settings</h3>
        <button onclick="document.getElementById('cmSettingsPanel').style.display='none';" style="background:none;border:none;color:#fff;font-size:20px;cursor:pointer;">✕</button>
      </div>
      <p style="font-size:12px;color:var(--muted);margin-bottom:16px;">For 1,000+ lines, add a paid API key. Free providers rate-limit heavily.</p>
      <div style="margin-bottom:12px;">
        <label style="font-size:12px;color:var(--muted);display:block;margin-bottom:4px;">Google Cloud API Key</label>
        <input id="cmKeyGoogle" type="password" style="width:100%;padding:8px;background:#0f0f23;border:1px solid #4c1d95;border-radius:6px;color:#fff;font-family:inherit;" placeholder="AIza...">
      </div>
      <div style="margin-bottom:12px;">
        <label style="font-size:12px;color:var(--muted);display:block;margin-bottom:4px;">DeepL API Key</label>
        <input id="cmKeyDeepL" type="password" style="width:100%;padding:8px;background:#0f0f23;border:1px solid #4c1d95;border-radius:6px;color:#fff;font-family:inherit;" placeholder="xxxxxxxx-xxxx...">
      </div>
      <div style="margin-bottom:12px;">
        <label style="font-size:12px;color:var(--muted);display:block;margin-bottom:4px;">Azure Translator Key</label>
        <input id="cmKeyAzure" type="password" style="width:100%;padding:8px;background:#0f0f23;border:1px solid #4c1d95;border-radius:6px;color:#fff;font-family:inherit;" placeholder="xxxxxxxx...">
      </div>
      <div style="margin-bottom:16px;">
        <label style="font-size:12px;color:var(--muted);display:block;margin-bottom:4px;">Azure Region (e.g. global, westus2)</label>
        <input id="cmKeyAzureRegion" type="text" style="width:100%;padding:8px;background:#0f0f23;border:1px solid #4c1d95;border-radius:6px;color:#fff;font-family:inherit;" placeholder="global">
      </div>
      <div style="display:flex;gap:8px;margin-bottom:16px;">
        <button onclick="app.saveSettings()" style="flex:1;padding:10px;background:var(--accent);border:none;border-radius:6px;color:#fff;cursor:pointer;font-weight:600;">Save</button>
        <button onclick="app.clearCache()" style="padding:10px;background:rgba(239,68,68,0.2);border:1px solid var(--danger);border-radius:6px;color:var(--danger);cursor:pointer;font-weight:600;">Clear Cache</button>
      </div>
      <div id="cmProviderStatus" style="font-size:12px;"></div>
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
    div.innerHTML = '<div style="font-weight:600;margin-bottom:6px;">Provider Status</div>' + status.map(s => {
      const color = s.available ? '#4ade80' : '#f87171';
      const note = s.circuitOpen ? ' (circuit open)' : '';
      return `<div style="color:${color};margin:2px 0;">● ${s.name}${note} — fails: ${s.failures}</div>`;
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

  clearTranslationCache() {
    Translator.clearCache();
    const status = document.getElementById('pdfStatus');
    if (status) { status.innerHTML = '🗑 Translation cache cleared!'; status.className = 'status-msg show ok'; }
    if (this.stories) {
      this.stories.forEach(s => {
        if (s.lines) s.lines.forEach(l => { l.translated = null; });
      });
    }
    if (this.currentStory && this.currentStory.lines) {
      this.currentStory.lines.forEach(l => { l.translated = null; });
    }
    this.renderStorySelector();
    if (this.currentStory) this.showStoryEditor();
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
